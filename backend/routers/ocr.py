import base64
import logging
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database import get_db
from models import PatientSession

logger = logging.getLogger("ocr")
router = APIRouter(prefix="/api/ocr", tags=["OCR Scanner"])

from typing import Optional, Dict, Any, List
import json
import os
import re
import httpx
from config import settings

class ScanRequest(BaseModel):
    image: str # Base64 encoded image string

class SaveTextRequest(BaseModel):
    session_id: str
    text: str

MEDICAL_OCR_SYSTEM_PROMPT = """You are an expert AI clinical prescription OCR system specializing in handwritten and printed Indian doctor prescriptions, OPD slips, and hospital notes.

Accurately analyze and extract ONLY the clinical and patient details present in this prescription image into a structured JSON object.

CRITICAL INSTRUCTIONS:
- Extract ONLY what is genuinely legible or identifiable from the image.
- Do NOT invent, assume, or hallucinate patient names, hospital names, diagnoses, or medications.
- If a specific field (e.g. vitals, uhid, complaints, doctor_reg) is NOT visible or cannot be determined from the image, return empty string "" or empty array [].

Medical shorthand domain guidelines:
- 'c/o' stands for 'Complaining of' (chief complaints) e.g. cough, fever, pain.
- 'Imp:' or 'Dx:' stands for Clinical Impression / Provisional Diagnosis.
- 'RBS' stands for 'Random Blood Sugar' (e.g. 110 mg/dl).
- 'o/e' stands for 'On Examination' (clinical signs/vitals).
- 'BP' is Blood Pressure (e.g. 120/80 mmHg).
- 'PR' or 'Pulse' is Pulse Rate (in bpm).
- 'Adv:' or 'Rx' stands for 'Advice / Prescriptions'.
- 'stat' means immediately, 'iv' means intravenous, 'po' or 'oral' means by mouth.

Return ONLY a valid JSON object matching this exact schema (no markdown code fences, no reasoning tokens, no additional text):
{
  "hospital": "<extracted hospital or clinic name, or empty string>",
  "location": "<extracted city, area, or address, or empty string>",
  "date": "<extracted prescription date, or empty string>",
  "patient_name": "<extracted patient name, or empty string>",
  "age": "<extracted patient age, or empty string>",
  "gender": "<extracted patient gender (M/F/O), or empty string>",
  "uhid": "<extracted UHID/OPD registration number, or empty string>",
  "complaints": "<extracted symptoms / chief complaints, or empty string>",
  "diagnosis": "<extracted diagnosis or provisional impression, or empty string>",
  "vitals": {
    "bp": "<extracted BP string like '120/80 mmHg' or empty string>",
    "pulse": "<extracted pulse string like '72 bpm' or empty string>",
    "rbs": "<extracted RBS string like '95 mg/dl' or empty string>"
  },
  "medications": [
    {
      "name": "<prescribed drug/medicine name>",
      "dosage": "<prescribed dosage / frequency>",
      "route": "<route: Oral, IV, Topical, etc.>",
      "instructions": "<instructions for taking the medication>"
    }
  ],
  "doctor_reg": "<extracted doctor registration number or signature info, or empty string>",
  "extracted_markdown": "<clean markdown summary of the extracted prescription content>"
}"""

def clean_llm_json(raw_text: str) -> Dict[str, Any]:
    """Cleans reasoning tokens and markdown code fences to extract valid JSON."""
    cleaned = re.sub(r'<think>.*?</think>', '', raw_text, flags=re.DOTALL).strip()
    if cleaned.startswith('```json'):
        cleaned = cleaned[7:]
    elif cleaned.startswith('```'):
        cleaned = cleaned[3:]
    if cleaned.endswith('```'):
        cleaned = cleaned[:-3]
    cleaned = cleaned.strip()
    return json.loads(cleaned)

