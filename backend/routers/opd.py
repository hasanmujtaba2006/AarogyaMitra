import datetime
import json
import logging
import re
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func, or_

from database import get_db, engine
from models import Doctor, PatientSession, AbhaUser, InterviewHistory
from schemas import (
    AdminLoginRequest, DoctorLoginRequest, DoctorCreateRequest, 
    DoctorUpdateRequest, DoctorStatusUpdateRequest, CallPatientRequest,
    ClinicalUpdateRequest
)
from routers.chat import AVAILABLE_DOCTORS, generate_fhir_bundle
from utils.queue_token import generate_unique_queue_token, deduplicate_sessions_for_room

logger = logging.getLogger("opd_router")

router = APIRouter(prefix="/api/opd", tags=["OPD Management"])

# Fixed admin credentials specified by user requirements
ADMIN_USERNAME = "lokeshpatel@aarogyamitra"
ADMIN_PASSWORD = "Lokesh@1234"


def seed_doctors_if_needed(db: Session):
    """Seeds initial doctors from AVAILABLE_DOCTORS if the doctors table is empty."""
    try:
        count = db.query(Doctor).count()
        if count == 0:
            logger.info("Seeding default doctors into database...")
            for doc in AVAILABLE_DOCTORS:
                # Generate clean username: e.g. "doc-104" -> "dr.rajesh"
                raw_name = doc["name"].lower().replace("dr.", "").strip()
                first_name = raw_name.split()[0] if raw_name else doc["id"]
                username = f"dr.{first_name}"
                
                new_doc = Doctor(
                    id=doc["id"],
                    full_name=doc["name"],
                    username=username,
                    password="Doctor@123", # default password for initial seed
                    profile_photo=doc.get("avatar", "👨‍⚕️"),
                    qualifications=doc.get("qualification", "MBBS, MD"),
                    specialization=doc.get("specialty", "General Medicine"),
                    department=doc.get("department", "General Medicine"),
                    room_number=doc.get("room_number", "101"),
                    fee=doc.get("fee", "₹0 (Free Govt Kiosk Service)"),
                    consultation_time="09:00 AM - 02:00 PM",
                    status="Consulting",
                    experience=doc.get("experience", "10 Years"),
                    post=doc.get("post", "Consultant Specialist"),
                    matching_keywords=doc.get("matching_keywords", []),
                    is_active=1
                )
                db.add(new_doc)
            db.commit()
            logger.info("Default doctors seeded successfully.")
    except Exception as e:
        logger.warning(f"Error checking/seeding doctors: {e}")
        db.rollback()


def calculate_age_and_group(dob_str: Optional[str]) -> Dict[str, Any]:
    """Calculates age and age group from YYYY-MM-DD date of birth."""
    if not dob_str:
        return {"age": 35, "age_group": "adult"}
    
    try:
        # Check standard format YYYY-MM-DD
        if len(dob_str) >= 4 and dob_str[:4].isdigit():
            birth_year = int(dob_str[:4])
            current_year = datetime.datetime.utcnow().year
            age = max(0, current_year - birth_year)
            
            if age < 18:
                group = "pediatric"
            elif age >= 60:
                group = "senior"
            else:
                group = "adult"
            return {"age": age, "age_group": group}
    except Exception:
        pass
    
    return {"age": 35, "age_group": "adult"}


# ==========================================
# AUTHENTICATION ENDPOINTS
# ==========================================

@router.post("/admin/login")
def admin_login(payload: AdminLoginRequest):
    """Admin login with specified credentials: lokeshpatel@aarogyamitra / Lokesh@1234."""
    uname = (payload.username or "").strip().lower()
    pwd = (payload.password or "").strip()

    if uname == ADMIN_USERNAME.lower() and pwd == ADMIN_PASSWORD:
        return {
            "status": "success",
            "token": f"admin_token_{int(datetime.datetime.utcnow().timestamp())}",
            "user": {
                "username": ADMIN_USERNAME,
                "full_name": "Lokesh Patel",
                "role": "admin",
                "designation": "Chief OPD Administrator & Superintendent",
                "email": "lokeshpatel@aarogyamitra"
            }
        }
    
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid admin credentials. Please enter the authorized username and password."
    )


@router.post("/doctor/login")
def doctor_login(payload: DoctorLoginRequest, db: Session = Depends(get_db)):
    """Doctor login with doctor credentials created by admin."""
    seed_doctors_if_needed(db)
    uname = (payload.username or "").strip().lower()
    pwd = (payload.password or "").strip()

    doctor = db.query(Doctor).filter(
        func.lower(Doctor.username) == uname,
        Doctor.is_active == 1
    ).first()

    if not doctor or doctor.password != pwd:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid doctor credentials. Please check your username and password."
        )

    return {
        "status": "success",
        "token": f"doc_token_{doctor.id}_{int(datetime.datetime.utcnow().timestamp())}",
        "doctor": {
            "id": doctor.id,
            "full_name": doctor.full_name,
            "username": doctor.username,
            "qualifications": doctor.qualifications,
            "specialization": doctor.specialization,
            "department": doctor.department,
            "room_number": doctor.room_number,
            "fee": doctor.fee,
            "consultation_time": doctor.consultation_time,
            "status": doctor.status,
            "profile_photo": doctor.profile_photo,
            "experience": doctor.experience,
            "post": doctor.post
        }
    }


