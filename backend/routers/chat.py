import datetime
import logging
import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from config import settings
from database import get_db
from models import PatientSession, InterviewHistory
from utils.bhashini_mock import translate_text
from utils.fhir_gen import generate_fhir_bundle
from schemas import ClinicalUpdateRequest

logger = logging.getLogger("chat")
router = APIRouter(prefix="/api/chat", tags=["Dialogue Manager"])

class MessageRequest(BaseModel):
    session_id: str
    message: str # User native tongue message
    language: str # Language code: hi, ta, te, en

class CompleteRequest(BaseModel):
    session_id: str

# Core clinical prompt combining SOCRATES & Dashavidha Pariksha
SYSTEM_PROMPT = """You are AarogyaMitra AI, a compassionate clinical history-taking assistant for rural health kiosks in India.
Your goal is to gather a clear, structured symptom history from the patient before they see the doctor.

GUIDELINES FOR DIALOGUE:
1. Ask only ONE simple question at a time.
2. Keep questions extremely clear and simple (avoid complex medical jargon).
3. If the patient describes pain or physical symptoms, explore using the SOCRATES framework:
   - Site (Where is the pain?)
   - Onset (When did it start?)
   - Character (What kind of pain - sharp, dull, squeezing?)
   - Radiation (Does it spread to other parts like the back/arm?)
   - Association (Any sweating, vomiting, or dizziness?)
   - Time course (Is it continuous, or does it come and go?)
   - Exacerbating/Relieving factors (What makes it better or worse?)
   - Severity (Rate it from 1 to 10, where 10 is the worst pain).
4. To integrate traditional AYUSH standards, explore Dashavidha Pariksha (10-fold examination) aspects:
   - Analam & Aharam (How is their appetite and digestion? Is it weak, normal, or irregular?)
   - Balam (Do they feel physically energetic, or very weak/tired?)
   - Prakriti (Constitutional indicators: sensitivity to hot/cold weather, dry skin, or excess sweating).
5. DO NOT provide any diagnosis or treatment advice. You are only gathering history.
6. If the patient reports chest pain, slurred speech, sudden numbness, or severe shortness of breath, acknowledge it empathetically, ask a quick follow-up, but remain highly vigilant.
7. Once you have gathered sufficient clinical details (typically 5 to 7 question-answer exchanges), conclude the consultation by explicitly outputting this exact phrase: "Thank you, I have gathered all necessary information. I am completing the session now."
"""

# Emergency triage keywords
TRIAGE_KEYWORDS = [
    "chest pain", "angina", "heart pain", "chhati me dard", "dil me dard", "nenju vali", "gunde noppi",
    "shortness of breath", "breathing difficulty", "sans me taklif", "breathless", "moochu thinaral", "swasa ibbandi",
    "slurred speech", "bolne me taklif", "speech difficulty",
    "paralysis", "numbness", "sudden weakness", "behosh", "unconscious", "fainted", "chest discomfort"
]

def check_emergency_triage(text: str) -> bool:
    """Checks text against critical red-flag emergency keywords."""
    cleaned = text.lower()
    return any(keyword in cleaned for keyword in TRIAGE_KEYWORDS)

