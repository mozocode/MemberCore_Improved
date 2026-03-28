from typing import Optional
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 7  # 7 days
    super_admin_email: str = "admin@example.com"
    google_client_ids: Optional[str] = None

    # Firebase - use service account JSON path or env vars
    firebase_credentials_path: Optional[str] = None

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
