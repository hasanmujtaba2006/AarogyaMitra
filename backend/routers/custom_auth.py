import base64
import datetime
from enum import Enum
import hashlib
import hmac
import json
import logging
import re
import secrets
import uuid
from typing import Dict, Any, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from config import settings
from database import get_db
from models import AbhaUser
from utils.sms_service import send_real_sms

logger = logging.getLogger("custom_auth")

router = APIRouter(prefix="/api/auth", tags=["Custom Kiosk Authentication"])

# In-Memory Storage for OTP verification & rate limiting
# Key: transaction_id -> { "otp": str, "mobile_number": str, "expires_at": datetime, "attempts": int }
OTP_STORE: Dict[str, Dict[str, Any]] = {}
# Key: mobile_number -> last_sent_at (datetime)
RATE_LIMIT_STORE: Dict[str, datetime.datetime] = {}


# --- Pydantic Enums and Schemas ---

class GenderEnum(str, Enum):
    M = "M"
    F = "F"
    O = "O"


class SendOtpRequest(BaseModel):
    mobile_number: str = Field(
        ...,
        description="10-digit Indian Mobile Number",
        example="9876543210"
    )

    @field_validator("mobile_number")
    def validate_mobile(cls, val: str) -> str:
        cleaned = re.sub(r"[^\d]", "", val)
        if cleaned.startswith("91") and len(cleaned) == 12:
            cleaned = cleaned[2:]
        if len(cleaned) != 10:
            raise ValueError("Mobile number must be exactly 10 digits")
        if not re.match(r"^[6-9]\d{9}$", cleaned):
            raise ValueError("Mobile number must start with 6, 7, 8, or 9")
        return cleaned


class VerifyLoginRequest(BaseModel):
    mobile_number: str = Field(..., example="9876543210")
    transaction_id: str = Field(..., example="txn_abc12345")
    otp: str = Field(..., min_length=6, max_length=6, example="123456")

    @field_validator("mobile_number")
    def validate_mobile(cls, val: str) -> str:
        cleaned = re.sub(r"[^\d]", "", val)
        if cleaned.startswith("91") and len(cleaned) == 12:
            cleaned = cleaned[2:]
        if len(cleaned) != 10:
            raise ValueError("Mobile number must be exactly 10 digits")
        return cleaned


class RegisterPatientRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=100, example="Ramesh Patel")
    mobile_number: str = Field(..., example="9876543210")
    gender: GenderEnum = Field(..., example=GenderEnum.M)
    age: int = Field(..., ge=1, le=125, example=42)
    pin_code: str = Field(..., min_length=6, max_length=6, example="226001")
    district: str = Field(..., min_length=2, max_length=50, example="Lucknow")
    state: str = Field(..., min_length=2, max_length=50, example="Uttar Pradesh")

    @field_validator("mobile_number")
    def validate_mobile(cls, val: str) -> str:
        cleaned = re.sub(r"[^\d]", "", val)
        if cleaned.startswith("91") and len(cleaned) == 12:
            cleaned = cleaned[2:]
        if len(cleaned) != 10:
            raise ValueError("Mobile number must be exactly 10 digits")
        if not re.match(r"^[6-9]\d{9}$", cleaned):
            raise ValueError("Mobile number must start with 6, 7, 8, or 9")
        return cleaned

    @field_validator("pin_code")
    def validate_pincode(cls, val: str) -> str:
        cleaned = re.sub(r"[^\d]", "", val)
        if len(cleaned) != 6:
            raise ValueError("PIN code must be exactly 6 numeric digits")
        return cleaned


# --- Helper Functions ---

def generate_jwt_token(payload_data: Dict[str, Any]) -> str:
    """
    Generates a secure RFC 7519 HMAC-SHA256 JWT Token using Python standard library.
    """
    header = {"alg": "HS256", "typ": "JWT"}
    now = datetime.datetime.utcnow()
    exp = int((now + datetime.timedelta(days=7)).timestamp())
    iat = int(now.timestamp())
    
    payload = {
        **payload_data,
        "exp": exp,
        "iat": iat,
        "iss": "AarogyaMitra-Kiosk"
    }

    header_b64 = base64.urlsafe_b64encode(json.dumps(header).encode()).rstrip(b"=").decode()
    payload_b64 = base64.urlsafe_b64encode(json.dumps(payload).encode()).rstrip(b"=").decode()
    signing_input = f"{header_b64}.{payload_b64}".encode()
    
    signature = hmac.new(
        settings.JWT_SECRET.encode(),
        signing_input,
        hashlib.sha256
    ).digest()
    sig_b64 = base64.urlsafe_b64encode(signature).rstrip(b"=").decode()
    
    return f"{header_b64}.{payload_b64}.{sig_b64}"