def build_markdown_from_details(details: Dict[str, Any]) -> str:
    """Builds clean markdown representation from structured prescription details."""
    hospital = details.get("hospital", "Medical Centre")
    location = details.get("location", "")
    date = details.get("date", "Today")
    patient_name = details.get("patient_name", "Patient")
    age = details.get("age", "")
    gender = details.get("gender", "")
    uhid = details.get("uhid", "")
    complaints = details.get("complaints", "Not specified")
    diagnosis = details.get("diagnosis", "Not specified")
    vitals = details.get("vitals", {})
    bp = vitals.get("bp", "Not recorded") if isinstance(vitals, dict) else "Not recorded"
    pulse = vitals.get("pulse", "Not recorded") if isinstance(vitals, dict) else "Not recorded"
    rbs = vitals.get("rbs", "") if isinstance(vitals, dict) else ""
    meds = details.get("medications", [])
    doctor_reg = details.get("doctor_reg", "")

    age_gender = f"{age} / {gender}".strip(" /")

    md_lines = [
        "### 🏥 Hospital / Clinic Details",
        f"- **Facility**: {hospital}",
    ]
    if location:
        md_lines.append(f"- **Location**: {location}")
    if date:
        md_lines.append(f"- **Date**: {date}")

    md_lines.extend([
        "",
        "### 👤 Patient Information",
        f"- **Name**: {patient_name}",
    ])
    if age_gender:
        md_lines.append(f"- **Age / Gender**: {age_gender}")
    if uhid:
        md_lines.append(f"- **UHID / IP No.**: {uhid}")

    md_lines.extend([
        "",
        "### 🩺 Clinical Findings & Observations",
        f"- **Chief Complaints (c/o)**: {complaints}",
        f"- **Clinical Impression / Diagnosis (Imp)**: {diagnosis}",
        "- **Vitals & Examination (o/e)**:",
        f"  - **Blood Pressure (BP)**: {bp}",
        f"  - **Pulse Rate (PR)**: {pulse}",
    ])
    if rbs:
        md_lines.append(f"  - **Blood Sugar (RBS)**: {rbs}")

    md_lines.extend([
        "",
        "### 💊 Prescribed Medications & Advice (Adv)",
    ])
    if meds and isinstance(meds, list):
        for med in meds:
            if isinstance(med, dict):
                m_name = med.get("name", "")
                m_dose = med.get("dosage", "")
                m_route = med.get("route", "")
                m_inst = med.get("instructions", "")
                parts = [p for p in [m_name, f"({m_route})" if m_route else "", f"Dose: {m_dose}" if m_dose else "", m_inst] if p]
                md_lines.append(f"- {' - '.join(parts)}")
            else:
                md_lines.append(f"- {str(med)}")
    else:
        md_lines.append("- No specific medications prescribed.")

    if doctor_reg:
        md_lines.extend([
            "",
            "### 👨‍⚕️ Doctor Sign-off",
            f"- **Doctor Registration / Signature**: {doctor_reg}",
        ])

    return "\n".join(md_lines)

def run_tesseract_fallback(image_bytes: bytes) -> Dict[str, Any]:
    """Fallback OCR using local Tesseract engine if Groq API is unavailable."""
    try:
        from PIL import Image
        import io
        import pytesseract
        
        tesseract_bin = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
        if os.path.exists(tesseract_bin):
            pytesseract.pytesseract.tesseract_cmd = tesseract_bin
        
        img = Image.open(io.BytesIO(image_bytes))
        raw_ocr = pytesseract.image_to_string(img)
        logger.info(f"Tesseract fallback extracted text: {len(raw_ocr)} chars.")
        
        # Parse vitals using regex patterns if legible in OCR output
        bp_match = re.search(r'\b(1?\d{2}/\d{2,3})\s*(?:mm\s*hg)?\b', raw_ocr, re.IGNORECASE)
        pulse_match = re.search(r'\b(?:pr|pulse|hr)\s*[:=-]?\s*(\d{2,3})\s*(?:bpm)?\b', raw_ocr, re.IGNORECASE)
        rbs_match = re.search(r'\b(?:rbs|sugar|glucose)\s*[:=-]?\s*(\d{2,3})\s*(?:mg/dl)?\b', raw_ocr, re.IGNORECASE)
        date_match = re.search(r'\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b', raw_ocr)
        reg_match = re.search(r'\b(?:reg(?:\.?|istration)?|kcm)\s*(?:no\.?|#)?\s*[:=-]?\s*(\d{4,8})\b', raw_ocr, re.IGNORECASE)
        
        vitals: Dict[str, str] = {}
        if bp_match:
            vitals["bp"] = f"{bp_match.group(1)} mmHg"
        if pulse_match:
            vitals["pulse"] = f"{pulse_match.group(1)} bpm"
        if rbs_match:
            vitals["rbs"] = f"{rbs_match.group(1)} mg/dl"
            
        details = {
            "hospital": "",
            "location": "",
            "date": date_match.group(1) if date_match else "",
            "patient_name": "",
            "age": "",
            "gender": "",
            "uhid": "",
            "complaints": "",
            "diagnosis": "",
            "vitals": vitals,
            "medications": [],
            "doctor_reg": reg_match.group(1) if reg_match else "",
            "extracted_markdown": raw_ocr.strip()
        }
        return details
    except Exception as e:
        logger.warning(f"Local Tesseract fallback failed: {e}")
        return {
            "hospital": "",
            "location": "",
            "date": "",
            "patient_name": "",
            "age": "",
            "gender": "",
            "uhid": "",
            "complaints": "",
            "diagnosis": "",
            "vitals": {},
            "medications": [],
            "doctor_reg": "",
            "extracted_markdown": ""
        }

