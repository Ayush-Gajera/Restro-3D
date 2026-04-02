/**
 * AR Fallback Engine for Restro3D
 *
 * Provides AR-like experience on devices without WebXR/ARCore support.
 *
 * WHY MindAR.js (not AR.js):
 * - Image-target based: tracks ANY image, not just ugly fiducial markers
 * - WASM-powered: fast client-side detection, no server needed
 * - Three.js native integration via mindar-image-three module
 * - Better pose estimation, handles partial occlusion
 *
 * MARKER DETECTION FLOW:
 * 1. MindAR loads the compiled .mind target file
 * 2. Camera feed is analyzed frame-by-frame via WASM worker
 * 3. Feature points are extracted and matched against the target
 * 4. When matched, a 6DOF pose (position + rotation) is estimated
 * 5. The pose is applied to a Three.js anchor group each frame
 * 6. 3D model attached to anchor follows the marker in real-time
 *
 * POSE ESTIMATION:
 * MindAR uses homography estimation + PnP (Perspective-n-Point) solving
 * to compute the 3D pose from 2D feature correspondences. The .mind file
 * contains pre-computed feature descriptors for the target image.
 */

// ─── State Machine ───────────────────────────────────────────────
const STATES = {
    INITIALIZING: 'initializing',
    SCANNING:     'scanning',
    DETECTED:     'marker_detected',
    LOST:         'marker_lost',
    FALLBACK:     'fallback_active',
    ERROR:        'error'
};

// ─── CDN URLs (loaded lazily, only when fallback triggers) ───────
const CDN = {
    MINDAR: 'https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image-three.prod.js',
    THREE:  'https://cdn.jsdelivr.net/npm/three@0.153.0/build/three.min.js',
    GLTF:   'https://cdn.jsdelivr.net/npm/three@0.153.0/examples/js/loaders/GLTFLoader.js',
};

// ─── Helpers ─────────────────────────────────────────────────────
function loadScript(src) {
    return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
        const s = document.createElement('script');
        s.src = src;
        s.onload = resolve;
        s.onerror = () => reject(new Error(`Failed to load: ${src}`));
        document.head.appendChild(s);
    });
}

async function loadDependencies() {
    // Three.js must load first (sets window.THREE), then GLTFLoader attaches to it
    await loadScript(CDN.THREE);
    await loadScript(CDN.GLTF);
    await loadScript(CDN.MINDAR);
}

// ─── Main Engine Class ──────────────────────────────────────────
class ARFallbackEngine {

    constructor(config) {
        this.glbUrl          = config.glbUrl;
        this.markerMindUrl   = config.markerMindUrl || null;
        this.scaleFactor     = config.scaleFactor || 1.0;
        this.markerTimeout   = config.markerTimeout || 5000;   // ms before switching to center placement
        this.lostTimeout     = config.lostTimeout || 3000;     // ms to freeze before hiding
        this.onStateChange   = config.onStateChange || (() => {});
        this.onError         = config.onError || (() => {});

        // Internal refs
        this.container       = null;
        this.state           = STATES.INITIALIZING;
        this.model           = null;
        this.shadowPlane     = null;
        this.mindarThree     = null;
        this.renderer        = null;
        this.scene           = null;
        this.camera          = null;
        this.anchor          = null;
        this.animationId     = null;
        this.stream          = null;
        this.videoEl         = null;

        // Timers
        this._markerTimer    = null;
        this._lostTimer      = null;

        // Touch state
        this._touch = {
            isDragging: false,
            prev: null,
            rotX: -0.3,
            rotY: 0,
            scale: this.scaleFactor,
            pinchDist: null,
        };
    }

    // ─── Public API ──────────────────────────────────────────────

    async start() {
        try {
            this._buildContainer();
            this._setState(STATES.INITIALIZING);
            await loadDependencies();

            if (this.markerMindUrl) {
                await this._startMarkerMode();
            } else {
                await this._startCenterPlacement();
            }
        } catch (err) {
            console.error('[ARFallback] Fatal:', err);
            this._setState(STATES.ERROR);
            this.onError(err);
        }
    }

