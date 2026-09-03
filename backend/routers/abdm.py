import datetime
import json
import logging
import random
import uuid
from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from config import settings
from database import get_db
from models import AbhaUser, PatientSession
from schemas import (
    AbhaAuthInitRequest,
    AbhaAuthConfirmRequest,
    AbhaQrVerifyRequest,
    PatientSessionCreate,
    SessionLanguageUpdate
)

logger = logging.getLogger("abdm")
router = APIRouter(prefix="/api/abdm", tags=["ABDM ABHA Verification"])

# Standard pre-configured Indian patient demo personas for rapid kiosk testing & evaluation
DEMO_PERSONAS = [
    {
        "id": "demo_hasan",
        "name": "Hasan Mujtaba",
        "age": 19,
        "gender": "M",
        "dob": "2007-05-14",
        "abha_number": "91-8841-9204-7210",
        "abha_address": "hasan.m@abdm",
        "mobile": "+919876543210",
        "location": "Mathurapur, Bareilly",
        "district": "Bareilly",
        "state": "Uttar Pradesh",
        "pincode": "243001",
        "blood_group": "B+",
        "allergies": "No Known Allergies",
        "auth_method": "AADHAAR_OTP"
    },
    {
        "id": "demo_1",
        "name": "Rajesh Kumar",
        "age": 45,
        "gender": "M",
        "dob": "1979-04-12",
        "abha_number": "91-4521-8932-1049",
        "abha_address": "rajesh.kumar@abdm",
        "mobile": "+919876543210",
        "location": "House 42, Ganga Ghat Road",
        "district": "Varanasi",
        "state": "Uttar Pradesh",
        "pincode": "221001",
        "blood_group": "O+",
        "allergies": "Penicillin, Dust",
        "auth_method": "AADHAAR_OTP"
    },
    {
        "id": "demo_2",
        "name": "Sunita Devi",
        "age": 38,
        "gender": "F",
        "dob": "1986-09-24",
        "abha_number": "91-7812-3490-5621",
        "abha_address": "sunita.devi@abdm",
        "mobile": "+919812345678",
        "location": "Flat 104, Ashok Nagar",
        "district": "Patna",
        "state": "Bihar",
        "pincode": "800001",
        "blood_group": "A+",
        "allergies": "Sulfa drugs",
        "auth_method": "MOBILE_OTP"
    },
    {
        "id": "demo_3",
        "name": "Dr. Anand Menon",
        "age": 52,
        "gender": "M",
        "dob": "1972-11-05",
        "abha_number": "91-1029-3847-5610",
        "abha_address": "anand.menon@abdm",
        "mobile": "+919745123987",
        "location": "Near Shiva Temple, MG Road",
        "district": "Ernakulam",
        "state": "Kerala",
        "pincode": "682016",
        "blood_group": "AB+",
        "allergies": "No Known Allergies",
        "auth_method": "QR_CODE"
    },
    {
        "id": "demo_4",
        "name": "Pooja Sharma",
        "age": 27,
        "gender": "F",
        "dob": "1997-02-18",
        "abha_number": "91-6382-9104-7253",
        "abha_address": "pooja.sharma@abdm",
        "mobile": "+919654128790",
        "location": "Sector 4, Mansarovar",
        "district": "Jaipur",
        "state": "Rajasthan",
        "pincode": "302020",
        "blood_group": "B-",
        "allergies": "Peanuts",
        "auth_method": "AADHAAR_OTP"
    }
]

def format_abha_number(num_str: str) -> str:
    """Formats numeric string into 14-digit ABDM standard XX-XXXX-XXXX-XXXX."""
    digits = "".join(c for c in num_str if c.isdigit())
    if len(digits) == 14:
        return f"{digits[:2]}-{digits[2:6]}-{digits[6:10]}-{digits[10:]}"
    elif len(digits) == 12: # 12-digit without prefix 91
        return f"91-{digits[:4]}-{digits[4:8]}-{digits[8:]}"
    return num_str

def mask_phone_number(phone: str) -> str:
    """Masks mobile number leaving country code and last 4 digits visible."""
    clean = "".join(c for c in phone if c.isdigit())
    if len(clean) >= 10:
        last4 = clean[-4:]
        return f"+91 ******{last4}"
    return "+91 ******3210"

