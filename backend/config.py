import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "AarogyaMitra Kiosk API"
    DEBUG: bool = True
    
    # Database Configuration: Default to local SQLite fallback if DATABASE_URL is not set
    DATABASE_URL: str = "sqlite:///./aarogyamitra.db"
    
    # AI APIs (Groq or OpenAI)
    GROQ_API_KEY: str = ""
    OPENAI_API_KEY: str = ""
    
    # Bhashini translation API keys / endpoint
    BHASHINI_USER_ID: str = ""
    BHASHINI_API_KEY: str = ""
    BHASHINI_PIPELINE_ID: str = ""
    
    # Webhooks & Integrations
    TRIAGE_WEBHOOK_URL: str = "http://localhost:8000/api/triage/alert-triage"
    
    # ABDM (Ayushman Bharat Digital Mission) Configuration
    ABDM_CLIENT_ID: str = ""
    ABDM_CLIENT_SECRET: str = ""
    ABDM_GATEWAY_URL: str = "https://dev.abdm.gov.in/gateway/v0.5"
    ABDM_SANDBOX_BASE: str = "https://abhasbx.abdm.gov.in/abha/api/v1"
    ABDM_SIMULATION_MODE: bool = True

    # Real OTP & SMS Gateways (Fast2SMS, Twilio, 2Factor)
    FAST2SMS_API_KEY: str = ""
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_PHONE_NUMBER: str = ""
    TWOFACTOR_API_KEY: str = ""
    
    # Custom Auth & JWT Security
    JWT_SECRET: str = "aarogya-mitra-secret-key-2026"
    OTP_EXPIRY_SECONDS: int = 300 # 5 minutes
    OTP_COOLDOWN_SECONDS: int = 30 # 30 seconds

    # Firebase Authentication
    FIREBASE_CREDENTIALS_PATH: str = "firebase-service-account.json"
    FIREBASE_PROJECT_ID: str = ""

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
