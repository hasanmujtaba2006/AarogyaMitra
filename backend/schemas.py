from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

# --- Health Check ---
class HealthResponse(BaseModel):
    status: str
    timestamp: datetime
    database: str

# --- ABHA Schemas ---
class AbhaUserBase(BaseModel):
    abha_address: str = Field(..., example="amit@abdm")
    abha_number: str = Field(..., example="91-1234-5678-9012")
    full_name: str = Field(..., example="Amit Sharma")
    gender: str = Field(..., example="M")
    date_of_birth: str = Field(..., example="1985-05-15")
    mobile_number: str = Field(..., example="+919876543210")
    address: Optional[str] = Field(None, example="12, Shanti Nagar, Lucknow")
    district: Optional[str] = Field(None, example="Lucknow")
    state: Optional[str] = Field(None, example="Uttar Pradesh")
    pincode: Optional[str] = Field(None, example="226001")
    auth_method: Optional[str] = Field("DEMO", example="AADHAAR_OTP")
    verification_status: Optional[str] = Field("VERIFIED", example="VERIFIED")
    blood_group: Optional[str] = Field("B+", example="B+")
    allergies: Optional[str] = Field("No Known Allergies", example="No Known Allergies")
    profile_photo: Optional[str] = Field(None, example=None)

class AbhaUserCreate(AbhaUserBase):
    pass

class AbhaUserResponse(AbhaUserBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

class AbhaAuthInitRequest(BaseModel):
    abha_id: str = Field(..., description="14-digit ABHA Number or ABHA Address username@abdm")
    auth_mode: str = Field("aadhaar_otp", description="aadhaar_otp or mobile_otp")

class AbhaAuthConfirmRequest(BaseModel):
    abha_id: str
    otp: str
    txn_id: Optional[str] = None

class AbhaQrVerifyRequest(BaseModel):
    qr_data: str = Field(..., description="Scanned ABDM QR JSON or delimited string")

class DemoProfileItem(BaseModel):
    id: str
    name: str
    age: int
    gender: str
    abha_address: str
    abha_number: str
    location: str
    state: str
    district: str
    mobile: str
    dob: str
    blood_group: Optional[str] = "B+"
    allergies: Optional[str] = "No Known Allergies"
    profile_photo: Optional[str] = None
    sample_qr: str

# --- Chat History Schemas ---
class InterviewHistoryBase(BaseModel):
    role: str # user or assistant
    message: str # English text
    translated_message: Optional[str] = None # Native tongue text

class InterviewHistoryCreate(InterviewHistoryBase):
    session_id: str

class InterviewHistoryResponse(InterviewHistoryBase):
    id: int
    timestamp: datetime

    class Config:
        from_attributes = True

# --- Session Schemas ---
class PatientSessionBase(BaseModel):
    id: str
    status: str
    language: str

class PatientSessionCreate(BaseModel):
    id: str
    abha_id: Optional[int] = None
    language: str = "en"

class PatientSessionResponse(PatientSessionBase):
    created_at: datetime
    completed_at: Optional[datetime] = None
    ocr_text: Optional[str] = None
    summary: Optional[str] = None
    fhir_bundle: Optional[Dict[str, Any]] = None
    triage_alert: Optional[Dict[str, Any]] = None
    doctor_notes: Optional[str] = None
    doctor_prescription: Optional[str] = None
    chat_history: List[InterviewHistoryResponse] = []

    class Config:
        from_attributes = True

class ClinicalUpdateRequest(BaseModel):
    doctor_notes: str
    doctor_prescription: str

class SessionLanguageUpdate(BaseModel):
    session_id: str
    language: str

