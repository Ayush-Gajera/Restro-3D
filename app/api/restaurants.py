from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime
import aiofiles
import os
from pathlib import Path
import uuid

from app.database import get_db, Restaurant
from app.core.config import settings

router = APIRouter()

# Pydantic models
class RestaurantCreate(BaseModel):
    name: str
    description: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    address: Optional[str] = None

class RestaurantResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    contact_email: Optional[str]
    contact_phone: Optional[str]
    address: Optional[str]
    logo_url: Optional[str]
    qr_code_url: Optional[str]
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

@router.post("/restaurants", response_model=RestaurantResponse)
async def create_restaurant(
    name: str = Form(...),
    description: Optional[str] = Form(None),
    contact_email: Optional[str] = Form(None),
    contact_phone: Optional[str] = Form(None),
    address: Optional[str] = Form(None),
    logo: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db)
):
    """Create a new restaurant"""
    
    # Handle logo upload
    logo_url = None
    if logo:
        file_extension = logo.filename.split(".")[-1]
        unique_filename = f"{uuid.uuid4()}.{file_extension}"
        file_path = Path(settings.UPLOAD_DIR) / "images" / unique_filename
        
        async with aiofiles.open(file_path, "wb") as f:
            content = await logo.read()
            await f.write(content)
        
        logo_url = f"/uploads/images/{unique_filename}"
    
    # Create restaurant
    restaurant = Restaurant(
        id=str(uuid.uuid4()),
        name=name,
        description=description,
        contact_email=contact_email,
        contact_phone=contact_phone,
        address=address,
        logo_url=logo_url
    )
    
    db.add(restaurant)
    db.commit()
    db.refresh(restaurant)
    
    return restaurant

@router.get("/restaurants", response_model=List[RestaurantResponse])
async def list_restaurants(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """List all restaurants"""
    restaurants = db.query(Restaurant).offset(skip).limit(limit).all()
    return restaurants

@router.get("/restaurants/{restaurant_id}", response_model=RestaurantResponse)
async def get_restaurant(restaurant_id: str, db: Session = Depends(get_db)):
    """Get a specific restaurant"""
    restaurant = db.query(Restaurant).filter(Restaurant.id == restaurant_id).first()
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    return restaurant

@router.put("/restaurants/{restaurant_id}", response_model=RestaurantResponse)
async def update_restaurant(
    restaurant_id: str,
    name: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    contact_email: Optional[str] = Form(None),
    contact_phone: Optional[str] = Form(None),
    address: Optional[str] = Form(None),
    logo: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db)
):
    """Update a restaurant"""
    restaurant = db.query(Restaurant).filter(Restaurant.id == restaurant_id).first()
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    
    # Update fields
    if name:
        restaurant.name = name
    if description is not None:
        restaurant.description = description
    if contact_email is not None:
        restaurant.contact_email = contact_email
    if contact_phone is not None:
        restaurant.contact_phone = contact_phone
    if address is not None:
        restaurant.address = address
    
    # Handle logo upload
    if logo:
        file_extension = logo.filename.split(".")[-1]
        unique_filename = f"{uuid.uuid4()}.{file_extension}"
        file_path = Path(settings.UPLOAD_DIR) / "images" / unique_filename
        
        async with aiofiles.open(file_path, "wb") as f:
            content = await logo.read()
            await f.write(content)
        
        restaurant.logo_url = f"/uploads/images/{unique_filename}"
    
    db.commit()
    db.refresh(restaurant)
    
    return restaurant

@router.delete("/restaurants/{restaurant_id}")
async def delete_restaurant(restaurant_id: str, db: Session = Depends(get_db)):
    """Delete a restaurant"""
    restaurant = db.query(Restaurant).filter(Restaurant.id == restaurant_id).first()
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    
    db.delete(restaurant)
    db.commit()
    
    return {"message": "Restaurant deleted successfully"}
