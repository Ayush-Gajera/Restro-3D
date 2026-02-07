from pydantic_settings import BaseSettings
from typing import List
import os

class Settings(BaseSettings):
    # Application
    APP_NAME: str = "Restro3D"
    SECRET_KEY: str = "change-this-in-production"
    BASE_URL: str = "http://localhost:8000"
    
    # Supabase
    SUPABASE_URL: str
    SUPABASE_KEY: str
    SUPABASE_DB_URL: str
    
    # File Upload
    UPLOAD_DIR: str = "uploads"
    MAX_FILE_SIZE: int = 52428800  # 50MB
    
    # CORS - stored as string, parsed to list
    ALLOWED_ORIGINS: str = "http://localhost:8000,http://localhost:3000"
    
    class Config:
        env_file = ".env"
        case_sensitive = True
    
    def get_allowed_origins_list(self) -> List[str]:
        """Parse comma-separated origins string into list"""
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",")]

settings = Settings()
