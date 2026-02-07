# Restro3D - AR Restaurant Menu System

A modern, deployment-ready web application that brings restaurant menus to life with 3D/AR visualization. Customers can scan a QR code and view realistic 3D models of dishes on their table using any smartphone - no special AR sensors required!

## 🌟 Features

- **Universal AR Support**: Works on ALL devices (iPhone, Android, tablets) with or without AR sensors
- **Simple Restaurant Management**: Easy-to-use admin dashboard for non-technical users
- **QR Code Generation**: Automatic QR code generation for each restaurant
- **3D Model Upload**: Support for GLB 3D models of food items
- **Real-time Preview**: Customers can see exactly how dishes look before ordering
- **Category Filtering**: Organize menu by categories (Appetizer, Main Course, Dessert, etc.)
- **Responsive Design**: Beautiful UI that works on all screen sizes

## 🚀 Quick Start

### Prerequisites

- Python 3.11 or higher
- Supabase account (already configured)

### Installation & Running

#### Windows
1. Double-click `start.bat`
2. Wait for the installation to complete
3. Open your browser to `http://localhost:8000`

#### Linux/Mac
```bash
chmod +x start.sh
./start.sh
```

Or manually:
```bash
# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On Linux/Mac:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run the application
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## 📖 How to Use

### For Restaurant Owners

1. **Access Admin Dashboard**
   - Navigate to `http://localhost:8000/admin`

2. **Create Your Restaurant**
   - Fill in restaurant details (name, description, contact info)
   - Upload a logo (optional)
   - Click "Create Restaurant"

3. **Generate QR Code**
   - Click the QR code icon next to your restaurant
   - Download the QR code image
   - Print and place it on your tables

4. **Add Menu Items**
   - Go to "Menu Items" tab
   - Select your restaurant
   - Fill in item details:
     - Name and price (required)
     - Description and category (optional)
     - Upload GLB file (required) - your 3D model
     - Upload preview image (optional)
     - Adjust scale factor if needed (default: 1.0)
   - Click "Add Menu Item"

### For Customers

1. **Scan QR Code**
   - Use your phone camera to scan the QR code on the table

2. **Browse Menu**
   - See all available dishes with images and descriptions
   - Filter by category if desired

3. **View in 3D/AR**
   - Click "View in 3D/AR" on any dish
   - On AR-capable devices: Tap "View in your space" to place the dish on your table
   - On other devices: Rotate and zoom the 3D model with touch gestures

## 🎨 Creating 3D Models (GLB Files)

### Using iPhone with LiDAR

1. **Download 3D Scanner App**
   - Install "Polycam" or "3D Scanner App" from App Store

2. **Scan Your Dish**
   - Place the dish on a table with good lighting
   - Open the scanning app
   - Follow app instructions to scan around the dish
   - Process the scan

3. **Export as GLB**
   - In the app, select your scan
   - Choose "Export" → "GLB" format
   - Save to Files or share to your computer

4. **Upload to Restro3D**
   - Go to admin dashboard
   - Add menu item and upload the GLB file

### Alternative Methods

- **Blender**: Create models manually or import/convert from other formats
- **Professional Services**: Hire 3D artists if needed
- **Stock Models**: Use royalty-free 3D food models (ensure licensing)

## 🔧 Configuration

### Environment Variables

The `.env` file contains all configuration:

```env
# Supabase (already configured)
SUPABASE_URL=https://ussbilgvodjabmzwenun.supabase.co
SUPABASE_KEY=sb_publishable_ZfRTijsVAsQkRUcdIv3aQQ__FsOMAOw
SUPABASE_DB_URL=postgresql://postgres:26h0VZVkzl5MMaoZ@db.ussbilgvodjabmzwenun.supabase.co:5432/postgres

# Application
APP_NAME=Restro3D
SECRET_KEY=your-secret-key-change-this-in-production
BASE_URL=http://localhost:8000  # Change to your domain in production

# File Upload
UPLOAD_DIR=uploads
MAX_FILE_SIZE=52428800  # 50MB

# CORS (comma-separated)
ALLOWED_ORIGINS=http://localhost:8000,http://localhost:3000
```

**Important for Production:**
- Change `SECRET_KEY` to a random string
- Update `BASE_URL` to your actual domain
- Update `ALLOWED_ORIGINS` to your domain

## 🌐 Deployment

### Docker Deployment

```bash
# Build and run with Docker Compose
docker-compose up -d

# Or build manually
docker build -t restro3d .
docker run -p 8000:8000 --env-file .env restro3d
```

### Cloud Deployment Options

#### 1. Railway.app (Recommended - Easy)
- Connect your GitHub repository
- Railway auto-detects Python app
- Add environment variables from `.env`
- Deploy automatically

#### 2. Render.com
- Create new Web Service
- Connect repository
- Build Command: `pip install -r requirements.txt`
- Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- Add environment variables

