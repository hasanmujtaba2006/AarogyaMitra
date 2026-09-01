import os
import sys

# Ensure backend directory is in sys.path so local imports work regardless of run directory
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

import datetime
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

from config import settings
from database import engine, Base, get_db
from schemas import HealthResponse
from routers import abdm, chat, ocr, triage

# Create database tables at startup and migrate if needed
def migrate_database():
    from sqlalchemy import inspect, text
    inspector = inspect(engine)
    if "patient_sessions" in inspector.get_table_names():
        columns = [c["name"] for c in inspector.get_columns("patient_sessions")]
        with engine.connect() as conn:
            if "doctor_notes" not in columns:
                conn.execute(text("ALTER TABLE patient_sessions ADD COLUMN doctor_notes TEXT"))
                print("Migration: Added column doctor_notes to patient_sessions")
            if "doctor_prescription" not in columns:
                conn.execute(text("ALTER TABLE patient_sessions ADD COLUMN doctor_prescription TEXT"))
                print("Migration: Added column doctor_prescription to patient_sessions")
            conn.commit()

try:
    migrate_database()
except Exception as e:
    print(f"Migration warning: {e}")

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Backend API for Smart India Hackathon AarogyaMitra Multilingual Healthcare Kiosk",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust this in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(abdm.router)
app.include_router(chat.router)
app.include_router(ocr.router)
app.include_router(triage.router)

@app.get("/")
def read_root():
    return {
        "message": "Welcome to AarogyaMitra Healthcare Kiosk API",
        "health_check_url": "/api/health",
        "docs_url": "/docs"
    }

@app.get("/api/health", response_model=HealthResponse)
def health_check(db: Session = Depends(get_db)):
    db_status = "healthy"
    try:
        # Simple query to verify database connection
        db.execute(text("SELECT 1"))
    except Exception as e:
        db_status = f"unhealthy: {str(e)}"
        raise HTTPException(
            status_code=500,
            detail=HealthResponse(
                status="unhealthy",
                timestamp=datetime.datetime.utcnow(),
                database=db_status
            ).model_dump()
        )

    return HealthResponse(
        status="healthy",
        timestamp=datetime.datetime.utcnow(),
        database=db_status
    )
