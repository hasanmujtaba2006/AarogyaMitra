import datetime
import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

logger = logging.getLogger("triage")
router = APIRouter(prefix="/api/triage", tags=["Red-Flag Emergency Triage"])

class TriageAlertPayload(BaseModel):
    session_id: str
    patient_name: str
    reason: str

@router.post("/alert-triage")
def receive_triage_alert(payload: TriageAlertPayload):
    """
    Webhook Endpoint: Receives red-flag emergency notifications.
    Simulates sending instant SMS/Pager notifications to OPD nurses/cardiologists.
    """
    timestamp = datetime.datetime.utcnow().isoformat()
    
    # Print high-visibility warning to logs
    print(f"\n\n🚨 [RED-FLAG EMERGENY WARNING - {timestamp}] 🚨")
    print(f"PATIENT: {payload.patient_name}")
    print(f"SESSION ID: {payload.session_id}")
    print(f"CRITICAL REASON: {payload.reason}")
    print("ACTION: Dispatching emergency nurse team to Kiosk immediately!\n\n")

    logger.warning(f"Triage Alert Triggered for Patient '{payload.patient_name}' due to: {payload.reason}")
    
    return {
        "status": "alert_dispatched",
        "timestamp": timestamp,
        "message": f"OPD emergency team notified for {payload.patient_name}"
    }