#### 3. AWS/Google Cloud/Azure
- Use Docker deployment method
- Set up cloud VM or container service
- Configure load balancer and domain
- Add SSL certificate

### After Deployment

1. Update `BASE_URL` in `.env` to your production URL
2. Update `ALLOWED_ORIGINS` to include your domain
3. Test QR code generation (it will use the new BASE_URL)
4. Regenerate QR codes for all restaurants

## 📱 AR Technology Explained

This application uses **Google's Model Viewer** which provides:

- **WebXR**: Modern web standard for AR experiences
- **AR Quick Look**: Native AR on iOS devices
- **Scene Viewer**: Native AR on Android devices (ARCore)
- **Fallback 3D Viewer**: Interactive 3D for devices without AR

### How It Works Without AR Sensors

Even on devices without AR sensors, users can:
- View full 3D models
- Rotate with finger drag
- Zoom with pinch gesture
- Auto-rotate for automatic viewing
- See realistic shadows and lighting

The experience is still immersive and helps customers make informed decisions!

## 🗄️ Database Schema

### restaurants
- `id`: UUID (primary key)
- `name`: Restaurant name
- `description`: Restaurant description
- `contact_email`: Contact email
- `contact_phone`: Contact phone
- `address`: Physical address
- `logo_url`: Logo image URL
- `qr_code_url`: Generated QR code URL
- `is_active`: Boolean status
- `created_at`: Timestamp
- `updated_at`: Timestamp

### menu_items
- `id`: UUID (primary key)
- `restaurant_id`: Foreign key to restaurants
- `name`: Item name
- `description`: Item description
- `price`: Price (float)
- `category`: Category (e.g., "Main Course")
- `image_url`: Preview image URL
- `glb_file_url`: 3D model file URL (GLB)
- `is_available`: Boolean availability
- `scale_factor`: 3D model scale (default: 1.0)
- `created_at`: Timestamp
- `updated_at`: Timestamp

## 🛠️ Tech Stack

- **Backend**: FastAPI (Python)
- **Database**: PostgreSQL (Supabase)
- **Frontend**: HTML, CSS, JavaScript (Vanilla)
- **3D/AR**: Google Model Viewer
- **QR Codes**: Python qrcode library
- **File Storage**: Local filesystem (can be upgraded to cloud storage)

## 📋 API Endpoints

### Restaurants
- `POST /api/restaurants` - Create restaurant
- `GET /api/restaurants` - List all restaurants
- `GET /api/restaurants/{id}` - Get restaurant details
- `PUT /api/restaurants/{id}` - Update restaurant
- `DELETE /api/restaurants/{id}` - Delete restaurant

### Menu Items
- `POST /api/restaurants/{id}/menu-items` - Add menu item
- `GET /api/restaurants/{id}/menu-items` - List restaurant's menu
- `GET /api/menu-items/{id}` - Get menu item details
- `PUT /api/menu-items/{id}` - Update menu item
- `DELETE /api/menu-items/{id}` - Delete menu item

### QR Codes
- `POST /api/restaurants/{id}/generate-qr` - Generate QR code
- `GET /api/restaurants/{id}/qr-code` - Get QR code image

## 🔒 Security Notes

- Change `SECRET_KEY` in production
- Use HTTPS in production (required for AR features)
- Consider adding authentication for admin dashboard
- Validate file uploads (already implemented for GLB files)
- Set appropriate CORS origins

## 🐛 Troubleshooting

### Database Connection Issues
- Verify Supabase credentials in `.env`
- Check if Supabase project is active
- Ensure IP is whitelisted in Supabase settings

### File Upload Issues
- Check `uploads` directory permissions
- Verify `MAX_FILE_SIZE` setting
- Ensure GLB files are valid

### AR Not Working
- **Requires HTTPS in production** (AR features need secure context)
- Check browser compatibility
- Ensure GLB file is properly formatted

### QR Code Not Generating
- Verify `BASE_URL` is correct
- Check upload directory permissions
- Ensure qrcode library is installed

## 📞 Support

For issues or questions:
1. Check this README first
2. Review error messages in the console
3. Verify all environment variables are set correctly

## 🎯 Future Enhancements

Potential features to add:
- [ ] User authentication for restaurant owners
- [ ] Multi-language support
- [ ] Order placement system
- [ ] Analytics dashboard
- [ ] Cloud storage for files (AWS S3, etc.)
- [ ] Email notifications
- [ ] Table management system
- [ ] Customer feedback/reviews
- [ ] Menu item availability scheduling

## 📄 License

This project is provided as-is for your use. Feel free to modify and enhance it for your needs!

## 🎉 Getting Started Checklist

- [x] Application installed and running
- [ ] Created first restaurant
- [ ] Generated QR code
- [ ] Added menu items with GLB files
- [ ] Tested QR code scanning
- [ ] Tested AR viewing on phone
- [ ] Ready for production deployment!

---

**Made with ❤️ for the restaurant industry**

Bringing menus to life, one scan at a time! 🍕📱✨