@router.post("/scan")
async def scan_prescription(payload: ScanRequest):
    """
    Scans base64 prescription images to extract accurate, structured clinical data.
    Uses Groq Vision (Qwen 3.8-27B) with local Tesseract OCR fallback.
    """
    if not payload.image:
        raise HTTPException(status_code=400, detail="No image provided")

    try:
        # Extract clean base64 image data
        image_data = payload.image
        if "base64," in image_data:
            image_data = image_data.split("base64,")[1]
        
        decoded_bytes = base64.b64decode(image_data)
        logger.info(f"Received prescription image for scanning. Size: {len(decoded_bytes)} bytes.")

        details: Optional[Dict[str, Any]] = None

        # 1. Primary: Groq Vision API (Qwen 3.8-27B & Qwen 3.6-27B)
        if settings.GROQ_API_KEY:
            for model_name in ["qwen/qwen3.8-27b", "qwen/qwen3.6-27b"]:
                try:
                    logger.info(f"Attempting prescription OCR with Groq model: {model_name}")
                    async with httpx.AsyncClient(timeout=45.0) as client:
                        resp = await client.post(
                            "https://api.groq.com/openai/v1/chat/completions",
                            headers={
                                "Authorization": f"Bearer {settings.GROQ_API_KEY}",
                                "Content-Type": "application/json"
                            },
                            json={
                                "model": model_name,
                                "messages": [
                                    {
                                        "role": "user",
                                        "content": [
                                            {"type": "text", "text": MEDICAL_OCR_SYSTEM_PROMPT},
                                            {
                                                "type": "image_url",
                                                "image_url": {"url": f"data:image/jpeg;base64,{image_data}"}
                                            }
                                        ]
                                    }
                                ],
                                "max_tokens": 2000,
                                "temperature": 0.1
                            }
                        )
                        if resp.status_code == 200:
                            raw_content = resp.json()["choices"][0]["message"]["content"]
                            details = clean_llm_json(raw_content)
                            logger.info(f"Successfully extracted structured prescription with {model_name}")
                            break
                        else:
                            logger.warning(f"Groq {model_name} error ({resp.status_code}): {resp.text[:200]}")
                except Exception as g_err:
                    logger.warning(f"Groq {model_name} failed: {g_err}")

        # 2. Fallback: Local Tesseract OCR
        if not details:
            logger.info("Falling back to local Tesseract OCR engine...")
            details = run_tesseract_fallback(decoded_bytes)

        # Build consistent clean markdown summary
        extracted_text = details.get("extracted_markdown") or build_markdown_from_details(details)
        if not details.get("extracted_markdown"):
            details["extracted_markdown"] = extracted_text

        return {
            "status": "success",
            "extracted_text": extracted_text,
            "details": details
        }

    except Exception as e:
        logger.error(f"OCR processing failed: {e}")
        raise HTTPException(status_code=500, detail=f"OCR processing failed: {str(e)}")

@router.post("/save-text")
def save_ocr_text(payload: SaveTextRequest, db: Session = Depends(get_db)):
    """
    Saves extracted prescription text into the active patient session database record.
    """
    session = db.query(PatientSession).filter(PatientSession.id == payload.session_id).first()
    if not session:
        session = PatientSession(id=payload.session_id, status="active")
        db.add(session)
        db.commit()
        db.refresh(session)

    try:
        session.ocr_text = payload.text
        db.commit()
        return {"status": "success", "message": "Prescription text linked to session"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database update failed: {str(e)}")
