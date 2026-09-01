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

class AbhaUserCreate(AbhaUserBase):
    pass

class AbhaUserResponse(AbhaUserBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

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
