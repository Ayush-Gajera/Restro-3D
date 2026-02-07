from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
import qrcode
from pathlib import Path
import uuid

from app.database import get_db, Restaurant
from app.core.config import settings

router = APIRouter()

@router.post("/restaurants/{restaurant_id}/generate-qr")
async def generate_qr_code(restaurant_id: str, db: Session = Depends(get_db)):
    """Generate QR code for a restaurant's menu"""
    
    # Verify restaurant exists
    restaurant = db.query(Restaurant).filter(Restaurant.id == restaurant_id).first()
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    
    # Generate QR code
    menu_url = f"{settings.BASE_URL}/menu/{restaurant_id}"
    
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=10,
        border=4,
    )
    qr.add_data(menu_url)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    
    # Save QR code
    qr_filename = f"qr_{restaurant_id}.png"
    qr_path = Path(settings.UPLOAD_DIR) / "qr_codes" / qr_filename
    img.save(qr_path)
    
    qr_url = f"/uploads/qr_codes/{qr_filename}"
    
    # Update restaurant with QR code URL
    restaurant.qr_code_url = qr_url
    db.commit()
    
    return {
        "qr_code_url": qr_url,
        "menu_url": menu_url,
        "message": "QR code generated successfully"
    }

@router.get("/restaurants/{restaurant_id}/qr-code")
async def get_qr_code(restaurant_id: str, db: Session = Depends(get_db)):
    """Get the QR code for a restaurant"""
    
    restaurant = db.query(Restaurant).filter(Restaurant.id == restaurant_id).first()
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    
    if not restaurant.qr_code_url:
        raise HTTPException(status_code=404, detail="QR code not generated yet")
    
    qr_path = Path(settings.UPLOAD_DIR) / "qr_codes" / f"qr_{restaurant_id}.png"
    
    if not qr_path.exists():
        raise HTTPException(status_code=404, detail="QR code file not found")
    
    return FileResponse(qr_path, media_type="image/png")
