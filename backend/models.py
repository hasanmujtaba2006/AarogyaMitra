import datetime
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from database import Base

class AbhaUser(Base):
    __tablename__ = "abha_users"

    id = Column(Integer, primary_key=True, index=True)
    abha_address = Column(String(50), unique=True, index=True, nullable=False) # e.g. name@abdm
    abha_number = Column(String(20), unique=True, index=True, nullable=False)  # e.g. 14-digit number
    full_name = Column(String(100), nullable=False)
    gender = Column(String(10), nullable=False)
    date_of_birth = Column(String(10), nullable=False) # YYYY-MM-DD
    mobile_number = Column(String(15), nullable=False)
    address = Column(Text, nullable=True) # Full residential address
    district = Column(String(50), nullable=True) # District name
    state = Column(String(50), nullable=True) # State name
    pincode = Column(String(10), nullable=True) # Postal code
    auth_method = Column(String(30), default="DEMO") # AADHAAR_OTP, MOBILE_OTP, QR_CODE, DEMO
    verification_status = Column(String(20), default="VERIFIED", nullable=True) # VERIFIED, PENDING
    blood_group = Column(String(10), default="B+", nullable=True) # e.g. B+, O+, A+
    allergies = Column(Text, default="No Known Allergies", nullable=True) # e.g. No Known Allergies
    profile_photo = Column(Text, nullable=True) # Base64 data URL or photo link
    login_pin = Column(String(10), default="123456", nullable=True) # 6-digit PIN for instant kiosk login
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    sessions = relationship("PatientSession", back_populates="patient")


class PatientSession(Base):
    __tablename__ = "patient_sessions"

    id = Column(String(50), primary_key=True, index=True) # UUID or custom string
    abha_id = Column(Integer, ForeignKey("abha_users.id"), nullable=True)
    status = Column(String(20), default="active") # active, completed, triage_alerted
    language = Column(String(20), default="en") # en, hi, ta, te, etc.
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    
    # Store aggregated history and medical outputs
    ocr_text = Column(Text, nullable=True) # OCR results from prescription scanning
    summary = Column(Text, nullable=True) # AI English medical summary
    structured_summary = Column(JSON, nullable=True) # Structured JSON summary fields
    fhir_bundle = Column(JSON, nullable=True) # Generated FHIR bundle JSON
    triage_alert = Column(JSON, nullable=True) # Triage classification results
    doctor_notes = Column(Text, nullable=True) # Doctor clinical notes
    doctor_prescription = Column(Text, nullable=True) # Doctor prescriptions

    # Doctor Assignment & Queue Management
    assigned_doctor_id = Column(String(50), nullable=True)
    assigned_doctor_name = Column(String(100), nullable=True)
    assigned_doctor_specialty = Column(String(100), nullable=True)
    assigned_doctor_post = Column(String(100), nullable=True)
    assigned_doctor_room = Column(String(50), nullable=True)
    assigned_doctor_fee = Column(String(50), default="₹0 (Free Govt Kiosk)", nullable=True)
    queue_token = Column(String(50), nullable=True) # e.g. "OPD-104-05"
    queue_status = Column(String(50), default="none", nullable=True) # none, waiting, called, in_consultation, attended, completed
    queue_assigned_at = Column(DateTime, nullable=True)

    patient = relationship("AbhaUser", back_populates="sessions")
    chat_history = relationship("InterviewHistory", back_populates="session", cascade="all, delete-orphan")


class InterviewHistory(Base):
    __tablename__ = "interview_histories"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(50), ForeignKey("patient_sessions.id"), nullable=False)
    role = Column(String(20), nullable=False) # user or assistant
    message = Column(Text, nullable=False) # English message
    translated_message = Column(Text, nullable=True) # Message translated to patient's language
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

    session = relationship("PatientSession", back_populates="chat_history")


class Doctor(Base):
    __tablename__ = "doctors"

    id = Column(String(50), primary_key=True, index=True) # e.g. "doc-104" or UUID
    full_name = Column(String(100), nullable=False)
    username = Column(String(100), unique=True, index=True, nullable=False)
    password = Column(String(200), nullable=False)
    profile_photo = Column(Text, nullable=True) # URL or base64 or avatar
    qualifications = Column(String(200), nullable=False) # e.g. MBBS, MD, DM
    specialization = Column(String(150), nullable=False) # e.g. Gastroenterology & Digestive Care
    department = Column(String(100), nullable=False) # e.g. Gastroenterology
    room_number = Column(String(50), nullable=False) # e.g. "104"
    fee = Column(String(50), default="₹0 (Free Govt Kiosk Service)", nullable=True)
    consultation_time = Column(String(100), default="09:00 AM - 02:00 PM", nullable=True)
    status = Column(String(50), default="Consulting") # Consulting, On Break, Emergency Duty
    experience = Column(String(50), default="10 Years", nullable=True)
    post = Column(String(100), default="Consultant Physician", nullable=True)
    matching_keywords = Column(JSON, nullable=True)
    is_active = Column(Integer, default=1) # 1 = active, 0 = deleted
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
