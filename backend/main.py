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
import models
from schemas import HealthResponse
from routers import abdm, chat, ocr, triage, custom_auth, auth_firebase, opd
from routers.opd import seed_doctors_if_needed

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
            if "structured_summary" not in columns:
                conn.execute(text("ALTER TABLE patient_sessions ADD COLUMN structured_summary JSON"))
            if "assigned_doctor_id" not in columns:
                conn.execute(text("ALTER TABLE patient_sessions ADD COLUMN assigned_doctor_id VARCHAR(50)"))
            if "assigned_doctor_name" not in columns:
                conn.execute(text("ALTER TABLE patient_sessions ADD COLUMN assigned_doctor_name VARCHAR(100)"))
            if "assigned_doctor_specialty" not in columns:
                conn.execute(text("ALTER TABLE patient_sessions ADD COLUMN assigned_doctor_specialty VARCHAR(100)"))
            if "assigned_doctor_post" not in columns:
                conn.execute(text("ALTER TABLE patient_sessions ADD COLUMN assigned_doctor_post VARCHAR(100)"))
            if "assigned_doctor_room" not in columns:
                conn.execute(text("ALTER TABLE patient_sessions ADD COLUMN assigned_doctor_room VARCHAR(50)"))
            if "assigned_doctor_fee" not in columns:
                conn.execute(text("ALTER TABLE patient_sessions ADD COLUMN assigned_doctor_fee VARCHAR(50)"))
            if "queue_token" not in columns:
                conn.execute(text("ALTER TABLE patient_sessions ADD COLUMN queue_token VARCHAR(50)"))
            if "queue_status" not in columns:
                conn.execute(text("ALTER TABLE patient_sessions ADD COLUMN queue_status VARCHAR(50) DEFAULT 'none'"))
            if "queue_assigned_at" not in columns:
                conn.execute(text("ALTER TABLE patient_sessions ADD COLUMN queue_assigned_at TIMESTAMP"))
            conn.commit()

    if "abha_users" in inspector.get_table_names():
        abha_cols = [c["name"] for c in inspector.get_columns("abha_users")]
        with engine.connect() as conn:
            if "address" not in abha_cols:
                conn.execute(text("ALTER TABLE abha_users ADD COLUMN address TEXT"))
            if "district" not in abha_cols:
                conn.execute(text("ALTER TABLE abha_users ADD COLUMN district VARCHAR(50)"))
            if "state" not in abha_cols:
                conn.execute(text("ALTER TABLE abha_users ADD COLUMN state VARCHAR(50)"))
            if "pincode" not in abha_cols:
                conn.execute(text("ALTER TABLE abha_users ADD COLUMN pincode VARCHAR(10)"))
            if "blood_group" not in abha_cols:
                conn.execute(text("ALTER TABLE abha_users ADD COLUMN blood_group VARCHAR(10) DEFAULT 'B+'"))
            if "allergies" not in abha_cols:
                conn.execute(text("ALTER TABLE abha_users ADD COLUMN allergies TEXT DEFAULT 'No Known Allergies'"))
            if "profile_photo" not in abha_cols:
                conn.execute(text("ALTER TABLE abha_users ADD COLUMN profile_photo TEXT"))
            if "login_pin" not in abha_cols:
                conn.execute(text("ALTER TABLE abha_users ADD COLUMN login_pin VARCHAR(10) DEFAULT '123456'"))
                print("Migration: Added column login_pin to abha_users")
            conn.commit()

try:
    migrate_database()
except Exception as e:
    print(f"Migration warning: {e}")

Base.metadata.create_all(bind=engine)

# Seed initial doctors
try:
    with engine.connect() as conn:
        pass
    from database import SessionLocal
    _init_db = SessionLocal()
    seed_doctors_if_needed(_init_db)
    _init_db.close()
except Exception as e:
    print(f"Doctor seed warning: {e}")

# Deduplicate any conflicting patient tokens across rooms
try:
    from database import SessionLocal
    from utils.queue_token import deduplicate_sessions_for_room
    from models import Doctor, PatientSession
    _dedup_db = SessionLocal()
    doc_rooms = [d.room_number for d in _dedup_db.query(Doctor).all() if d.room_number]
    sess_rooms = [r[0] for r in _dedup_db.query(PatientSession.assigned_doctor_room).distinct().all() if r[0]]
    for rm in set(doc_rooms + sess_rooms):
        deduplicate_sessions_for_room(_dedup_db, rm)
    _dedup_db.close()
except Exception as e:
    print(f"Token deduplication notice: {e}")

import asyncio
import logging
from contextlib import asynccontextmanager

logger = logging.getLogger("main")

async def neon_keep_alive_worker():
    """
    Method B: Automated Background Keep-Alive Ping for Neon PostgreSQL.
    Pings the database every 200 seconds (~3.3 minutes) with SELECT 1;.
    Neon autosuspends after 300 seconds (5 minutes) of 0 activity.
    By executing a lightweight query every ~3.3 minutes, the Neon compute
    node stays warm 24/7 and never goes to sleep.
    """
    logger.info("Neon Keep-Alive Worker initialized: Pinging database every 200s to prevent autosuspend.")
    while True:
        await asyncio.sleep(200)
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1;"))
            logger.info("[NEON-HEARTBEAT] Pinged Neon database successfully. Compute kept active.")
        except Exception as e:
            logger.warning(f"[NEON-HEARTBEAT] Keep-alive ping failed or reconnecting: {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Only launch background keep-alive worker if not running in ephemeral serverless (e.g. Vercel)
    worker_task = None
    if not os.environ.get("VERCEL"):
        worker_task = asyncio.create_task(neon_keep_alive_worker())
    yield
    # Clean shutdown
    if worker_task:
        worker_task.cancel()

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Backend API for Smart India Hackathon AarogyaMitra Multilingual Healthcare Kiosk",
    version="1.0.0",
    lifespan=lifespan
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
app.include_router(custom_auth.router)
app.include_router(auth_firebase.router)
app.include_router(abdm.router)
app.include_router(chat.router)
app.include_router(ocr.router)
app.include_router(triage.router)
app.include_router(opd.router)

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
