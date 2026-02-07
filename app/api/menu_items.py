from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime
import aiofiles
from pathlib import Path
import uuid

from app.database import get_db, MenuItem, Restaurant
from app.core.config import settings

router = APIRouter()

# Pydantic models
class MenuItemResponse(BaseModel):
    id: str
    restaurant_id: str
    name: str
    description: Optional[str]
    price: float
    category: Optional[str]
    image_url: Optional[str]
    glb_file_url: str
    is_available: bool
    scale_factor: float
    created_at: datetime
    
    class Config:
        from_attributes = True

@router.post("/restaurants/{restaurant_id}/menu-items", response_model=MenuItemResponse)
async def create_menu_item(
    restaurant_id: str,
    name: str = Form(...),
    price: float = Form(...),
    description: Optional[str] = Form(None),
    category: Optional[str] = Form(None),
    scale_factor: float = Form(1.0),
    glb_file: UploadFile = File(...),
    image: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db)
):
    """Create a new menu item with GLB file"""
    
    # Verify restaurant exists
    restaurant = db.query(Restaurant).filter(Restaurant.id == restaurant_id).first()
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    
    # Handle GLB file upload
    if not glb_file.filename.endswith('.glb'):
        raise HTTPException(status_code=400, detail="Only GLB files are supported")
    
    glb_unique_filename = f"{uuid.uuid4()}.glb"
    glb_file_path = Path(settings.UPLOAD_DIR) / "glb" / glb_unique_filename
    
    async with aiofiles.open(glb_file_path, "wb") as f:
        content = await glb_file.read()
        await f.write(content)
    
    glb_url = f"/uploads/glb/{glb_unique_filename}"
    
    # Handle image upload
    image_url = None
    if image:
        file_extension = image.filename.split(".")[-1]
        image_unique_filename = f"{uuid.uuid4()}.{file_extension}"
        image_file_path = Path(settings.UPLOAD_DIR) / "images" / image_unique_filename
        
        async with aiofiles.open(image_file_path, "wb") as f:
            content = await image.read()
            await f.write(content)
        
        image_url = f"/uploads/images/{image_unique_filename}"
    
    # Create menu item
    menu_item = MenuItem(
        id=str(uuid.uuid4()),
        restaurant_id=restaurant_id,
        name=name,
        description=description,
        price=price,
        category=category,
        image_url=image_url,
        glb_file_url=glb_url,
        scale_factor=scale_factor
    )
    
    db.add(menu_item)
    db.commit()
    db.refresh(menu_item)
    
    return menu_item

@router.get("/restaurants/{restaurant_id}/menu-items", response_model=List[MenuItemResponse])
async def list_menu_items(
    restaurant_id: str,
    category: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """List all menu items for a restaurant"""
    query = db.query(MenuItem).filter(MenuItem.restaurant_id == restaurant_id)
    
    if category:
        query = query.filter(MenuItem.category == category)
    
    menu_items = query.all()
    return menu_items

@router.get("/menu-items/{item_id}", response_model=MenuItemResponse)
async def get_menu_item(item_id: str, db: Session = Depends(get_db)):
    """Get a specific menu item"""
    menu_item = db.query(MenuItem).filter(MenuItem.id == item_id).first()
    if not menu_item:
        raise HTTPException(status_code=404, detail="Menu item not found")
    return menu_item

@router.put("/menu-items/{item_id}", response_model=MenuItemResponse)
async def update_menu_item(
    item_id: str,
    name: Optional[str] = Form(None),
    price: Optional[float] = Form(None),
    description: Optional[str] = Form(None),
    category: Optional[str] = Form(None),
    scale_factor: Optional[float] = Form(None),
    is_available: Optional[bool] = Form(None),
    glb_file: Optional[UploadFile] = File(None),
    image: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db)
):
    """Update a menu item"""
    menu_item = db.query(MenuItem).filter(MenuItem.id == item_id).first()
    if not menu_item:
        raise HTTPException(status_code=404, detail="Menu item not found")
    
    # Update fields
    if name:
        menu_item.name = name
    if price is not None:
        menu_item.price = price
    if description is not None:
        menu_item.description = description
    if category is not None:
        menu_item.category = category
    if scale_factor is not None:
        menu_item.scale_factor = scale_factor
    if is_available is not None:
        menu_item.is_available = is_available
    
    # Handle GLB file upload
    if glb_file:
        if not glb_file.filename.endswith('.glb'):
            raise HTTPException(status_code=400, detail="Only GLB files are supported")
        
        glb_unique_filename = f"{uuid.uuid4()}.glb"
        glb_file_path = Path(settings.UPLOAD_DIR) / "glb" / glb_unique_filename
        
        async with aiofiles.open(glb_file_path, "wb") as f:
            content = await glb_file.read()
            await f.write(content)
        
        menu_item.glb_file_url = f"/uploads/glb/{glb_unique_filename}"
    
    # Handle image upload
    if image:
        file_extension = image.filename.split(".")[-1]
        image_unique_filename = f"{uuid.uuid4()}.{file_extension}"
        image_file_path = Path(settings.UPLOAD_DIR) / "images" / image_unique_filename
        
        async with aiofiles.open(image_file_path, "wb") as f:
            content = await image.read()
            await f.write(content)
        
        menu_item.image_url = f"/uploads/images/{image_unique_filename}"
    
    db.commit()
    db.refresh(menu_item)
    
    return menu_item

@router.delete("/menu-items/{item_id}")
async def delete_menu_item(item_id: str, db: Session = Depends(get_db)):
    """Delete a menu item"""
    menu_item = db.query(MenuItem).filter(MenuItem.id == item_id).first()
    if not menu_item:
        raise HTTPException(status_code=404, detail="Menu item not found")
    
    db.delete(menu_item)
    db.commit()
    
    return {"message": "Menu item deleted successfully"}
