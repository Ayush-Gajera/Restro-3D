from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import os
from pathlib import Path

from app.core.config import settings
from app.api import restaurants, menu_items, qr_codes
from app.database import init_db

# Create necessary directories
UPLOAD_DIR = Path(settings.UPLOAD_DIR)
UPLOAD_DIR.mkdir(exist_ok=True)
(UPLOAD_DIR / "glb").mkdir(exist_ok=True)
(UPLOAD_DIR / "images").mkdir(exist_ok=True)
(UPLOAD_DIR / "qr_codes").mkdir(exist_ok=True)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print("🚀 Starting Restro3D Application...")
    await init_db()
    print("✅ Database initialized")
    yield
    # Shutdown
    print("👋 Shutting down...")

app = FastAPI(
    title="Restro3D",
    description="AR-enabled restaurant menu system",
    version="1.0.0",
    lifespan=lifespan
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.get_allowed_origins_list(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files
app.mount("/static", StaticFiles(directory="app/static"), name="static")
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

# Templates
templates = Jinja2Templates(directory="app/templates")

# Include routers
app.include_router(restaurants.router, prefix="/api", tags=["restaurants"])
app.include_router(menu_items.router, prefix="/api", tags=["menu_items"])
app.include_router(qr_codes.router, prefix="/api", tags=["qr_codes"])

# Root endpoints
@app.get("/")
async def root(request: Request):
    """Landing page"""
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/admin")
async def admin_dashboard(request: Request):
    """Admin dashboard for restaurant owners"""
    return templates.TemplateResponse("admin.html", {"request": request})

@app.get("/menu/{restaurant_id}")
async def view_menu(request: Request, restaurant_id: str):
    """Customer-facing menu view with AR support"""
    return templates.TemplateResponse(
        "menu.html",
        {
            "request": request,
            "restaurant_id": restaurant_id
        }
    )

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "app": "Restro3D"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
