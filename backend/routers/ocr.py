import base64
import logging
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database import get_db
from models import PatientSession

logger = logging.getLogger("ocr")
router = APIRouter(prefix="/api/ocr", tags=["OCR Scanner"])

class ScanRequest(BaseModel):
    image: str # Base64 encoded image string

class SaveTextRequest(BaseModel):
    session_id: str
    text: str

@router.post("/scan")
async def scan_prescription(payload: ScanRequest):
    """
    Scans base64 prescription images to extract text.
    Implements placeholders for integration with Google Document AI, Donut, or TrOCR.
    """
    if not payload.image:
        raise HTTPException(status_code=400, detail="No image provided")

    try:
        # Extract base64 clean content
        image_data = payload.image
        if "base64," in image_data:
            image_data = image_data.split("base64,")[1]
        
        decoded_bytes = base64.b64decode(image_data)
        logger.info(f"Received prescription image for scanning. Size: {len(decoded_bytes)} bytes.")

        # --- INTEGRATION PLACEHOLDERS ---
        
        # Placeholder 1: Google Document AI
        # client = documentai.DocumentProcessorServiceClient()
        # raw_document = documentai.RawDocument(content=decoded_bytes, mime_type="image/jpeg")
        # request = documentai.ProcessRequest(name=processor_path, raw_document=raw_document)
        # result = client.process_document(request=request)
        # text = result.document.text

        # Placeholder 2: Local TrOCR / Donut Model Pipeline
        # processor = TrOCRProcessor.from_pretrained("microsoft/trocr-large-printed")
        # model = VisionEncoderDecoderModel.from_pretrained("microsoft/trocr-large-printed")
        # pixel_values = processor(images=image, return_tensors="pt").pixel_values
        # generated_ids = model.generate(pixel_values)
        # text = processor.batch_decode(generated_ids, skip_special_tokens=True)[0]

        # High-Fidelity Mock Extracted Medical Data for Testing
        extracted_text = (
            "PRESCRIPTION DETAILS:\n"
            "Patient Name: Amit Sharma\n"
            "Diagnosis: Type 2 Diabetes Mellitus, Mild Hypertension\n"
            "Prescribed Drugs:\n"
            "1. Tab. Metformin 500mg - Once daily after dinner (OD)\n"
            "2. Tab. Amlodipine 5mg - Once daily in morning (OD)\n"
            "3. Tab. Paracetamol 650mg - As needed for fever/headache (PRN)\n"
            "Date of Prescription: 12-05-2026\n"
            "Refill: No"
        )
        
        return {
            "status": "success",
            "extracted_text": extracted_text
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
        raise HTTPException(status_code=404, detail="Active patient session not found")

    try:
        session.ocr_text = payload.text
        db.commit()
        return {"status": "success", "message": "Prescription text linked to session"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database update failed: {str(e)}")