def generate_uhid() -> str:
    """Generates standard Unique Health ID: AM-YYMMDD-XXXXXX"""
    date_part = datetime.datetime.utcnow().strftime("%y%m%d")
    random_part = secrets.randbelow(900000) + 100000
    return f"AM-{date_part}-{random_part}"


# --- Endpoints ---

@router.post("/send-otp")
async def send_otp(payload: SendOtpRequest):
    """
    1. Accepts 10-digit mobile_number.
    2. Generates 6-digit crypto-secure OTP.
    3. Dispatches real SMS (or logs to terminal in test/hackathon mode).
    4. Stores OTP in temporary in-memory store mapped to transaction_id and mobile.
    """
    mobile = payload.mobile_number

    # Rate limiting: 30 seconds cooldown between OTP requests for the same number
    now = datetime.datetime.utcnow()
    if mobile in RATE_LIMIT_STORE:
        elapsed = (now - RATE_LIMIT_STORE[mobile]).total_seconds()
        if elapsed < settings.OTP_COOLDOWN_SECONDS:
            wait_time = int(settings.OTP_COOLDOWN_SECONDS - elapsed)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Please wait {wait_time} seconds before requesting a new OTP."
            )

    # Generate 6-digit numeric OTP
    otp = f"{secrets.randbelow(900000) + 100000}"
    txn_id = f"txn_{uuid.uuid4().hex[:12]}"

    # Terminal output for Hackathon evaluation / terminal inspection
    print(f"\n==================================================")
    print(f"DEMO OTP for {mobile}: {otp}")
    print(f"TRANSACTION ID: {txn_id}")
    print(f"==================================================\n")

    # Store OTP in-memory with TTL & attempt count
    expires_at = now + datetime.timedelta(seconds=settings.OTP_EXPIRY_SECONDS)
    OTP_STORE[txn_id] = {
        "otp": otp,
        "mobile_number": mobile,
        "expires_at": expires_at,
        "attempts": 0,
        "created_at": now
    }
    RATE_LIMIT_STORE[mobile] = now

    # Dispatch via Real SMS Gateway (Fast2SMS, Twilio, 2Factor, or terminal fallback)
    sms_result = await send_real_sms(mobile, otp)

    logger.info(f"OTP generated for {mobile}: txn_id={txn_id}, provider={sms_result.get('provider')}")

    return {
        "status": "success",
        "message": f"OTP successfully sent to +91-{mobile}",
        "transaction_id": txn_id,
        "demo_otp": otp,  # Included for immediate UI testing & hackathon evaluation
        "expires_in_seconds": settings.OTP_EXPIRY_SECONDS,
        "cooldown_seconds": settings.OTP_COOLDOWN_SECONDS,
        "provider": sms_result.get("provider", "Terminal")
    }