def get_or_create_abha_user(
    db: Session,
    abha_id: str,
    auth_method: str = "DEMO",
    overrides: Optional[Dict[str, Any]] = None
) -> AbhaUser:
    """Retrieves or creates an AbhaUser record in the database."""
    cleaned = abha_id.strip()
    
    # Check if this matches a predefined demo persona
    for persona in DEMO_PERSONAS:
        if cleaned in [persona["abha_number"], persona["abha_address"], persona["id"]]:
            existing = db.query(AbhaUser).filter(
                (AbhaUser.abha_number == persona["abha_number"]) | 
                (AbhaUser.abha_address == persona["abha_address"])
            ).first()
            if existing:
                existing.auth_method = auth_method or persona["auth_method"]
                existing.verification_status = "VERIFIED"
                db.commit()
                db.refresh(existing)
                return existing
            
            user = AbhaUser(
                abha_number=persona["abha_number"],
                abha_address=persona["abha_address"],
                full_name=persona["name"],
                gender=persona["gender"],
                date_of_birth=persona["dob"],
                mobile_number=persona["mobile"],
                address=persona["location"],
                district=persona["district"],
                state=persona["state"],
                pincode=persona["pincode"],
                blood_group=persona.get("blood_group", "B+"),
                allergies=persona.get("allergies", "No Known Allergies"),
                auth_method=auth_method or persona["auth_method"],
                verification_status="VERIFIED"
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            return user

    # Query by address or number
    user = db.query(AbhaUser).filter(
        (AbhaUser.abha_address == cleaned) | (AbhaUser.abha_number == cleaned)
    ).first()

    if not user:
        if "@" in cleaned:
            abha_addr = cleaned
            prefix_digits = f"{random.randint(1000, 9999)}-{random.randint(1000, 9999)}-{random.randint(1000, 9999)}"
            abha_num = f"91-{prefix_digits}"
        else:
            abha_num = format_abha_number(cleaned)
            username_clean = "".join(c for c in cleaned if c.isalnum()).lower()[:10]
            abha_addr = f"{username_clean or 'user'}@abdm"

        # Check again to avoid unique constraint violations
        existing = db.query(AbhaUser).filter(
            (AbhaUser.abha_address == abha_addr) | (AbhaUser.abha_number == abha_num)
        ).first()
        if existing:
            return existing

        username_part = abha_addr.split("@")[0]
        formatted_name = username_part.replace("_", " ").replace(".", " ").title()

        user = AbhaUser(
            abha_address=abha_addr,
            abha_number=abha_num,
            full_name=overrides.get("full_name", formatted_name) if overrides else formatted_name,
            gender=overrides.get("gender", "M") if overrides else ("F" if any(x in username_part.lower() for x in ["priya", "sita", "rita", "devi", "female"]) else "M"),
            date_of_birth=overrides.get("date_of_birth", "1992-06-15") if overrides else "1992-06-15",
            mobile_number=overrides.get("mobile_number", f"+9198765{random.randint(10000, 99999)}") if overrides else f"+9198765{random.randint(10000, 99999)}",
            address=overrides.get("address", "Sector 14, Main Road") if overrides else "Sector 14, Main Road",
            district=overrides.get("district", "New Delhi") if overrides else "New Delhi",
            state=overrides.get("state", "Delhi") if overrides else "Delhi",
            pincode=overrides.get("pincode", "110001") if overrides else "110001",
            blood_group=overrides.get("blood_group", "B+") if overrides else "B+",
            allergies=overrides.get("allergies", "No Known Allergies") if overrides else "No Known Allergies",
            profile_photo=overrides.get("profile_photo", None) if overrides else None,
            auth_method=auth_method,
            verification_status="VERIFIED"
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    return user


# --- ABDM M1 ENDPOINTS ---

@router.get("/demo-profiles")
def get_demo_profiles():
    """
    Returns pre-configured realistic Indian patient personas for 1-click kiosk verification and testing.
    """
    results = []
    for p in DEMO_PERSONAS:
        qr_payload = {
            "hidn": p["abha_number"],
            "hid": p["abha_address"],
            "name": p["name"],
            "gender": p["gender"],
            "dob": p["dob"],
            "mobile": p["mobile"],
            "address": p["location"],
            "dist_name": p["district"],
            "state_name": p["state"],
            "pincode": p["pincode"],
            "blood_group": p.get("blood_group", "B+"),
            "allergies": p.get("allergies", "No Known Allergies")
        }
        results.append({
            "id": p["id"],
            "name": p["name"],
            "age": p["age"],
            "gender": p["gender"],
            "abha_address": p["abha_address"],
            "abha_number": p["abha_number"],
            "location": p["location"],
            "district": p["district"],
            "state": p["state"],
            "mobile": p["mobile"],
            "dob": p["dob"],
            "blood_group": p.get("blood_group", "B+"),
            "allergies": p.get("allergies", "No Known Allergies"),
            "sample_qr": json.dumps(qr_payload)
        })
    return {"status": "success", "profiles": results}


@router.post("/init-auth")
def init_auth(payload: AbhaAuthInitRequest, db: Session = Depends(get_db)):
    """
    ABDM M1: Initializes ABHA verification session for 14-digit ABHA Number or ABHA Address.
    Generates transaction ID (txn_id) and simulates OTP transmission.
    """
    cleaned_id = payload.abha_id.strip()
    if not cleaned_id:
        raise HTTPException(status_code=400, detail="ABHA ID or Number is required")

    # Seed or fetch user
    user = get_or_create_abha_user(db, cleaned_id, auth_method=payload.auth_mode.upper())
    
    txn_id = f"txn-{uuid.uuid4().hex[:12]}"
    masked_mobile = mask_phone_number(user.mobile_number)
    mode_label = "Aadhaar OTP" if payload.auth_mode == "aadhaar_otp" else "Mobile OTP"

    logger.info(f"ABDM M1 Auth Init: ID='{cleaned_id}', Mode='{payload.auth_mode}', txn_id='{txn_id}'")

    return {
        "status": "otp_sent",
        "txn_id": txn_id,
        "auth_mode": payload.auth_mode,
        "masked_mobile": masked_mobile,
        "message": f"Simulated OTP sent via {mode_label} to {masked_mobile}. (Use Demo OTP: 123456)",
        "demo_otp": "123456"
    }


@router.post("/confirm-auth")
def confirm_auth(payload: AbhaAuthConfirmRequest, db: Session = Depends(get_db)):
    """
    ABDM M1: Confirms OTP and returns verified ABHA patient demographic profile.
    """
    if payload.otp != "123456":
        raise HTTPException(status_code=400, detail="Invalid OTP code. Please enter 123456 for test verification.")

    user = get_or_create_abha_user(db, payload.abha_id)
    user.verification_status = "VERIFIED"
    db.commit()
    db.refresh(user)

    logger.info(f"ABDM M1 Auth Confirmed: ABHA '{user.abha_address}', Number '{user.abha_number}'")

    return {
        "status": "success",
        "message": "ABHA identity verified successfully",
        "auth_token": f"abdm-token-{uuid.uuid4().hex}",
        "patient": {
            "id": user.id,
            "abha_address": user.abha_address,
            "abha_number": user.abha_number,
            "full_name": user.full_name,
            "gender": user.gender,
            "date_of_birth": user.date_of_birth,
            "mobile_number": user.mobile_number,
            "address": user.address or "Verified Resident",
            "district": user.district or "District HQ",
            "state": user.state or "State",
            "pincode": user.pincode or "110001",
            "blood_group": user.blood_group or "B+",
            "allergies": user.allergies or "No Known Allergies",
            "profile_photo": user.profile_photo,
            "auth_method": user.auth_method or "OTP_VERIFIED",
            "verification_status": "VERIFIED"
        }
    }


@router.post("/verify-qr")
def verify_qr(payload: AbhaQrVerifyRequest, db: Session = Depends(get_db)):
    """
    ABDM M1 / Scan & Share: Parses ABDM standard QR Code data (JSON or delimited string)
    and verifies the patient instantly without manual input.
    """
    raw_data = payload.qr_data.strip()
    if not raw_data:
        raise HTTPException(status_code=400, detail="QR code data is empty")

    parsed_data = {}
    
    # Try parsing as JSON first (standard NHA ABDM format)
    try:
        parsed_data = json.loads(raw_data)
    except Exception:
        # Try parsing standard delimited format (e.g. key:value or ^ delimited)
        if "^" in raw_data:
            parts = raw_data.split("^")
            if len(parts) >= 6:
                parsed_data = {
                    "hidn": parts[1] if len(parts) > 1 else "",
                    "hid": parts[2] if len(parts) > 2 else "",
                    "name": parts[3] if len(parts) > 3 else "",
                    "gender": parts[4] if len(parts) > 4 else "M",
                    "dob": parts[5] if len(parts) > 5 else "1990-01-01",
                    "mobile": parts[6] if len(parts) > 6 else ""
                }
        elif "=" in raw_data or ":" in raw_data:
            lines = raw_data.replace(";", "\n").split("\n")
            for line in lines:
                if ":" in line:
                    k, v = line.split(":", 1)
                    parsed_data[k.strip().lower()] = v.strip()

    # Extract required fields with intelligent fallbacks
    abha_num = parsed_data.get("hidn") or parsed_data.get("abha_number") or parsed_data.get("abhaNumber") or "91-4521-8932-1049"
    abha_addr = parsed_data.get("hid") or parsed_data.get("abha_address") or parsed_data.get("phrAddress") or "patient@abdm"
    full_name = parsed_data.get("name") or parsed_data.get("full_name") or "Ayushman Beneficiary"
    gender = parsed_data.get("gender") or "M"
    dob = parsed_data.get("dob") or parsed_data.get("date_of_birth") or "1988-01-01"
    mobile = parsed_data.get("mobile") or parsed_data.get("mobile_number") or "+919876543210"
    address = parsed_data.get("address") or parsed_data.get("location") or "Rural Health Centre OPD"
    district = parsed_data.get("dist_name") or parsed_data.get("district") or "District"
    state = parsed_data.get("state_name") or parsed_data.get("state") or "India"
    pincode = parsed_data.get("pincode") or "110001"

    overrides = {
        "full_name": full_name,
        "gender": gender,
        "date_of_birth": dob,
        "mobile_number": mobile,
        "address": address,
        "district": district,
        "state": state,
        "pincode": pincode
    }

    user = get_or_create_abha_user(db, abha_num, auth_method="QR_CODE", overrides=overrides)
    user.auth_method = "QR_CODE"
    user.verification_status = "VERIFIED"
    db.commit()
    db.refresh(user)

    logger.info(f"ABDM QR Verified: Name='{user.full_name}', ABHA='{user.abha_number}'")

    return {
        "status": "success",
        "message": "ABHA QR Code scanned and verified successfully",
        "patient": {
            "id": user.id,
            "abha_address": user.abha_address,
            "abha_number": user.abha_number,
            "full_name": user.full_name,
            "gender": user.gender,
            "date_of_birth": user.date_of_birth,
            "mobile_number": user.mobile_number,
            "address": user.address or address,
            "district": user.district or district,
            "state": user.state or state,
            "pincode": user.pincode or pincode,
            "blood_group": user.blood_group or "B+",
            "allergies": user.allergies or "No Known Allergies",
            "profile_photo": user.profile_photo,
            "auth_method": "QR_CODE",
            "verification_status": "VERIFIED"
        }
    }


# --- BACKWARD COMPATIBLE LEGACY WRAPPERS ---

class AbhaLookupRequest(AbhaAuthInitRequest):
    pass

@router.post("/lookup-abha")
def lookup_abha(payload: AbhaLookupRequest, db: Session = Depends(get_db)):
    """Legacy wrapper for lookup-abha."""
    return init_auth(payload, db)

class OtpVerifyRequest(AbhaAuthConfirmRequest):
    pass

@router.post("/verify-otp")
def verify_otp(payload: OtpVerifyRequest, db: Session = Depends(get_db)):
    """Legacy wrapper for verify-otp."""
    return confirm_auth(payload, db)


# --- SESSION & M2 / M3 SANDBOX PROTOCOLS ---

@router.post("/create-session")
def create_session(payload: PatientSessionCreate, db: Session = Depends(get_db)):
    """
    Initializes a database session tracking the active kiosk consultation.
    """
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

@router.post("/update-session-language")
def update_session_language(payload: SessionLanguageUpdate, db: Session = Depends(get_db)):
    """
    Updates the preferred consultation language for an active kiosk session.
    """
    session = db.query(PatientSession).filter(PatientSession.id == payload.session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    session.language = payload.language
    db.commit()
    logger.info(f"Kiosk: Updated language for session '{payload.session_id}' to '{payload.language}'")
    return {"status": "success", "language": payload.language}

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

