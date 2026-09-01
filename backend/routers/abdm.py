import datetime
import logging
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database import get_db
from models import AbhaUser, PatientSession
from schemas import PatientSessionCreate

logger = logging.getLogger("abdm")
router = APIRouter(prefix="/api/abdm", tags=["ABDM Sandbox Mock"])

class AbhaLookupRequest(BaseModel):
    abha_id: str

class OtpVerifyRequest(BaseModel):
    abha_id: str
    otp: str

# Mock ABDM database seeding helper
def seed_mock_abha_user(db: Session, abha_id: str) -> AbhaUser:
    """Helper to check and seed mock ABHA patient details in the database."""
    import random
    cleaned = abha_id.strip()
    
    # Check if user already exists
    user = db.query(AbhaUser).filter(
        (AbhaUser.abha_address == cleaned) | (AbhaUser.abha_number == cleaned)
    ).first()
    
    if not user:
        abha_addr = cleaned if "@" in cleaned else f"{cleaned}@abdm"
        abha_num = cleaned if "-" in cleaned else f"91-{random.randint(1000, 9999)}-{random.randint(1000, 9999)}-{random.randint(1000, 9999)}"
        
        # Check conflicts to prevent unique violation
        existing = db.query(AbhaUser).filter(
            (AbhaUser.abha_address == abha_addr) | (AbhaUser.abha_number == abha_num)
        ).first()
        if existing:
            return existing
            
        # Capitalize and format name from the username entered
        username_part = abha_addr.split("@")[0]
        formatted_name = username_part.replace("_", " ").replace(".", " ").title()
        
        # Seed a mock user
        user = AbhaUser(
            abha_address=abha_addr,
            abha_number=abha_num,
            full_name=formatted_name,
            gender="F" if any(x in username_part.lower() for x in ["priya", "sita", "rita", "female"]) else "M",
            date_of_birth="1995-05-15",
            mobile_number=f"+9198765{random.randint(10000, 99999)}"
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        
    return user

@router.post("/lookup-abha")
def lookup_abha(payload: AbhaLookupRequest, db: Session = Depends(get_db)):
    """
    ABDM M1: Look up ABHA account ID/Address.
    If the address is valid, trigger simulated OTP generation.
    """
    if not payload.abha_id:
        raise HTTPException(status_code=400, detail="ABHA ID is required")
        
    user = seed_mock_abha_user(db, payload.abha_id)
    
    logger.info(f"ABDM: Looked up ABHA user '{user.abha_address}'. OTP code sent to registered mobile.")
    
    return {
        "status": "otp_sent",
        "message": f"Simulated OTP sent to registered number ending in {user.mobile_number[-4:]} (Use OTP: 123456)"
    }

@router.post("/verify-otp")
def verify_otp(payload: OtpVerifyRequest, db: Session = Depends(get_db)):
    """
    ABDM M1: Verify OTP and fetch complete ABHA patient profile data.
    """
    if payload.otp != "123456":
        raise HTTPException(status_code=400, detail="Invalid OTP code. Use 123456 for testing.")
        
    user = seed_mock_abha_user(db, payload.abha_id)
    
    return {
        "status": "success",
        "message": "OTP verified successfully",
        "patient": {
            "id": user.id,
            "abha_address": user.abha_address,
            "abha_number": user.abha_number,
            "full_name": user.full_name,
            "gender": user.gender,
            "date_of_birth": user.date_of_birth,
            "mobile_number": user.mobile_number
        }
    }

@router.post("/create-session")
def create_session(payload: PatientSessionCreate, db: Session = Depends(get_db)):
    """
    Initializes a database session tracking the active kiosk consultation.
    """
    # Check if session exists
    session = db.query(PatientSession).filter(PatientSession.id == payload.id).first()
    if session:
        return {"status": "exists", "message": "Session already active"}

    try:
        new_session = PatientSession(
            id=payload.id,
            abha_id=payload.abha_id,
            language=payload.language,
            status="active"
        )
        db.add(new_session)
        db.commit()
        logger.info(f"Kiosk: Initialized active session '{payload.id}' for ABHA User ID: {payload.abha_id}")
        return {"status": "success", "message": "Active patient session initialized"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to initialize session: {str(e)}")

# --- SCROLLING SCRIPTS FOR M2 & M3 SANDBOX COMPLIANCE ---

@router.post("/m2/link-care-context")
def link_care_context(session_id: str, db: Session = Depends(get_db)):
    """
    ABDM M2: Link Kiosk OPD record context to hospital system (Care Context Linking).
    """
    session = db.query(PatientSession).filter(PatientSession.id == session_id).first()
    if not session:
         raise HTTPException(status_code=404, detail="Session not found")
         
    return {
        "status": "linked",
        "care_context": {
            "referenceNumber": f"OPD-{session.id[:8].upper()}",
            "display": "AarogyaMitra OPD Consultation Kiosk"
        },
        "linked_at": datetime.datetime.utcnow().isoformat()
    }

@router.get("/m3/fetch-health-data")
def fetch_health_data(session_id: str, db: Session = Depends(get_db)):
    """
    ABDM M3: Health Document Exchange (FHIR report access).
    """
    session = db.query(PatientSession).filter(PatientSession.id == session_id).first()
    if not session:
         raise HTTPException(status_code=404, detail="Session not found")
         
    return {
        "status": "exchanged",
        "fhir_bundle": session.fhir_bundle or {},
        "dpdp_compliant": True,
        "consent_token": f"consent-{session.id[:8]}"
    }