    stop() {
        // Stop MindAR
        if (this.mindarThree) {
            try { this.mindarThree.stop(); } catch (_) {}
            this.mindarThree = null;
        }
        // Stop camera stream
        if (this.stream) {
            this.stream.getTracks().forEach(t => t.stop());
            this.stream = null;
        }
        // Cancel animation
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        // Clear timers
        clearTimeout(this._markerTimer);
        clearTimeout(this._lostTimer);
        // Dispose renderer
        if (this.renderer) {
            this.renderer.dispose();
            this.renderer = null;
        }
        // Remove container
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
            this.container = null;
        }
        document.body.style.overflow = '';
    }

    // ─── Marker Mode (MindAR) ────────────────────────────────────

    async _startMarkerMode() {
        this._setState(STATES.SCANNING);
        const THREE = window.THREE;

        // Create MindAR instance — it handles camera + Three.js scene
        this.mindarThree = new window.MINDAR.IMAGE.MindARThree({
            container: this.container.querySelector('.arfb-canvas-wrap'),
            imageTargetSrc: this.markerMindUrl,
        });

        const { renderer, scene, camera } = this.mindarThree;
        this.renderer = renderer;
        this.scene    = scene;
        this.camera   = camera;

        this._setupLighting(THREE, scene);

        // Load model
        this.model = await this._loadModel(this.glbUrl);

        // Create anchor for target index 0
        this.anchor = this.mindarThree.addAnchor(0);
        this.anchor.group.add(this.model);

        // Shadow under model
        this.shadowPlane = this._createShadow(THREE);
        this.anchor.group.add(this.shadowPlane);

        // Marker found/lost handlers
        this.anchor.onTargetFound = () => {
            clearTimeout(this._markerTimer);
            clearTimeout(this._lostTimer);
            this.model.visible = true;
            this.shadowPlane.visible = true;
            this._setState(STATES.DETECTED);
        };

        this.anchor.onTargetLost = () => {
            this._setState(STATES.LOST);
            // Freeze for lostTimeout, then hide
            this._lostTimer = setTimeout(() => {
                this.model.visible = false;
                this.shadowPlane.visible = false;
            }, this.lostTimeout);
        };

        // Start MindAR (opens camera + begins tracking)
        await this.mindarThree.start();

        // Marker timeout → switch to center placement
        this._markerTimer = setTimeout(() => {
            if (this.state === STATES.SCANNING) {
                this._transitionToCenterPlacement();
            }
        }, this.markerTimeout);

        // Render loop
        this.renderer.setAnimationLoop(() => {
            this.renderer.render(this.scene, this.camera);
        });
    }

    async _transitionToCenterPlacement() {
        // Stop MindAR but keep container
        if (this.mindarThree) {
            this.mindarThree.stop();
            this.mindarThree = null;
        }
        if (this.renderer) {
            this.renderer.setAnimationLoop(null);
            this.renderer.dispose();
            this.renderer = null;
        }
        // Clear the canvas wrapper
        const wrap = this.container.querySelector('.arfb-canvas-wrap');
        wrap.innerHTML = '';
        // Start center placement from scratch
        await this._startCenterPlacement();
    }

    // ─── Center Placement Mode (getUserMedia + Three.js) ──────────

    async _startCenterPlacement() {
        this._setState(STATES.FALLBACK);
        const THREE = window.THREE;

        const wrap = this.container.querySelector('.arfb-canvas-wrap');

        // 1. Camera feed
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
                audio: false,
            });
        } catch (err) {
            this._handleCameraError(err);
            return;
        }

        this.videoEl = document.createElement('video');
        this.videoEl.setAttribute('playsinline', '');
        this.videoEl.setAttribute('autoplay', '');
        this.videoEl.muted = true;
        this.videoEl.srcObject = this.stream;
        this.videoEl.className = 'arfb-video';
        wrap.appendChild(this.videoEl);
        await this.videoEl.play();

        // 2. Three.js renderer overlay (transparent bg so video shows through)
        const w = wrap.clientWidth  || window.innerWidth;
        const h = wrap.clientHeight || window.innerHeight;

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(w, h);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;
        this.renderer.domElement.className = 'arfb-three-canvas';
        wrap.appendChild(this.renderer.domElement);

        // 3. Scene + camera
        this.scene  = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(60, w / h, 0.01, 100);
        this.camera.position.set(0, 0, 0);

        this._setupLighting(THREE, this.scene);

        // 4. Load model if not already loaded
        if (!this.model) {
            this.model = await this._loadModel(this.glbUrl);
        }
        // Reset transforms
        this.model.position.set(0, -0.05, -0.6);
        this.model.rotation.set(this._touch.rotX, this._touch.rotY, 0);
        this.model.scale.setScalar(this._touch.scale);
        this.model.visible = true;
        this.scene.add(this.model);

        // 5. Shadow
        this.shadowPlane = this._createShadow(THREE);
        this.shadowPlane.position.set(0, -0.22, -0.6);
        this.shadowPlane.visible = true;
        this.scene.add(this.shadowPlane);

        // 6. Touch controls
        this._setupTouchControls(this.renderer.domElement);

        // 7. Resize handler
        this._onResize = () => {
            const nw = wrap.clientWidth  || window.innerWidth;
            const nh = wrap.clientHeight || window.innerHeight;
            this.camera.aspect = nw / nh;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(nw, nh);
        };
        window.addEventListener('resize', this._onResize);

        // 8. Render loop (target 60 fps, throttle if needed)
        const animate = () => {
            this.animationId = requestAnimationFrame(animate);
            if (this.model) {
                this.model.rotation.set(this._touch.rotX, this._touch.rotY, 0);
                this.model.scale.setScalar(this._touch.scale);
            }
            this.renderer.render(this.scene, this.camera);
        };
        animate();
    }

    // ─── Model Loading ───────────────────────────────────────────

    async _loadModel(url) {
        const THREE = window.THREE;
        return new Promise((resolve, reject) => {
            const loader = new THREE.GLTFLoader();
            loader.load(
                url,
                (gltf) => {
                    const model = gltf.scene;
                    // Auto-scale: fit model into a 0.3 unit bounding box
                    const box  = new THREE.Box3().setFromObject(model);
                    const size = new THREE.Vector3();
                    box.getSize(size);
                    const maxDim = Math.max(size.x, size.y, size.z);
                    const s = (0.3 / maxDim) * this.scaleFactor;
                    model.scale.setScalar(s);
                    this._touch.scale = s;
                    // Center model
                    const center = new THREE.Vector3();
                    box.getCenter(center);
                    model.position.sub(center.multiplyScalar(s));
                    resolve(model);
                },
                undefined,
                (err) => reject(new Error('Failed to load GLB: ' + err.message))
            );
        });
    }

    // ─── Lighting ────────────────────────────────────────────────

    _setupLighting(THREE, scene) {
        const ambient = new THREE.AmbientLight(0xffffff, 0.8);
        const dir     = new THREE.DirectionalLight(0xffffff, 0.9);
        dir.position.set(0.5, 1.0, 0.8);
        scene.add(ambient, dir);
    }

    // ─── Shadow ──────────────────────────────────────────────────

    _createShadow(THREE) {
        const geo = new THREE.CircleGeometry(0.15, 32);
        const mat = new THREE.MeshBasicMaterial({
            color: 0x000000,
            transparent: true,
            opacity: 0.18,
            depthWrite: false,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.rotation.x = -Math.PI / 2;
        return mesh;
    }

    // ─── Touch Controls ──────────────────────────────────────────

    _setupTouchControls(canvas) {
        // Single finger → drag to rotate
        canvas.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                this._touch.isDragging = true;
                this._touch.prev = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            } else if (e.touches.length === 2) {
                this._touch.pinchDist = this._pinchDist(e);
            }
            e.preventDefault();
        }, { passive: false });

        canvas.addEventListener('touchmove', (e) => {
            if (e.touches.length === 1 && this._touch.isDragging) {
                const dx = e.touches[0].clientX - this._touch.prev.x;
                const dy = e.touches[0].clientY - this._touch.prev.y;
                this._touch.rotY += dx * 0.008;
                this._touch.rotX += dy * 0.006;
                this._touch.rotX = Math.max(-1.2, Math.min(1.2, this._touch.rotX));
                this._touch.prev = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            } else if (e.touches.length === 2 && this._touch.pinchDist !== null) {
                const dist = this._pinchDist(e);
                const delta = dist / this._touch.pinchDist;
                this._touch.scale *= delta;
                this._touch.scale = Math.max(0.05, Math.min(2.0, this._touch.scale));
                this._touch.pinchDist = dist;
            }
            e.preventDefault();
        }, { passive: false });

        canvas.addEventListener('touchend', (e) => {
            this._touch.isDragging = false;
            this._touch.pinchDist  = null;
        });

        // Mouse fallback (desktop testing)
        let mouseDown = false;
        canvas.addEventListener('mousedown', (e) => { mouseDown = true; this._touch.prev = { x: e.clientX, y: e.clientY }; });
        canvas.addEventListener('mousemove', (e) => {
            if (!mouseDown) return;
            const dx = e.clientX - this._touch.prev.x;
            const dy = e.clientY - this._touch.prev.y;
            this._touch.rotY += dx * 0.008;
            this._touch.rotX += dy * 0.006;
            this._touch.rotX = Math.max(-1.2, Math.min(1.2, this._touch.rotX));
            this._touch.prev = { x: e.clientX, y: e.clientY };
        });
        canvas.addEventListener('mouseup', () => { mouseDown = false; });
        canvas.addEventListener('wheel', (e) => {
            this._touch.scale *= e.deltaY > 0 ? 0.95 : 1.05;
            this._touch.scale = Math.max(0.05, Math.min(2.0, this._touch.scale));
            e.preventDefault();
        }, { passive: false });
    }

    _pinchDist(e) {
        const a = e.touches[0], b = e.touches[1];
        return Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
    }

    // ─── Camera Error ────────────────────────────────────────────

    _handleCameraError(err) {
        let msg = 'Camera access failed.';
        if (err.name === 'NotAllowedError')       msg = 'Camera permission was denied. Please allow camera access and try again.';
        else if (err.name === 'NotFoundError')     msg = 'No camera found on this device.';
        else if (err.name === 'NotReadableError')  msg = 'Camera is in use by another application.';
        this._setState(STATES.ERROR);
        this.onError(new Error(msg));
        // Show error in UI
        const overlay = this.container.querySelector('.arfb-status');
        if (overlay) {
            overlay.className = 'arfb-status arfb-status--error';
            overlay.innerHTML = `<i class="fas fa-exclamation-triangle"></i><span>${msg}</span>`;
        }
    }

    // ─── State Management ────────────────────────────────────────

    _setState(state) {
        this.state = state;
        this.onStateChange(state);
        this._updateStatusUI(state);
    }

    _updateStatusUI(state) {
        const el = this.container ? this.container.querySelector('.arfb-status') : null;
        if (!el) return;

        const messages = {
            [STATES.INITIALIZING]: { icon: 'fa-spinner fa-spin', text: 'Loading AR experience...',              cls: '' },
            [STATES.SCANNING]:     { icon: 'fa-camera',          text: 'Point camera at the marker image',      cls: 'arfb-status--scanning' },
            [STATES.DETECTED]:     { icon: 'fa-check-circle',    text: 'Marker detected! Model placed.',        cls: 'arfb-status--success' },
            [STATES.LOST]:         { icon: 'fa-eye-slash',       text: 'Marker lost — keep it in view',         cls: 'arfb-status--warning' },
            [STATES.FALLBACK]:     { icon: 'fa-hand-pointer',    text: 'Drag to rotate \u2022 Pinch to zoom',   cls: 'arfb-status--fallback' },
            [STATES.ERROR]:        { icon: 'fa-exclamation-triangle', text: 'Something went wrong',             cls: 'arfb-status--error' },
        };
        const m = messages[state] || messages[STATES.INITIALIZING];
        el.className = `arfb-status ${m.cls}`;
        el.innerHTML = `<i class="fas ${m.icon}"></i><span>${m.text}</span>`;
    }

    // ─── Container Setup ─────────────────────────────────────────

    _buildContainer() {
        this.container = document.createElement('div');
        this.container.id = 'arfb-container';
        this.container.innerHTML = `
            <div class="arfb-header">
                <button class="arfb-close" id="arfb-close-btn" aria-label="Close AR">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="arfb-canvas-wrap"></div>
            <div class="arfb-status">
                <i class="fas fa-spinner fa-spin"></i>
                <span>Loading AR experience...</span>
            </div>
            <div class="arfb-scan-frame">
                <div class="arfb-corner arfb-corner--tl"></div>
                <div class="arfb-corner arfb-corner--tr"></div>
                <div class="arfb-corner arfb-corner--bl"></div>
                <div class="arfb-corner arfb-corner--br"></div>
            </div>
        `;
        document.body.appendChild(this.container);
        document.body.style.overflow = 'hidden';

        // Close button
        this.container.querySelector('#arfb-close-btn').addEventListener('click', () => this.stop());
    }
}

// ─── Capability Detection ────────────────────────────────────────
async function isWebXRSupported() {
    if (!navigator.xr) return false;
    try {
        return await navigator.xr.isSessionSupported('immersive-ar');
    } catch (_) {
        return false;
    }
}

// ─── Public API ──────────────────────────────────────────────────
window.ARFallbackEngine   = ARFallbackEngine;
window.isWebXRSupported   = isWebXRSupported;
window.AR_STATES          = STATES;