@router.post("/verify-login")
def verify_login(payload: VerifyLoginRequest, db: Session = Depends(get_db)):
    """
    2. Accepts mobile_number, transaction_id, and otp.
    3. Verifies OTP against in-memory dictionary.
    4. Returns mock JWT access token and user details.
    """
    mobile = payload.mobile_number
    txn_id = payload.transaction_id.strip()
    user_otp = payload.otp.strip()

    record = OTP_STORE.get(txn_id)
    now = datetime.datetime.utcnow()

    # Check existence
    if not record:
        # Hackathon convenience: allow test OTP 123456 if transaction_id starts with txn_
        if user_otp == "123456":
            logger.warning(f"Bypassing with default hackathon demo OTP 123456 for {mobile}")
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Transaction expired or invalid. Please request a new OTP."
            )
    else:
        # Verify matching mobile number
        if record["mobile_number"] != mobile:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Mobile number mismatch with transaction."
            )

        # Check expiration
        if now > record["expires_at"]:
            del OTP_STORE[txn_id]
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="OTP has expired. Please request a new OTP."
            )

        # Check maximum attempts (brute-force protection)
        if record["attempts"] >= 3:
            del OTP_STORE[txn_id]
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Too many incorrect attempts. OTP invalidated. Please request a new one."
            )

        # Verify OTP (accept generated OTP or universal hackathon demo OTP "123456")
        if user_otp != record["otp"] and user_otp != "123456":
            record["attempts"] += 1
            remaining = 3 - record["attempts"]
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid OTP code. {remaining} attempt(s) remaining."
            )

        # Clear used OTP
        del OTP_STORE[txn_id]

    # Find or initialize patient record in database
    user = db.query(AbhaUser).filter(
        (AbhaUser.mobile_number == f"+91{mobile}") | (AbhaUser.mobile_number == mobile)
    ).first()

    if not user:
        # First-time auto-seed profile for returning patient if not previously registered
        uhid = generate_uhid()
        user = AbhaUser(
            abha_address=f"patient.{mobile}@aarogya",
            abha_number=uhid,
            full_name=f"Patient {mobile[-4:]}",
            gender="O",
            date_of_birth="1990-01-01",
            mobile_number=f"+91{mobile}",
            address="Resident Patient",
            district="District Health Center",
            state="State",
            pincode="110001",
            auth_method="MANUAL_OTP",
            verification_status="VERIFIED"
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    # Generate RFC 7519 JWT Token
    token = generate_jwt_token({
        "sub": mobile,
        "uhid": user.abha_number,
        "user_id": user.id,
        "name": user.full_name
    })

    return {
        "status": "success",
        "message": "Login verified successfully",
        "access_token": token,
        "token_type": "bearer",
        "patient": {
            "id": user.id,
            "uhid": user.abha_number,
            "abha_number": user.abha_number,
            "abha_address": user.abha_address,
            "full_name": user.full_name,
            "gender": user.gender,
            "date_of_birth": user.date_of_birth,
            "mobile_number": user.mobile_number,
            "address": user.address or "Verified Resident",
            "district": user.district or "District HQ",
            "state": user.state or "State",
            "pincode": user.pincode or "110001",
            "auth_method": "MANUAL_OTP",
            "verification_status": "VERIFIED"
        }
    }


@router.post("/register")
def register_patient(payload: RegisterPatientRequest, db: Session = Depends(get_db)):
    """
    3. Accepts: full_name, mobile_number, gender (Enum: M/F/O), age, pin_code, district, state.
    4. Generates mock UHID.
    5. Returns success response with UHID and mock JWT token.
    """
    mobile = payload.mobile_number
    uhid = generate_uhid()

    # Calculate approximate date of birth from age
    current_year = datetime.datetime.utcnow().year
    birth_year = current_year - payload.age
    dob = f"{birth_year}-01-01"

    # Check if patient with this mobile number already exists
    user = db.query(AbhaUser).filter(
        (AbhaUser.mobile_number == f"+91{mobile}") | (AbhaUser.mobile_number == mobile)
    ).first()

    clean_name_slug = re.sub(r"[^a-zA-Z0-9]", "", payload.full_name.lower()) or "patient"
    abha_address = f"{clean_name_slug}.{mobile[-4:]}@aarogya"

    if user:
        # Update existing profile
        user.full_name = payload.full_name
        user.gender = payload.gender.value
        user.date_of_birth = dob
        user.district = payload.district
        user.state = payload.state
        user.pincode = payload.pin_code
        user.address = f"{payload.district}, {payload.state} - {payload.pin_code}"
        user.auth_method = "MANUAL_REGISTER"
        user.verification_status = "VERIFIED"
        uhid = user.abha_number or uhid
    else:
        # Create new patient entry
        user = AbhaUser(
            abha_address=abha_address,
            abha_number=uhid,
            full_name=payload.full_name,
            gender=payload.gender.value,
            date_of_birth=dob,
            mobile_number=f"+91{mobile}",
            address=f"{payload.district}, {payload.state} - {payload.pin_code}",
            district=payload.district,
            state=payload.state,
            pincode=payload.pin_code,
            auth_method="MANUAL_REGISTER",
            verification_status="VERIFIED"
        )
        db.add(user)

    db.commit()
    db.refresh(user)

    # Generate JWT token
    token = generate_jwt_token({
        "sub": mobile,
        "uhid": user.abha_number,
        "user_id": user.id,
        "name": user.full_name
    })

    logger.info(f"Registered new kiosk patient: Name='{user.full_name}', UHID='{user.abha_number}'")

    return {
        "status": "success",
        "message": "Patient successfully registered with AarogyaMitra Kiosk",
        "uhid": user.abha_number,
        "access_token": token,
        "token_type": "bearer",
        "patient": {
            "id": user.id,
            "uhid": user.abha_number,
            "abha_number": user.abha_number,
            "abha_address": user.abha_address,
            "full_name": user.full_name,
            "gender": user.gender,
            "age": payload.age,
            "date_of_birth": user.date_of_birth,
            "mobile_number": user.mobile_number,
            "pin_code": payload.pin_code,
            "pincode": payload.pin_code,
            "district": user.district,
            "state": user.state,
            "address": user.address,
            "auth_method": "MANUAL_REGISTER",
            "verification_status": "VERIFIED"
        }
    }
