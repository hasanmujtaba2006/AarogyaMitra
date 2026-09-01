import datetime
from typing import Dict, Any

def create_fhir_patient(patient: Any) -> Dict[str, Any]:
    """Formats patient ABHA records into a standard FHIR Patient resource."""
    gender_map = {
        "M": "male",
        "F": "female",
        "O": "other"
    }
    
    return {
        "resourceType": "Patient",
        "id": f"pat-{patient.id}",
        "active": True,
        "identifier": [
            {
                "system": "https://abha.abdm.gov.in/address",
                "value": patient.abha_address,
                "use": "official"
            },
            {
                "system": "https://abha.abdm.gov.in/number",
                "value": patient.abha_number,
                "use": "secondary"
            }
        ],
        "name": [
            {
                "text": patient.full_name,
                "use": "official"
            }
        ],
        "telecom": [
            {
                "system": "phone",
                "value": patient.mobile_number,
                "use": "mobile"
            }
        ],
        "gender": gender_map.get(patient.gender.upper(), "unknown"),
        "birthDate": patient.date_of_birth
    }

def create_fhir_encounter(session: Any, patient_id: int) -> Dict[str, Any]:
    """Formats kiosk session timeline into a standard FHIR Encounter resource."""
    start_time = session.created_at.isoformat() if session.created_at else datetime.datetime.utcnow().isoformat()
    end_time = session.completed_at.isoformat() if session.completed_at else datetime.datetime.utcnow().isoformat()

    return {
        "resourceType": "Encounter",
        "id": f"enc-{session.id[:12]}",
        "status": "finished",
        "class": {
            "system": "http://terminology.hl7.org/CodeSystem/v3-ActCode",
            "code": "AMB",
            "display": "ambulatory"
        },
        "subject": {
            "reference": f"Patient/pat-{patient_id}"
        },
        "period": {
            "start": start_time,
            "end": end_time
        },
        "serviceProvider": {
            "display": "AarogyaMitra Kiosk Clinic"
        }
    }

def create_fhir_condition(session: Any, patient_id: int, encounter_id: str) -> Dict[str, Any]:
    """Formats clinical summary and OCR findings into a standard FHIR Condition resource."""
    summary_text = session.summary or "Patient completed OPD history intake."
    
    # Try to map chief complaint keywords to standard SNOMED-CT codes
    snomed_code = "404684003" # Clinical finding (default)
    snomed_display = "Clinical finding"
    
    summary_lower = summary_text.lower()
    if "chest pain" in summary_lower:
        snomed_code = "29857009"
        snomed_display = "Chest pain"
    elif "fever" in summary_lower:
        snomed_code = "386661006"
        snomed_display = "Fever"
    elif "diabetes" in summary_lower:
        snomed_code = "44054006"
        snomed_display = "Diabetes mellitus type 2"
    elif "hypertension" in summary_lower or "blood pressure" in summary_lower:
        snomed_code = "38341003"
        snomed_display = "Hypertension"

    notes = [
        {"text": f"Scribed Kiosk Intake Summary:\n{summary_text}"}
    ]
    if getattr(session, "doctor_notes", None):
        notes.append({"text": f"Doctor Clinical Notes:\n{session.doctor_notes}"})
    if getattr(session, "doctor_prescription", None):
        notes.append({"text": f"Doctor Prescription:\n{session.doctor_prescription}"})

    return {
        "resourceType": "Condition",
        "id": f"cond-{session.id[:12]}",
        "clinicalStatus": {
            "coding": [
                {
                    "system": "http://terminology.hl7.org/CodeSystem/condition-clinical",
                    "code": "active"
                }
            ]
        },
        "verificationStatus": {
            "coding": [
                {
                    "system": "http://terminology.hl7.org/CodeSystem/condition-ver-status",
                    "code": "provisional"
                }
            ]
        },
        "category": [
            {
                "coding": [
                    {
                        "system": "http://terminology.hl7.org/CodeSystem/condition-category",
                        "code": "encounter-diagnosis",
                        "display": "Encounter Diagnosis"
                    }
                ]
            }
        ],
        "code": {
            "coding": [
                {
                    "system": "http://snomed.info/sct",
                    "code": snomed_code,
                    "display": snomed_display
                }
            ],
            "text": snomed_display
        },
        "subject": {
            "reference": f"Patient/pat-{patient_id}"
        },
        "encounter": {
            "reference": f"Encounter/{encounter_id}"
        },
        "note": notes
    }

def generate_fhir_bundle(patient: Any, session: Any) -> Dict[str, Any]:
    """Generates a complete transaction-type FHIR Bundle containing Patient, Encounter, and Condition."""
    patient_res = create_fhir_patient(patient)
    encounter_res = create_fhir_encounter(session, patient.id)
    condition_res = create_fhir_condition(session, patient.id, encounter_res["id"])
    
    bundle = {
        "resourceType": "Bundle",
        "id": f"bundle-{session.id[:12]}",
        "type": "document",
        "timestamp": datetime.datetime.utcnow().isoformat() + "Z",
        "entry": [
            {
                "fullUrl": f"urn:uuid:patient-{patient.id}",
                "resource": patient_res
            },
            {
                "fullUrl": f"urn:uuid:encounter-{session.id[:12]}",
                "resource": encounter_res
            },
            {
                "fullUrl": f"urn:uuid:condition-{session.id[:12]}",
                "resource": condition_res
            }
        ]
    }
    
    return bundle
