"""
Configuration for Tukole backend.
Reads from environment variables (with .env file in development).
"""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Database
    database_url: str = "postgresql://tukole:tukole@localhost:5432/tukole"

    # App
    app_env: str = "development"
    secret_key: str = "dev-secret-change-me"
    public_base_url: str = "http://localhost:3000"

    # Twilio
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_whatsapp_from: str = "whatsapp:+14155238886"
    twilio_sms_from: str = ""

    # Mock mode for notifications
    mock_notifications: bool = True   # master switch — overrides the others
    mock_sms: bool = False             # mock only SMS (Twilio trial-friendly)
    mock_whatsapp: bool = False        # mock only WhatsApp

    # Platform economics (UGX)
    platform_fee_ugx: int = 1500
    rider_payout_ugx: int = 3500
    delivery_price_ugx: int = 5000
    cod_daily_cap_ugx: int = 500_000
    delivery_wait_minutes: int = 10


settings = Settings()