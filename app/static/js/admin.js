// Global variables
let restaurants = [];
let currentRestaurantId = null;

// Tab switching
function switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    event.target.closest('.tab').classList.add('active');
    
    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`${tabName}-tab`).classList.add('active');
    
    // Load data if needed
    if (tabName === 'menu') {
        loadRestaurantsForDropdown();
    }
}

// Restaurant Management
document.getElementById('restaurant-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    
    try {
        const response = await fetch('/api/restaurants', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) throw new Error('Failed to create restaurant');
        
        const restaurant = await response.json();
        
        alert('Restaurant created successfully!');
        e.target.reset();
        loadRestaurants();
    } catch (error) {
        alert('Error creating restaurant: ' + error.message);
    }
});

async function loadRestaurants() {
    try {
        const response = await fetch('/api/restaurants');
        if (!response.ok) throw new Error('Failed to load restaurants');
        
        restaurants = await response.json();
        
        if (restaurants.length === 0) {
            document.getElementById('restaurant-list').innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-store"></i>
                    <p>No restaurants yet. Create your first restaurant above!</p>
                </div>
            `;
            return;
        }
        
        const html = restaurants.map(restaurant => `
            <div class="restaurant-item">
                <div class="item-info">
                    <h3>${restaurant.name}</h3>
                    <p>${restaurant.description || 'No description'}</p>
                    <p style="font-size: 0.85rem; color: #999;">
                        <i class="fas fa-calendar"></i> Created: ${new Date(restaurant.created_at).toLocaleDateString()}
                    </p>
                </div>
                <div class="item-actions">
                    <button class="btn-icon btn-view" onclick="viewMenu('${restaurant.id}')" title="View Menu">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn-icon btn-qr" onclick="generateQRCode('${restaurant.id}')" title="Generate QR Code">
                        <i class="fas fa-qrcode"></i>
                    </button>
                    <button class="btn-icon btn-delete" onclick="deleteRestaurant('${restaurant.id}')" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
        
        document.getElementById('restaurant-list').innerHTML = html;
    } catch (error) {
        document.getElementById('restaurant-list').innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-circle"></i>
                <p>Error loading restaurants</p>
            </div>
        `;
    }
}

function viewMenu(restaurantId) {
    window.open(`/menu/${restaurantId}`, '_blank');
}

async function generateQRCode(restaurantId) {
    try {
        const response = await fetch(`/api/restaurants/${restaurantId}/generate-qr`, {
            method: 'POST'
        });
        
        if (!response.ok) throw new Error('Failed to generate QR code');
        
        const data = await response.json();
        
        // Show QR code in modal
        document.getElementById('qr-image').src = data.qr_code_url + '?t=' + Date.now();
        document.getElementById('qr-url').textContent = data.menu_url;
        document.getElementById('qr-modal').classList.add('active');
        currentRestaurantId = restaurantId;
        
    } catch (error) {
        alert('Error generating QR code: ' + error.message);
    }
}

function closeQRModal() {
    document.getElementById('qr-modal').classList.remove('active');
}

function downloadQR() {
    const qrImage = document.getElementById('qr-image');
    const link = document.createElement('a');
    link.href = qrImage.src;
    link.download = `restaurant-qr-${currentRestaurantId}.png`;
    link.click();
}

async function deleteRestaurant(restaurantId) {
    if (!confirm('Are you sure you want to delete this restaurant? This will also delete all menu items.')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/restaurants/${restaurantId}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) throw new Error('Failed to delete restaurant');
        
        alert('Restaurant deleted successfully');
        loadRestaurants();
    } catch (error) {
        alert('Error deleting restaurant: ' + error.message);
    }
}

// Menu Item Management
async function loadRestaurantsForDropdown() {
    try {
        const response = await fetch('/api/restaurants');
        if (!response.ok) throw new Error('Failed to load restaurants');
        
        const restaurants = await response.json();
        
        const selectElements = [
            document.getElementById('menu-restaurant'),
            document.getElementById('filter-restaurant')
        ];
        
        selectElements.forEach(select => {
            const currentValue = select.value;
            const options = restaurants.map(r => 
                `<option value="${r.id}">${r.name}</option>`
            ).join('');
            
            if (select.id === 'filter-restaurant') {
                select.innerHTML = '<option value="">-- All Restaurants --</option>' + options;
            } else {
                select.innerHTML = '<option value="">-- Select Restaurant --</option>' + options;
            }
            
            if (currentValue) {
                select.value = currentValue;
            }
        });
        
        loadMenuItems();
    } catch (error) {
        console.error('Error loading restaurants:', error);
    }
}

document.getElementById('menu-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const restaurantId = formData.get('restaurant_id');
    
    if (!restaurantId) {
        alert('Please select a restaurant');
        return;
    }
    
    // Remove restaurant_id from formData as it's in the URL
    formData.delete('restaurant_id');
    
    try {
        const response = await fetch(`/api/restaurants/${restaurantId}/menu-items`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to create menu item');
        }
        
        const menuItem = await response.json();
        
        alert('Menu item added successfully!');
        e.target.reset();
        document.getElementById('menu-scale').value = '1.0';
        loadMenuItems();
    } catch (error) {
        alert('Error adding menu item: ' + error.message);
    }
});

async function loadMenuItems() {
    const filterRestaurant = document.getElementById('filter-restaurant').value;
    
    try {
        let url = '/api/menu-items';
        
        if (filterRestaurant) {
            url = `/api/restaurants/${filterRestaurant}/menu-items`;
        } else {
            // Load all menu items from all restaurants
            const restaurantsResponse = await fetch('/api/restaurants');
            const restaurants = await restaurantsResponse.json();
            
            const allMenuItems = [];
            for (const restaurant of restaurants) {
                const menuResponse = await fetch(`/api/restaurants/${restaurant.id}/menu-items`);
                const items = await menuResponse.json();
                allMenuItems.push(...items);
            }
            
            displayMenuItems(allMenuItems);
            return;
        }
        
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to load menu items');
        
        const menuItems = await response.json();
        displayMenuItems(menuItems);
        
    } catch (error) {
        document.getElementById('menu-list').innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-circle"></i>
                <p>Error loading menu items</p>
            </div>
        `;
    }
}

function displayMenuItems(menuItems) {
    if (menuItems.length === 0) {
        document.getElementById('menu-list').innerHTML = `
            <div class="empty-state">
                <i class="fas fa-utensils"></i>
                <p>No menu items yet. Add your first menu item above!</p>
            </div>
        `;
        return;
    }
    
    const html = menuItems.map(item => `
        <div class="menu-item-card">
            <div class="item-info">
                <h3>${item.name}</h3>
                <p>${item.description || 'No description'}</p>
                <p style="font-size: 0.9rem; margin-top: 0.5rem;">
                    <strong>Price:</strong> $${item.price.toFixed(2)} |
                    <strong>Category:</strong> ${item.category || 'None'} |
                    <strong>Available:</strong> ${item.is_available ? '✅ Yes' : '❌ No'}
                </p>
            </div>
            <div class="item-actions">
                <button class="btn-icon btn-view" onclick="previewMenuItem('${item.id}', '${item.glb_file_url}')" title="Preview 3D Model">
                    <i class="fas fa-cube"></i>
                </button>
                <button class="btn-icon btn-delete" onclick="deleteMenuItem('${item.id}')" title="Delete">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('');
    
    document.getElementById('menu-list').innerHTML = html;
}

function previewMenuItem(itemId, glbUrl) {
    // Open in a new window with the menu viewer
    window.open(`/menu/${itemId}`, '_blank');
}

async function deleteMenuItem(itemId) {
    if (!confirm('Are you sure you want to delete this menu item?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/menu-items/${itemId}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) throw new Error('Failed to delete menu item');
        
        alert('Menu item deleted successfully');
        loadMenuItems();
    } catch (error) {
        alert('Error deleting menu item: ' + error.message);
    }
}

// File upload indicators
document.getElementById('restaurant-logo').addEventListener('change', function(e) {
    const fileName = e.target.files[0]?.name || 'No file selected';
    e.target.parentElement.querySelector('p').textContent = fileName;
});

document.getElementById('menu-glb').addEventListener('change', function(e) {
    const fileName = e.target.files[0]?.name || 'No file selected';
    e.target.parentElement.querySelector('p').textContent = fileName;
});

document.getElementById('menu-image').addEventListener('change', function(e) {
    const fileName = e.target.files[0]?.name || 'No file selected';
    e.target.parentElement.querySelector('p').textContent = fileName;
});

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadRestaurants();
});
