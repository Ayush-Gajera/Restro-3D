from sqlalchemy import create_engine, Column, String, Text, DateTime, Float, Boolean, Integer
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.sql import func
from datetime import datetime
from app.core.config import settings
import uuid

# SQLAlchemy setup
engine = create_engine(settings.SUPABASE_DB_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Database Models
class Restaurant(Base):
    __tablename__ = "restaurants"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), nullable=False)
    description = Column(Text)
    contact_email = Column(String(255))
    contact_phone = Column(String(50))
    address = Column(Text)
    logo_url = Column(String(500))
    qr_code_url = Column(String(500))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class MenuItem(Base):
    __tablename__ = "menu_items"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    restaurant_id = Column(String, nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    price = Column(Float, nullable=False)
    category = Column(String(100))  # e.g., "Appetizer", "Main Course", "Dessert"
    image_url = Column(String(500))
    glb_file_url = Column(String(500), nullable=False)  # 3D model file
    is_available = Column(Boolean, default=True)
    scale_factor = Column(Float, default=1.0)  # For adjusting 3D model size
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

# Database initialization
async def init_db():
    """Initialize database tables"""
    try:
        Base.metadata.create_all(bind=engine)
        print("✅ Database tables created successfully")
    except Exception as e:
        print(f"❌ Error creating tables: {e}")

def get_db():
    """Get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