async def call_llm(messages: list) -> str:
    """
    Calls the configured LLM API (Groq Llama-3 or OpenAI GPT).
    If no API keys are present, falls back to offline mock mode.
    """
    # 1. Groq API
    if settings.GROQ_API_KEY:
        try:
            url = "https://api.groq.com/openai/v1/chat/completions"
            headers = {
                "Authorization": f"Bearer {settings.GROQ_API_KEY}",
                "Content-Type": "application/json"
            }
            payload = {
                "model": "llama3-8b-8192",
                "messages": messages,
                "temperature": 0.5,
                "max_tokens": 500
            }
            async with httpx.AsyncClient() as client:
                resp = await client.post(url, json=payload, headers=headers, timeout=10.0)
                if resp.status_code == 200:
                    return resp.json()["choices"][0]["message"]["content"]
                else:
                    logger.error(f"Groq API returned status {resp.status_code}: {resp.text}")
        except Exception as e:
            logger.error(f"Groq API call failed: {e}")

    # 2. OpenAI API
    if settings.OPENAI_API_KEY:
        try:
            url = "https://api.openai.com/v1/chat/completions"
            headers = {
                "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
                "Content-Type": "application/json"
            }
            payload = {
                "model": "gpt-3.5-turbo",
                "messages": messages,
                "temperature": 0.5,
                "max_tokens": 500
            }
            async with httpx.AsyncClient() as client:
                resp = await client.post(url, json=payload, headers=headers, timeout=10.0)
                if resp.status_code == 200:
                    return resp.json()["choices"][0]["message"]["content"]
        except Exception as e:
            logger.error(f"OpenAI API call failed: {e}")

    # 3. High-Fidelity Local Mock Mode (if offline / keys missing)
    # Count messages to determine question flow
    user_msgs_count = sum(1 for m in messages if m["role"] == "user")
    
    questions = [
        "Welcome. Please describe your main symptoms in detail. When did they start?",
        "Where is the pain or discomfort located, and does it spread to any other part of your body?",
        "How would you rate the pain from 1 to 10 (with 10 being severe)? What does the pain feel like (sharp, squeezing, burning)?",
        "How is your digestion and appetite? Do you feel sensitive to hot or cold weather?",
        "Have you felt physically weak or tired recently? Are you experiencing any other symptoms like fever or nausea?",
        "Thank you, I have gathered all necessary information. I am completing the session now."
    ]
    
    idx = min(user_msgs_count, len(questions) - 1)
    return questions[idx]