# ==========================================
# ADMIN DASHBOARD & STATISTICS
# ==========================================

@router.get("/admin/stats")
def get_admin_dashboard_stats(db: Session = Depends(get_db)):
    """Provides real-time KPI metrics for the Admin Dashboard."""
    seed_doctors_if_needed(db)
    
    # 1. Active doctors count (is_active == 1 and not 'On Break')
    total_doctors = db.query(Doctor).filter(Doctor.is_active == 1).count()
    active_doctors = db.query(Doctor).filter(
        Doctor.is_active == 1,
        Doctor.status != "On Break"
    ).count()

    # 2. Active patients count (total sessions today or all registered sessions)
    today_start = datetime.datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    patients_today = db.query(PatientSession).filter(PatientSession.created_at >= today_start).count()
    total_patients = db.query(PatientSession).count()
    active_patients = patients_today if patients_today > 0 else total_patients

    # 3. Patients waiting in queue
    waiting_patients = db.query(PatientSession).filter(
        PatientSession.queue_status == "waiting"
    ).count()

    # 4. Emergency patients count (red triage or triage_alerted)
    all_sessions = db.query(PatientSession).all()
    emergency_count = 0
    for s in all_sessions:
        is_triage = s.status == "triage_alerted" or (s.triage_alert and s.triage_alert.get("triggered"))
        symptoms_str = (s.summary or "").lower()
        if is_triage or any(k in symptoms_str for k in ["chest pain", "heart", "chhati", "breathless", "paralysis", "slurred"]):
            emergency_count += 1

    return {
        "active_doctors": active_doctors,
        "total_doctors": total_doctors,
        "active_patients": active_patients,
        "waiting_patients": waiting_patients,
        "emergency_patients": emergency_count,
        "timestamp": datetime.datetime.utcnow().isoformat()
    }


# ==========================================
# DOCTOR MANAGEMENT (CRUD BY ADMIN)
# ==========================================

@router.get("/doctors")
def list_doctors(db: Session = Depends(get_db)):
    """Lists all active doctors with their queue counts, timings, and credentials for Admin."""
    seed_doctors_if_needed(db)
    doctors = db.query(Doctor).filter(Doctor.is_active == 1).all()
    
    result = []
    for d in doctors:
        # Live queue count for this doctor
        waiting_count = db.query(PatientSession).filter(
            PatientSession.assigned_doctor_id == d.id,
            PatientSession.queue_status == "waiting"
        ).count()

        called_count = db.query(PatientSession).filter(
            PatientSession.assigned_doctor_id == d.id,
            PatientSession.queue_status == "called"
        ).count()

        attended_count = db.query(PatientSession).filter(
            PatientSession.assigned_doctor_id == d.id,
            PatientSession.queue_status == "completed"
        ).count()

        result.append({
            "id": d.id,
            "full_name": d.full_name,
            "username": d.username,
            "password": d.password, # Admin has rights to view/edit credentials
            "profile_photo": d.profile_photo or "👨‍⚕️",
            "qualifications": d.qualifications,
            "specialization": d.specialization,
            "department": d.department,
            "room_number": d.room_number,
            "fee": d.fee,
            "consultation_time": d.consultation_time or "09:00 AM - 02:00 PM",
            "status": d.status,
            "experience": d.experience,
            "post": d.post,
            "waiting_count": waiting_count,
            "called_count": called_count,
            "attended_count": attended_count,
            "total_queue": waiting_count + called_count,
            "created_at": d.created_at.isoformat() if d.created_at else None
        })

    return {"doctors": result}


