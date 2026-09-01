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

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