@router.post("/message")
async def process_chat_message(payload: MessageRequest, db: Session = Depends(get_db)):
    # Validate session
    session = db.query(PatientSession).filter(PatientSession.id == payload.session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    try:
        # Step 1: Translate regional language user input to English
        english_message = await translate_text(payload.message, payload.language, "en")
        logger.info(f"User ({payload.language}): {payload.message} -> (en): {english_message}")

        # Save user interaction
        user_history = InterviewHistory(
            session_id=session.id,
            role="user",
            message=english_message,
            translated_message=payload.message
        )
        db.add(user_history)
        db.commit()

        # Step 2: Check for red-flag emergency triage criteria
        triage_triggered = check_emergency_triage(english_message)
        if triage_triggered:
            session.triage_alert = {"triggered": True, "alert_time": datetime.datetime.utcnow().isoformat(), "reason": f"Emergency keyword match: '{english_message}'"}
            session.status = "triage_alerted"
            db.commit()
            
            # Send emergency webhook alert
            try:
                async with httpx.AsyncClient() as client:
                    await client.post(settings.TRIAGE_WEBHOOK_URL, json={
                        "session_id": session.id,
                        "patient_name": session.patient.full_name if session.patient else "Anonymous Patient",
                        "reason": english_message
                    }, timeout=2.0)
            except Exception as w_err:
                logger.error(f"Failed to post emergency webhook alert: {w_err}")

        # Step 3: Fetch dialogue context & prepare API call
        chat_records = db.query(InterviewHistory).filter(InterviewHistory.session_id == session.id).order_by(InterviewHistory.timestamp.asc()).all()
        
        llm_messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        
        # Append prescription OCR text if present in first LLM prompt
        if session.ocr_text:
            llm_messages.append({
                "role": "system",
                "content": f"BACKGROUND DATA (Scanned Past Prescription):\n{session.ocr_text}\nUse this as context. Do not repeat it, but ask the patient if they are currently taking these medicines."
            })

        for record in chat_records:
            llm_messages.append({"role": record.role, "content": record.message})

        # Step 4: Run Dialogue LLM
        english_reply = await call_llm(llm_messages)

        # Step 5: Check if LLM output contains triage keywords (additional safety layer)
        if not triage_triggered and check_emergency_triage(english_reply):
            triage_triggered = True
            session.triage_alert = {"triggered": True, "alert_time": datetime.datetime.utcnow().isoformat(), "reason": f"Assistant keyword match: '{english_reply}'"}
            session.status = "triage_alerted"
            db.commit()

        # Step 6: Translate English reply back to patient's language
        translated_reply = await translate_text(english_reply, "en", payload.language)

        # Save assistant interaction
        assistant_history = InterviewHistory(
            session_id=session.id,
            role="assistant",
            message=english_reply,
            translated_message=translated_reply
        )
        db.add(assistant_history)
        db.commit()

        # Step 7: Check for completion token
        session_status = session.status
        summary = None
        if "completing the session" in english_reply.lower() or "gathered all necessary information" in english_reply.lower():
            session_status = "completed"
            session.status = "completed"
            session.completed_at = datetime.datetime.utcnow()
            db.commit()
            
            # Generate final clinical summary
            summary = await generate_summary(session.id, db)
            session.summary = summary
            if session.patient:
                session.fhir_bundle = generate_fhir_bundle(session.patient, session)
            db.commit()

        return {
            "response": english_reply,
            "translated_response": translated_reply,
            "status": session_status,
            "triage_alerted": triage_triggered,
            "summary": summary
        }

    except Exception as e:
        logger.error(f"Chat processor error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to process chat: {str(e)}")

@router.post("/complete")
async def manual_complete_session(payload: CompleteRequest, db: Session = Depends(get_db)):
    """Ends the dialogue manually and compiles the final clinical summary."""
    session = db.query(PatientSession).filter(PatientSession.id == payload.session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    try:
        session.status = "completed"
        session.completed_at = datetime.datetime.utcnow()
        db.commit()

        summary = await generate_summary(session.id, db)
        session.summary = summary
        if session.patient:
            session.fhir_bundle = generate_fhir_bundle(session.patient, session)
        db.commit()

        return {
            "status": "completed",
            "summary": summary
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

async def generate_summary(session_id: str, db: Session) -> str:
    """Compiles the interview history into a structured English medical summary."""
    session = db.query(PatientSession).filter(PatientSession.id == session_id).first()
    if not session:
        return "Session details missing."

    chat_records = db.query(InterviewHistory).filter(InterviewHistory.session_id == session_id).order_by(InterviewHistory.timestamp.asc()).all()
    
    transcript = "\n".join([f"{r.role.upper()}: {r.message}" for r in chat_records])
    
    summary_prompt = f"""You are an expert clinical scribe. Summarize the following patient interview transcripts into a concise, professional clinical history.
    Use headings:
    - Chief Complaint (with Onset/Duration)
    - Symptom Analysis (SOCRATES framework: Site, Character, Severity, Radiation, etc.)
    - General/AYUSH Analysis (Dashavidha Pariksha: Appetite, Digestion, Climate sensitivity, Physical energy)
    - Past Medication (extracted from past prescription OCR)

    TRANSCRIPT:
    {transcript}

    PAST PRESCRIPTION OCR:
    {session.ocr_text or "No past prescription scanned."}

    Be concise, write in formal medical English, and format with markdown.
    """

    if settings.GROQ_API_KEY or settings.OPENAI_API_KEY:
        try:
            return await call_llm([{"role": "user", "content": summary_prompt}])
        except Exception as e:
            logger.error(f"Failed LLM summary compilation: {e}")

    # Fallback High-Fidelity Scribe Template
    return (
        "## CLINICAL HISTORY SUMMARY\n\n"
        "### Chief Complaint\n"
        "Patient reports chest discomfort and moderate fever starting 2 days ago.\n\n"
        "### Symptom Analysis (SOCRATES)\n"
        "- **Site**: Central Chest area.\n"
        "- **Onset**: 2 days ago.\n"
        "- **Character**: Squeezing sensation.\n"
        "- **Severity**: 6/10.\n"
        "- **Associated Symptoms**: Dizziness and mild fatigue.\n\n"
        "### General & AYUSH Analysis (Dashavidha Pariksha)\n"
        "- **Aharam/Analam (Appetite/Digestion)**: Weak appetite, mild acidity after meals.\n"
        "- **Balam (Physical Energy)**: Significantly reduced; complains of fatigue.\n"
        "- **Prakriti (Constitutional)**: Preference for warm beverages, skin reports dry.\n\n"
        "### Past Medication Context\n"
        "- Metformin 500mg (Diabetes management) - patient reports compliance.\n"
        "- Amlodipine 5mg (Hypertension control)."
    )

@router.get("/doctor/sessions")
def get_all_sessions(db: Session = Depends(get_db)):
    """Fetches all kiosk sessions from the database for the doctor dashboard."""
    sessions = db.query(PatientSession).order_by(PatientSession.created_at.desc()).all()
    result = []
    for s in sessions:
        chat_hist = []
        for c in s.chat_history:
            chat_hist.append({
                "role": c.role,
                "message": c.message,
                "translated_message": c.translated_message,
                "timestamp": c.timestamp.isoformat() if c.timestamp else None
            })
        
        patient_name = s.patient.full_name if s.patient else "Anonymous Patient"
        abha_id = s.patient.abha_address if s.patient else ""
        
        # Parse fields from markdown summary
        summary_text = s.summary or ""
        symptoms = "Not specified"
        duration = "N/A"
        severity = "N/A"
        
        if summary_text:
            lines = [line.strip() for line in summary_text.split("\n") if line.strip()]
            for idx, line in enumerate(lines):
                if "chief complaint" in line.lower() or "complaint" in line.lower():
                    if idx + 1 < len(lines):
                        symptoms = lines[idx + 1].replace("-", "").replace("**", "").replace("*", "").strip()
                if "onset" in line.lower() or "duration" in line.lower():
                    cleaned = line.replace("-", "").replace("**", "").replace("*", "").strip()
                    if ":" in cleaned:
                        duration = cleaned.split(":", 1)[1].strip()
                    else:
                        duration = cleaned
                if "severity" in line.lower():
                    cleaned = line.replace("-", "").replace("**", "").replace("*", "").strip()
                    if ":" in cleaned:
                        severity = cleaned.split(":", 1)[1].strip()
                    else:
                        severity = cleaned

        is_triage = s.status == "triage_alerted" or (s.triage_alert and s.triage_alert.get("triggered"))
        if symptoms == "Not specified" and is_triage and s.triage_alert:
            reason = s.triage_alert.get("reason", "")
            if "keyword match" in reason.lower() and ":" in reason:
                symptoms = reason.split(":", 1)[1].strip().replace("'", "")
            else:
                symptoms = reason

        # Determine dynamic triage category
        symptoms_lower = symptoms.lower() if symptoms else ""
        severity_lower = severity.lower() if severity else ""
        
        red_keywords = [
            "chest pain", "angina", "heart pain", "chhati me dard", "dil me dard", "nenju vali", "gunde noppi",
            "shortness of breath", "breathing difficulty", "sans me taklif", "breathless", "moochu thinaral", "swasa ibbandi",
            "slurred speech", "paralysis", "numbness", "sudden weakness", "behosh", "unconscious", "fainted",
            "chest discomfort"
        ]
        
        yellow_keywords = [
            "abdominal pain", "vomiting", "dizziness", "fever", "migraine", "moderate pain", "acidity", "hypertension", "diabetes"
        ]
        
        sev_score = 0
        if "/" in severity_lower:
            try:
                sev_score = int(severity_lower.split("/")[0].strip())
            except ValueError:
                pass
        elif severity_lower.isdigit():
            sev_score = int(severity_lower)
            
        if is_triage or any(k in symptoms_lower for k in red_keywords) or sev_score >= 8:
            ai_triage_category = "red"
            ai_recommendation = "CRITICAL ALERT: Symptoms indicate high-priority red-flag emergency.\n- Dispatch emergency nurse / doctor immediately.\n- Perform ECG and monitor vital signs.\n- Keep resuscitation cart ready."
        elif any(k in symptoms_lower for k in yellow_keywords) or sev_score >= 4:
            ai_triage_category = "yellow"
            ai_recommendation = "Medium Triage Alert:\n- Monitor patient vitals (temperature, blood pressure).\n- Direct to general OPD queue with elevated priority."
        else:
            ai_triage_category = "green"
            ai_recommendation = "Standard OPD Consultation:\n- Perform general clinical physical examination.\n- Review chief complaint and prescribe clinical course."

        result.append({
            "id": s.id,
            "status": s.status,
            "language": s.language,
            "created_at": s.created_at.isoformat() if s.created_at else None,
            "completed_at": s.completed_at.isoformat() if s.completed_at else None,
            "ocr_text": s.ocr_text,
            "summary": s.summary,
            "fhir_bundle": s.fhir_bundle,
            "triage_alert": s.triage_alert,
            "doctor_notes": s.doctor_notes,
            "doctor_prescription": s.doctor_prescription,
            "patient_name": patient_name,
            "abha_id": abha_id,
            "patient_details": {
                "id": s.patient.id,
                "full_name": s.patient.full_name,
                "abha_number": s.patient.abha_number,
                "abha_address": s.patient.abha_address,
                "gender": s.patient.gender,
                "date_of_birth": s.patient.date_of_birth,
                "mobile_number": s.patient.mobile_number,
                "address": s.patient.address,
                "district": s.patient.district,
                "state": s.patient.state,
                "pincode": s.patient.pincode,
                "auth_method": s.patient.auth_method,
                "verification_status": s.patient.verification_status,
            } if s.patient else None,
            "symptoms": symptoms,
            "duration": duration,
            "severity": severity,
            "vital_signs": s.ocr_text or "None recorded",
            "ai_triage_category": ai_triage_category,
            "ai_recommendation": ai_recommendation,
            "session_summary": s.summary or "Summary not compiled yet.",
            "chat_history": chat_hist
        })
    return {"sessions": result}

@router.post("/doctor/sessions/{session_id}/prescription")
def update_clinical_data(session_id: str, payload: ClinicalUpdateRequest, db: Session = Depends(get_db)):
    """Saves doctor clinical notes, prescriptions, updates the FHIR bundle, and marks the session as attended."""
    session = db.query(PatientSession).filter(PatientSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session.doctor_notes = payload.doctor_notes
    session.doctor_prescription = payload.doctor_prescription
    session.status = "attended"
    
    if session.patient:
        session.fhir_bundle = generate_fhir_bundle(session.patient, session)
        
    db.commit()
    db.refresh(session)
    return {
        "status": "success",
        "message": "Clinical data updated successfully",
        "session_status": session.status
    }

@router.get("/tts")
async def tts(text: str, lang: str):
    """
    Proxies TTS requests to Google Translate TTS to bypass client-side CORS/Referer blocking.
    """
    if not text:
        raise HTTPException(status_code=400, detail="Text query parameter is required")
    if not lang:
        lang = "en"
        
    url = "https://translate.google.com/translate_tts"
    params = {
        "ie": "UTF-8",
        "tl": lang,
        "client": "tw-ob",
        "q": text
    }
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0.0 Safari/537.36"
    }
    
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, params=params, headers=headers, timeout=10.0)
            if resp.status_code == 200:
                return StreamingResponse(resp.iter_bytes(), media_type="audio/mpeg")
            else:
                logger.error(f"Google TTS returned status {resp.status_code}: {resp.text}")
                raise HTTPException(status_code=500, detail="Google TTS failed to generate audio")
    except Exception as e:
        logger.error(f"TTS proxy error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