@router.post("/doctors")
def create_doctor(payload: DoctorCreateRequest, db: Session = Depends(get_db)):
    """Admin creates a new doctor profile and assigns Username & Password."""
    seed_doctors_if_needed(db)
    
    # Check if username already exists
    clean_username = payload.username.strip().lower()
    existing = db.query(Doctor).filter(
        func.lower(Doctor.username) == clean_username,
        Doctor.is_active == 1
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Username '{payload.username}' is already taken by another doctor. Please choose a unique username."
        )

    # Generate unique doctor ID based on room or timestamp
    doc_id = f"doc-{payload.room_number}-{int(datetime.datetime.utcnow().timestamp()) % 1000}"

    # Generate keywords for matching
    keywords = [
        payload.specialization.lower(),
        payload.department.lower(),
        payload.full_name.lower().replace("dr.", "").strip()
    ]

    new_doctor = Doctor(
        id=doc_id,
        full_name=payload.full_name.strip(),
        username=clean_username,
        password=payload.password.strip(),
        profile_photo=payload.profile_photo or "👨‍⚕️",
        qualifications=payload.qualifications.strip(),
        specialization=payload.specialization.strip(),
        department=payload.department.strip(),
        room_number=payload.room_number.strip(),
        fee=payload.fee or "₹0 (Free Govt Kiosk Service)",
        consultation_time=payload.consultation_time or "09:00 AM - 02:00 PM",
        status="Consulting",
        experience=payload.experience or "10 Years",
        post=payload.post or "Consultant Specialist",
        matching_keywords=keywords,
        is_active=1,
        created_at=datetime.datetime.utcnow()
    )

    db.add(new_doctor)
    db.commit()
    db.refresh(new_doctor)

    return {
        "status": "success",
        "message": f"Doctor profile for {new_doctor.full_name} created successfully.",
        "doctor": {
            "id": new_doctor.id,
            "full_name": new_doctor.full_name,
            "username": new_doctor.username,
            "room_number": new_doctor.room_number,
            "specialization": new_doctor.specialization,
            "department": new_doctor.department,
            "consultation_time": new_doctor.consultation_time,
            "status": new_doctor.status
        }
    }


@router.put("/doctors/{doctor_id}")
def update_doctor(doctor_id: str, payload: DoctorUpdateRequest, db: Session = Depends(get_db)):
    """Admin edits an existing doctor profile, timings, cabin, fees, or credentials."""
    doctor = db.query(Doctor).filter(Doctor.id == doctor_id, Doctor.is_active == 1).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")

    if payload.username:
        clean_username = payload.username.strip().lower()
        # Verify username is not taken by another doctor
        existing = db.query(Doctor).filter(
            func.lower(Doctor.username) == clean_username,
            Doctor.id != doctor_id,
            Doctor.is_active == 1
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Username is already in use by another doctor.")
        doctor.username = clean_username

    if payload.password:
        doctor.password = payload.password.strip()
    if payload.full_name is not None:
        doctor.full_name = payload.full_name.strip()
    if payload.qualifications is not None:
        doctor.qualifications = payload.qualifications.strip()
    if payload.specialization is not None:
        doctor.specialization = payload.specialization.strip()
    if payload.department is not None:
        doctor.department = payload.department.strip()
    if payload.room_number is not None:
        doctor.room_number = payload.room_number.strip()
    if payload.fee is not None:
        doctor.fee = payload.fee.strip()
    if payload.consultation_time is not None:
        doctor.consultation_time = payload.consultation_time.strip()
    if payload.profile_photo is not None:
        doctor.profile_photo = payload.profile_photo
    if payload.experience is not None:
        doctor.experience = payload.experience.strip()
    if payload.post is not None:
        doctor.post = payload.post.strip()
    if payload.status is not None:
        doctor.status = payload.status

    db.commit()
    db.refresh(doctor)

    return {
        "status": "success",
        "message": f"Doctor profile for {doctor.full_name} updated successfully.",
        "doctor": {
            "id": doctor.id,
            "full_name": doctor.full_name,
            "username": doctor.username,
            "specialization": doctor.specialization,
            "department": doctor.department,
            "room_number": doctor.room_number,
            "fee": doctor.fee,
            "consultation_time": doctor.consultation_time,
            "status": doctor.status
        }
    }


@router.delete("/doctors/{doctor_id}")
def delete_doctor(doctor_id: str, db: Session = Depends(get_db)):
    """Admin removes a doctor from the active directory (soft delete)."""
    doctor = db.query(Doctor).filter(Doctor.id == doctor_id, Doctor.is_active == 1).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")

    doctor.is_active = 0
    db.commit()

    return {
        "status": "success",
        "message": f"Doctor {doctor.full_name} has been removed successfully."
    }


# ==========================================
# DOCTOR AVAILABILITY STATUS (CONSULTING, ON BREAK, EMERGENCY DUTY)
# ==========================================

@router.patch("/doctor/{doctor_id}/status")
def update_doctor_availability_status(
    doctor_id: str, 
    payload: DoctorStatusUpdateRequest, 
    db: Session = Depends(get_db)
):
    """Doctor updates their live availability status: 'Consulting', 'On Break', or 'Emergency Duty'."""
    doctor = db.query(Doctor).filter(Doctor.id == doctor_id, Doctor.is_active == 1).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")

    valid_statuses = ["Consulting", "On Break", "Emergency Duty"]
    if payload.status not in valid_statuses:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid status '{payload.status}'. Must be one of: {', '.join(valid_statuses)}"
        )

    doctor.status = payload.status
    db.commit()
    db.refresh(doctor)

    return {
        "status": "success",
        "doctor_id": doctor.id,
        "doctor_name": doctor.full_name,
        "new_status": doctor.status,
        "message": f"Availability status updated to '{doctor.status}'."
    }


# ==========================================
# DOCTOR OPD QUEUE & CURRENT PATIENT
# ==========================================

@router.get("/doctor/{doctor_id}/queue")
def get_doctor_patient_queue(doctor_id: str, db: Session = Depends(get_db)):
    """
    Returns the live patient queue for this doctor.
    Includes age calculation and group, triage classification, symptoms, and AI summary.
    If the doctor is 'On Break', returns on_break=True.
    """
    doctor = db.query(Doctor).filter(Doctor.id == doctor_id, Doctor.is_active == 1).first()
    
    doctor_status = doctor.status if doctor else "Consulting"
    is_on_break = doctor_status == "On Break"
    is_emergency_duty = doctor_status == "Emergency Duty"

    # Auto-heal any duplicate tokens for this doctor's room before querying
    if doctor:
        deduplicate_sessions_for_room(db, doctor.room_number)

    # Query sessions assigned to this doctor
    sessions = db.query(PatientSession).filter(
        PatientSession.assigned_doctor_id == doctor_id
    ).order_by(PatientSession.queue_assigned_at.desc(), PatientSession.created_at.desc()).all()

    # If this is a new doctor with no assigned sessions yet, or general query fallback,
    # also check if there are sessions assigned to this doctor's room number
    if doctor and not sessions:
        sessions = db.query(PatientSession).filter(
            PatientSession.assigned_doctor_room == doctor.room_number
        ).order_by(PatientSession.queue_assigned_at.desc(), PatientSession.created_at.desc()).all()

    waiting_list = []
    called_patient = None
    completed_list = []

    for s in sessions:
        # Resolve patient record from s.patient, s.abha_id, or fallback to latest registered ABHA user
        patient_rec = s.patient
        if not patient_rec and s.abha_id:
            patient_rec = db.query(AbhaUser).filter(AbhaUser.id == s.abha_id).first()
        if not patient_rec:
            # Fallback to the latest registered patient in the system
            patient_rec = db.query(AbhaUser).order_by(AbhaUser.id.desc()).first()
            if patient_rec and s.abha_id is None:
                try:
                    s.abha_id = patient_rec.id
                    db.commit()
                except Exception:
                    pass

        # Calculate age
        dob = patient_rec.date_of_birth if patient_rec else None
        age_info = calculate_age_and_group(dob)
        
        # Symptoms & Severity extraction
        symptoms = "General Health Consultation"
        duration = "2-3 days"
        severity = "Moderate"
        if s.structured_summary and isinstance(s.structured_summary, dict):
            symptoms = s.structured_summary.get("chief_complaint", symptoms)
            duration = s.structured_summary.get("onset", duration)
            severity = str(s.structured_summary.get("severity", severity))
        elif s.summary:
            # Fallback simple search
            lines = [l.strip() for l in s.summary.split("\n") if l.strip()]
            for idx, line in enumerate(lines):
                if "chief complaint" in line.lower() and idx + 1 < len(lines):
                    symptoms = lines[idx + 1].replace("-", "").replace("*", "").strip()
                if "duration" in line.lower() or "onset" in line.lower():
                    duration = line.split(":")[-1].replace("*", "").strip()
                if "severity" in line.lower():
                    severity = line.split(":")[-1].replace("*", "").strip()

        # Dynamic Triage category
        is_triage_alert = s.status == "triage_alerted" or (s.triage_alert and s.triage_alert.get("triggered"))
        s_low = (symptoms + " " + (s.summary or "")).lower()
        
        if is_triage_alert or any(k in s_low for k in ["chest pain", "angina", "heart", "chhati", "breathless", "slurred", "paralysis", "loss of consciousness"]):
            triage_badge = "red"
            triage_label = "Emergency / Critical"
        elif any(k in s_low for k in ["abdominal pain", "vomiting", "dizziness", "fever", "severe pain", "pet dard"]):
            triage_badge = "yellow"
            triage_label = "Severe Condition"
        else:
            triage_badge = "green"
            triage_label = "Routine OPD"

        # Chat history
        chat_hist = []
        for ch in s.chat_history:
            chat_hist.append({
                "role": ch.role,
                "message": ch.message,
                "translated_message": ch.translated_message,
                "timestamp": ch.timestamp.isoformat() if ch.timestamp else None
            })

        # Ensure session has a unique valid token
        assigned_token = s.queue_token
        if not assigned_token:
            assigned_token = generate_unique_queue_token(db, doctor.room_number if doctor else "101", doctor_id)
            s.queue_token = assigned_token
            try:
                db.commit()
            except Exception:
                pass

        patient_obj = {
            "session_id": s.id,
            "queue_token": assigned_token,
            "queue_status": s.queue_status or "waiting",
            "queue_assigned_at": s.queue_assigned_at.isoformat() if s.queue_assigned_at else s.created_at.isoformat() if s.created_at else None,
            "patient": {
                "id": patient_rec.id if patient_rec else None,
                "full_name": patient_rec.full_name if patient_rec else "Husain Mujtaba",
                "abha_number": patient_rec.abha_number if patient_rec else "91-1234-5678-9012",
                "abha_address": patient_rec.abha_address if patient_rec else "patient@abdm",
                "gender": patient_rec.gender if patient_rec else "M",
                "date_of_birth": patient_rec.date_of_birth if patient_rec else "1995-01-01",
                "mobile_number": patient_rec.mobile_number if patient_rec else "+919876543210",
                "blood_group": getattr(patient_rec, "blood_group", "B+") if patient_rec else "B+",
                "allergies": getattr(patient_rec, "allergies", "No Known Allergies") if patient_rec else "No Known Allergies",
                "address": getattr(patient_rec, "address", "Lucknow, UP") if patient_rec else "Lucknow, UP",
                "district": getattr(patient_rec, "district", "Lucknow") if patient_rec else "Lucknow",
                "state": getattr(patient_rec, "state", "Uttar Pradesh") if patient_rec else "Uttar Pradesh",
                "profile_photo": getattr(patient_rec, "profile_photo", None) if patient_rec else None,
                "age": age_info["age"],
                "age_group": age_info["age_group"]
            },
            "clinical": {
                "symptoms": symptoms,
                "duration": duration,
                "severity": severity,
                "ai_triage_category": triage_badge,
                "ai_triage_label": triage_label,
                "ai_recommendation": s.structured_summary.get("provisional_diagnosis") if s.structured_summary else "Consultation recommended",
                "summary": s.summary or "Medical summary prepared by AI Kiosk.",
                "structured_summary": s.structured_summary or {},
                "ocr_text": s.ocr_text,
                "doctor_notes": s.doctor_notes,
                "doctor_prescription": s.doctor_prescription,
                "chat_history": chat_hist
            },
            "previous_records_count": db.query(PatientSession).filter(
                PatientSession.abha_id == patient_rec.id,
                PatientSession.id != s.id,
                or_(
                    PatientSession.doctor_prescription.isnot(None),
                    PatientSession.doctor_notes.isnot(None),
                    PatientSession.ocr_text.isnot(None),
                    PatientSession.status == "completed",
                    PatientSession.queue_status == "completed"
                )
            ).count() if patient_rec else 0
        }

        if s.queue_status == "called":
            # Only the first (most recent) called patient is current patient in cabin
            if not called_patient:
                called_patient = patient_obj
            else:
                # Demote any stale previously called session back to waiting
                s.queue_status = "waiting"
                patient_obj["queue_status"] = "waiting"
                waiting_list.append(patient_obj)
                try:
                    db.commit()
                except Exception:
                    pass
        elif s.queue_status == "waiting":
            waiting_list.append(patient_obj)
        elif s.queue_status in ["completed", "attended"]:
            completed_list.append(patient_obj)
        else:
            waiting_list.append(patient_obj)

    # 1. Sort waiting_list by clinical priority (Red > Yellow > Green), then arrival time
    triage_priority_map = {"red": 0, "yellow": 1, "green": 2}
    def waiting_sort_key(p):
        cat = p.get("clinical", {}).get("ai_triage_category", "green")
        priority = triage_priority_map.get(cat, 3)
        assigned_at = p.get("queue_assigned_at") or "9999-12-31"
        return (priority, assigned_at)

    waiting_list.sort(key=waiting_sort_key)

    # 2. Final collision guarantee: ensure all tokens in waiting_queue and called_patient are strictly unique
    seen_tokens = set()
    if called_patient and called_patient.get("queue_token"):
        seen_tokens.add(called_patient["queue_token"])

    for p in waiting_list:
        cur_tok = p.get("queue_token")
        if not cur_tok or cur_tok in seen_tokens:
            new_tok = generate_unique_queue_token(db, doctor.room_number if doctor else "101", doctor_id)
            p["queue_token"] = new_tok
            sess = db.query(PatientSession).filter(PatientSession.id == p["session_id"]).first()
            if sess:
                sess.queue_token = new_tok
                try:
                    db.commit()
                except Exception:
                    pass
        seen_tokens.add(p["queue_token"])

    return {
        "doctor_id": doctor_id,
        "doctor_name": doctor.full_name if doctor else "Doctor",
        "doctor_status": doctor_status,
        "on_break": is_on_break,
        "emergency_duty": is_emergency_duty,
        "total_waiting": len(waiting_list),
        "waiting_queue": waiting_list,
        "current_patient": called_patient,
        "completed_count": len(completed_list)
    }


@router.post("/doctor/call-patient")
def call_patient(payload: CallPatientRequest, db: Session = Depends(get_db)):
    """
    Doctor calls a patient from the queue into the cabin.
    Sets session queue_status='called', triggering notification on patient kiosk.
    Returns patient full clinical summary for Current Patient screen.
    """
    session = db.query(PatientSession).filter(PatientSession.id == payload.session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Patient session not found")

    # 1. Demote any previously called patient for this doctor or room back to 'waiting'
    if session.assigned_doctor_id:
        db.query(PatientSession).filter(
            PatientSession.assigned_doctor_id == session.assigned_doctor_id,
            PatientSession.id != session.id,
            PatientSession.queue_status == "called"
        ).update({"queue_status": "waiting"})
    if session.assigned_doctor_room:
        db.query(PatientSession).filter(
            PatientSession.assigned_doctor_room == session.assigned_doctor_room,
            PatientSession.id != session.id,
            PatientSession.queue_status == "called"
        ).update({"queue_status": "waiting"})

    # 2. Mark this session as called with fresh timestamp
    session.queue_status = "called"
    session.queue_assigned_at = datetime.datetime.utcnow()
    db.commit()
    db.refresh(session)

    # Resolve patient record
    patient_rec = session.patient
    if not patient_rec and session.abha_id:
        patient_rec = db.query(AbhaUser).filter(AbhaUser.id == session.abha_id).first()
    if not patient_rec:
        patient_rec = db.query(AbhaUser).order_by(AbhaUser.id.desc()).first()
        if patient_rec and session.abha_id is None:
            try:
                session.abha_id = patient_rec.id
                db.commit()
            except Exception:
                pass

    age_info = calculate_age_and_group(patient_rec.date_of_birth if patient_rec else None)

    return {
        "status": "called",
        "message": f"Calling patient {patient_rec.full_name if patient_rec else 'Patient'} into Room {session.assigned_doctor_room or 'OPD'}!",
        "session_id": session.id,
        "queue_token": session.queue_token,
        "queue_status": session.queue_status,
        "doctor_name": session.assigned_doctor_name,
        "doctor_room": session.assigned_doctor_room,
        "patient": {
            "id": patient_rec.id if patient_rec else None,
            "full_name": patient_rec.full_name if patient_rec else "Husain Mujtaba",
            "abha_number": patient_rec.abha_number if patient_rec else "91-1234-5678-9012",
            "abha_address": patient_rec.abha_address if patient_rec else "patient@abdm",
            "gender": patient_rec.gender if patient_rec else "M",
            "date_of_birth": patient_rec.date_of_birth if patient_rec else "1995-01-01",
            "mobile_number": patient_rec.mobile_number if patient_rec else "+919876543210",
            "blood_group": getattr(patient_rec, "blood_group", "B+") if patient_rec else "B+",
            "allergies": getattr(patient_rec, "allergies", "No Known Allergies") if patient_rec else "No Known Allergies",
            "age": age_info["age"],
            "age_group": age_info["age_group"]
        },
        "summary": session.summary,
        "structured_summary": session.structured_summary,
        "ocr_text": session.ocr_text,
        "previous_records_count": db.query(PatientSession).filter(
            PatientSession.abha_id == patient_rec.id,
            PatientSession.id != session.id,
            or_(
                PatientSession.doctor_prescription.isnot(None),
                PatientSession.doctor_notes.isnot(None),
                PatientSession.ocr_text.isnot(None),
                PatientSession.status == "completed",
                PatientSession.queue_status == "completed"
            )
        ).count() if patient_rec else 0
    }


@router.post("/doctor/sessions/{session_id}/prescription")
def save_consultation_prescription(
    session_id: str, 
    payload: ClinicalUpdateRequest, 
    db: Session = Depends(get_db)
):
    """
    Saves doctor prescription, clinical notes, and diagnosis.
    Marks patient session queue_status='completed' and status='attended'.
    """
    session = db.query(PatientSession).filter(PatientSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Patient session not found")

    notes = payload.doctor_notes or payload.notes or ""
    prescription = payload.doctor_prescription or ""
    if not prescription and payload.medications:
        prescription = "\n".join([
            f"- {m.get('name')}: {m.get('dosage', '')} ({m.get('frequency', '')} x {m.get('duration', '')}) [{m.get('instructions', '')}]" 
            for m in payload.medications
        ])
    diagnosis = payload.diagnosis or payload.confirmed_diagnosis

    session.doctor_notes = notes
    session.doctor_prescription = prescription
    session.status = "attended"
    session.queue_status = "completed"
    session.completed_at = datetime.datetime.utcnow()

    # Update structured summary with doctor's confirmed data
    existing_struct = dict(session.structured_summary) if session.structured_summary else {}
    if diagnosis:
        existing_struct["confirmed_diagnosis"] = diagnosis
    if payload.medications:
        existing_struct["prescribed_medications"] = payload.medications
    if payload.follow_up:
        existing_struct["follow_up_advice"] = payload.follow_up
    
    existing_struct["doctor_name"] = session.assigned_doctor_name or "Consulting Physician"
    existing_struct["doctor_room"] = session.assigned_doctor_room or "OPD"
    existing_struct["doctor_specialty"] = session.assigned_doctor_specialty or "General Medicine"
    session.structured_summary = existing_struct

    # Update FHIR bundle
    if session.patient:
        try:
            session.fhir_bundle = generate_fhir_bundle(session.patient, session)
        except Exception as e:
            logger.warning(f"Error generating FHIR bundle: {e}")

    db.commit()
    db.refresh(session)

    return {
        "status": "success",
        "message": "Consultation prescription and medical records saved successfully!",
        "session_id": session.id,
        "queue_status": session.queue_status,
        "session_status": session.status,
        "structured_summary": session.structured_summary
    }


def parse_rx_text(rx_text: str, doc_name: str, date_str: str, room_str: str) -> List[Dict[str, Any]]:
    meds = []
    if not rx_text:
        return meds
    lines = rx_text.strip().split("\n")
    for idx, line in enumerate(lines):
        line = line.strip().lstrip("-*• ").strip()
        if not line:
            continue
        name = line
        dosage = "1 Tab"
        frequency = "1-0-1"
        duration = "3 days"
        instructions = "After meals"

        match = re.search(r"^(.*?)(?:\s*\((.*?)\))?(?:\s*\|\s*(.*?)\s*x\s*([^\[]+))?(?:\s*\[(.*?)\])?$", line)
        if match:
            raw_name, raw_dose, raw_freq, raw_dur, raw_inst = match.groups()
            if raw_name:
                name = raw_name.strip()
            if raw_dose:
                dosage = raw_dose.strip()
            if raw_freq:
                frequency = raw_freq.strip()
            if raw_dur:
                duration = raw_dur.strip()
            if raw_inst:
                instructions = raw_inst.strip()

        meds.append({
            "id": f"rx_{idx}_{name[:12].replace(' ', '_')}",
            "name": name,
            "dosage": dosage,
            "frequency": frequency,
            "duration": duration,
            "instructions": instructions,
            "prescribed_by": doc_name,
            "doctor_room": room_str,
            "date": date_str,
            "source": "Doctor Consultation Rx"
        })
    return meds


def extract_vitals_from_text(text: str) -> Dict[str, str]:
    vitals = {}
    if not text:
        return vitals
    bp_match = re.search(r"(?:BP|Blood Pressure)\s*[:=-]?\s*([0-9]{2,3}\s*/\s*[0-9]{2,3}(?:\s*mmHg)?)", text, re.IGNORECASE)
    if bp_match:
        vitals["bp"] = bp_match.group(1).strip()
    pulse_match = re.search(r"(?:Pulse|Pulse Rate|Heart Rate)\s*[:=-]?\s*([0-9]{2,3}(?:\s*bpm)?)", text, re.IGNORECASE)
    if pulse_match:
        vitals["pulse"] = pulse_match.group(1).strip()
    rbs_match = re.search(r"(?:RBS|Blood Sugar|Random Blood Sugar|Glucose)\s*[:=-]?\s*([0-9]{2,3}(?:\s*mg/d[lL])?)", text, re.IGNORECASE)
    if rbs_match:
        vitals["rbs"] = rbs_match.group(1).strip()
    spo2_match = re.search(r"(?:SpO2|Oxygen)\s*[:=-]?\s*([0-9]{2,3}\s*%)", text, re.IGNORECASE)
    if spo2_match:
        vitals["spo2"] = spo2_match.group(1).strip()
    return vitals


@router.get("/doctor/sessions/{session_id}/history")
def get_patient_medical_history(session_id: str, db: Session = Depends(get_db)):
    """
    Retrieves full historical medical records, previous doctor consultations,
    prescribed medications, diagnostic reports, and scanned OCR documents
    for the patient linked to the given session_id.
    """
    session = db.query(PatientSession).filter(PatientSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    patient_rec = session.patient
    if not patient_rec and session.abha_id:
        patient_rec = db.query(AbhaUser).filter(AbhaUser.id == session.abha_id).first()

    if not patient_rec:
        return {
            "status": "success",
            "session_id": session_id,
            "patient": None,
            "total_records": 0,
            "consultations": [],
            "prescriptions": [],
            "reports": [],
            "ocr_scans": []
        }

    # Query all historical sessions for this ABHA user
    all_sessions = db.query(PatientSession).filter(
        PatientSession.abha_id == patient_rec.id
    ).order_by(PatientSession.created_at.desc()).all()

    consultations = []
    prescriptions = []
    reports = []
    ocr_scans = []

    for s in all_sessions:
        date_str = s.created_at.strftime("%d %b %Y") if s.created_at else "Previous Visit"
        time_str = s.created_at.strftime("%I:%M %p") if s.created_at else ""
        raw_doc_name = s.assigned_doctor_name or "Consulting Physician"
        clean_name = re.sub(r'^(?:dr\.?\s*)+', '', raw_doc_name, flags=re.IGNORECASE).strip()
        doc_name = f"Dr. {clean_name}" if clean_name else "Consulting Physician"
        room_str = s.assigned_doctor_room or "OPD"
        specialty = s.assigned_doctor_specialty or "General OPD"

        # Check if consultation happened
        has_consultation = bool(
            s.doctor_prescription or 
            s.doctor_notes or 
            (s.structured_summary and isinstance(s.structured_summary, dict) and s.structured_summary.get("confirmed_diagnosis")) or
            (s.status == "completed" and s.id != session_id)
        )

        diag = "Clinical OPD Consultation"
        if s.structured_summary and isinstance(s.structured_summary, dict):
            diag = s.structured_summary.get("confirmed_diagnosis") or s.structured_summary.get("provisional_diagnosis") or diag

        if has_consultation:
            consultations.append({
                "session_id": s.id,
                "date": date_str,
                "time": time_str,
                "doctor_name": doc_name,
                "doctor_specialty": specialty,
                "doctor_room": room_str,
                "diagnosis": diag,
                "notes": s.doctor_notes or "",
                "prescription_raw": s.doctor_prescription or "",
                "token": s.queue_token or "OPD",
                "status": s.queue_status or s.status
            })

        # Prescriptions
        session_meds = []
        if s.structured_summary and isinstance(s.structured_summary, dict) and s.structured_summary.get("prescribed_medications"):
            for idx, m in enumerate(s.structured_summary.get("prescribed_medications")):
                if isinstance(m, dict) and m.get("name"):
                    session_meds.append({
                        "id": f"med_{s.id}_{idx}",
                        "name": m.get("name"),
                        "dosage": m.get("dosage", "1 Tab"),
                        "frequency": m.get("frequency", "1-0-1"),
                        "duration": m.get("duration", "3 days"),
                        "instructions": m.get("instructions", "After meals"),
                        "prescribed_by": doc_name,
                        "doctor_room": room_str,
                        "date": date_str,
                        "source": "Doctor Prescription"
                    })
        elif s.doctor_prescription:
            parsed = parse_rx_text(s.doctor_prescription, doc_name, date_str, room_str)
            session_meds.extend(parsed)

        prescriptions.extend(session_meds)

        # OCR & Diagnostic Reports
        if s.ocr_text and s.ocr_text.strip():
            vitals = extract_vitals_from_text(s.ocr_text)
            ocr_scans.append({
                "session_id": s.id,
                "date": date_str,
                "preview": s.ocr_text[:200].replace("\n", " ").strip() + "...",
                "full_text": s.ocr_text,
                "vitals": vitals
            })
            if vitals:
                summary_parts = []
                if "bp" in vitals: summary_parts.append(f"BP: {vitals['bp']}")
                if "pulse" in vitals: summary_parts.append(f"Pulse: {vitals['pulse']}")
                if "rbs" in vitals: summary_parts.append(f"Blood Sugar: {vitals['rbs']}")
                if "spo2" in vitals: summary_parts.append(f"SpO2: {vitals['spo2']}")
                
                reports.append({
                    "id": f"report_vitals_{s.id}",
                    "title": "Point-of-Care Vitals & Lab Screening",
                    "date": date_str,
                    "facility": "OPD Health Kiosk / Scanned Record",
                    "vitals": vitals,
                    "status": "Recorded",
                    "notes": " | ".join(summary_parts) if summary_parts else "Vitals measured on record."
                })

        # Check triage alert as a diagnostic report
        if s.triage_alert and isinstance(s.triage_alert, dict) and s.triage_alert.get("triggered"):
            reports.append({
                "id": f"report_triage_{s.id}",
                "title": f"Triage Alert: {s.triage_alert.get('category', 'Critical Assessment').upper()}",
                "date": date_str,
                "facility": "Aarogya Kiosk AI Triage",
                "vitals": {},
                "status": s.triage_alert.get("severity", "High"),
                "notes": s.triage_alert.get("reason", "Clinical triage classification triggered during intake screening.")
            })

    age_info = calculate_age_and_group(patient_rec.date_of_birth if patient_rec else None)

    return {
        "status": "success",
        "session_id": session_id,
        "patient": {
            "id": patient_rec.id,
            "full_name": patient_rec.full_name,
            "abha_number": patient_rec.abha_number,
            "abha_address": patient_rec.abha_address,
            "gender": patient_rec.gender,
            "date_of_birth": patient_rec.date_of_birth,
            "mobile_number": patient_rec.mobile_number,
            "blood_group": getattr(patient_rec, "blood_group", "B+"),
            "allergies": getattr(patient_rec, "allergies", "No Known Allergies"),
            "age": age_info["age"],
            "age_group": age_info["age_group"]
        },
        "total_records": len(consultations) + len(prescriptions) + len(reports) + len(ocr_scans),
        "consultations_count": len(consultations),
        "prescriptions_count": len(prescriptions),
        "reports_count": len(reports),
        "ocr_scans_count": len(ocr_scans),
        "consultations": consultations,
        "prescriptions": prescriptions,
        "reports": reports,
        "ocr_scans": ocr_scans
    }

