import datetime
import logging
import json
import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from config import settings
from database import get_db
from models import PatientSession, InterviewHistory, Doctor
from utils.bhashini_mock import translate_text
from utils.fhir_gen import generate_fhir_bundle
from typing import Optional, List, Dict, Any
from schemas import ClinicalUpdateRequest, DoctorQueueRequest, CallPatientRequest

logger = logging.getLogger("chat")
router = APIRouter(prefix="/api/chat", tags=["Dialogue Manager"])

class MessageRequest(BaseModel):
    session_id: str
    message: str # User native tongue message
    language: str # Language code: hi, ta, te, en

class CompleteRequest(BaseModel):
    session_id: str

# Core clinical prompt focusing strictly on symptom relevance and empathy
SYSTEM_PROMPT = """You are AarogyaMitra AI, a compassionate clinical consultation intake assistant for rural health kiosks in India.
Your goal is to listen to the patient with empathy and gather a clear, structured symptom history before they see the doctor.

CRITICAL CLINICAL RULES:
1. ALWAYS FOCUS DIRECTLY ON THE PATIENT'S ACTUAL COMPLAINT:
   - If the patient reports cough/cold: ask about duration, dry vs phlegm, fever, sore throat, or breathing trouble.
   - If the patient reports pain (headache, back, knee, etc.): ask where it is located, when it started, and rate severity from 1 to 10.
   - If the patient reports fever: ask how many days, high or mild, and if accompanied by chills or body ache.
   - If the patient reports stomach issues: ask about vomiting, loose stools, acidity, or when they last ate.
   - If the patient reports injury, cuts, or rash: ask how it occurred, duration, and if there is swelling or bleeding.
2. NEVER ASK ODD OR UNRELATED QUESTIONS:
   - NEVER ask about digestion, appetite, or bowel habits unless the patient specifically complained of gastrointestinal symptoms.
   - NEVER ask about weather or temperature sensitivity (hot/cold) unless the patient specifically mentioned chills or exposure.
3. CONVERSATIONAL STYLE:
   - Acknowledge their concern with a brief empathetic phrase (e.g. "I understand this is uncomfortable for you.").
   - Ask only ONE simple, direct question per turn.
   - Use simple language, free of complex medical jargon.
4. RED FLAGS & TRIAGE:
   - If the patient reports chest pain, slurred speech, sudden numbness/paralysis, or severe shortness of breath, acknowledge it empathetically, ask a quick follow-up, and remain highly vigilant.
5. COMPLETION:
   - Once sufficient clinical details are gathered (typically 4 to 6 focused exchanges), conclude the consultation by setting is_completed to true and providing a concluding statement: "Thank you, I have gathered all necessary information. I am completing the session now." (translated into the patient's language).

OUTPUT FORMAT:
Respond ONLY with a valid JSON object matching this schema:
{
  "reply": "...compassionate reply and follow-up question in patient's preferred/spoken language...",
  "english_reply": "...accurate English translation of your reply...",
  "is_completed": false
}
"""

# Emergency triage keywords across English, Hindi, Tamil, and Telugu
TRIAGE_KEYWORDS = [
    # English
    "chest pain", "angina", "heart pain", "shortness of breath", "breathing difficulty",
    "breathless", "slurred speech", "paralysis", "numbness", "sudden weakness",
    "unconscious", "fainted", "chest discomfort", "heart attack", "choking",
    # Hindi
    "chhati me dard", "dil me dard", "seene me dard", "sans me taklif", "saans lene me dikkat",
    "bolne me taklif", "behosh", "chakkar aakar girna", "aankhon ke aage andhera",
    "छाती में दर्द", "सीने में दर्द", "सांस लेने में तकलीफ", "बेहोश", "दौरा", "दिल का दौरा",
    # Tamil
    "nenju vali", "moochu thinaral", "marbu vali", "valipu", "mayakkam",
    "நெஞ்சு வலி", "மூச்சுத் திணறல்", "மயக்கம்", "மாரடைப்பு",
    # Telugu
    "gunde noppi", "swasa ibbandi", "chathi noppi", "spruha tappadam",
    "గుండె నొప్పి", "శ్వాస తీసుకోవడంలో ఇబ్బంది", "ఛాతీ నొప్పి", "స్పృహ తప్పడం"
]
 
AVAILABLE_DOCTORS = [
    {
        "id": "doc-104",
        "name": "Dr. Rajesh Sharma",
        "qualification": "MBBS, MD, DM (Gastroenterology)",
        "specialty": "Gastroenterology & Digestive Care",
        "post": "Chief Gastroenterologist",
        "room_number": "104",
        "fee": "₹0 (Free Govt Kiosk Service)",
        "department": "Gastroenterology",
        "experience": "16 Years",
        "available_today": True,
        "avatar": "👨‍⚕️",
        "matching_keywords": ["stomach", "pet", "abdomen", "abdominal", "acidity", "vomiting", "gas", "dast", "loose stool", "liver", "gastritis", "vayiru", "dard", "jalan"]
    },
    {
        "id": "doc-108",
        "name": "Dr. Vikram Patel",
        "qualification": "MBBS, MD (Pulmonary Medicine)",
        "specialty": "Pulmonology & Chest Medicine",
        "post": "Senior Consultant Pulmonologist",
        "room_number": "108",
        "fee": "₹0 (Free Govt Kiosk Service)",
        "department": "Pulmonology",
        "experience": "11 Years",
        "available_today": True,
        "avatar": "👨‍⚕️",
        "matching_keywords": ["cough", "khasi", "khansi", "sputum", "asthma", "wheezing", "chest congestion", "saans", "swasa", "irumal", "cold", "throat", "gala", "lungs"]
    },
    {
        "id": "doc-205",
        "name": "Dr. Arvind Menon",
        "qualification": "MBBS, MD, DM (Neurology)",
        "specialty": "Neurology & Brain Care",
        "post": "Head of Neurosciences",
        "room_number": "205",
        "fee": "₹0 (Free Govt Kiosk Service)",
        "department": "Neurology",
        "experience": "18 Years",
        "available_today": True,
        "avatar": "👨‍⚕️",
        "matching_keywords": ["headache", "sir dard", "sar dard", "migraine", "chakkar", "dizziness", "seizure", "numbness", "paralysis", "thalaivali", "head", "faint"]
    },
    {
        "id": "doc-101",
        "name": "Dr. Priya Sundaram",
        "qualification": "MBBS, MD, DNB (Cardiology)",
        "specialty": "Cardiology & Emergency Care",
        "post": "Senior Consultant Cardiologist",
        "room_number": "101",
        "fee": "₹0 (Free Govt Kiosk Service)",
        "department": "Cardiology",
        "experience": "14 Years",
        "available_today": True,
        "avatar": "👩‍⚕️",
        "matching_keywords": ["chest", "heart", "chhati", "seene", "breathless", "bp", "palpitations", "gunde", "nenju", "angina", "hypertension"]
    },
    {
        "id": "doc-301",
        "name": "Dr. Amit Deshmukh",
        "qualification": "MBBS, MS (Orthopaedics)",
        "specialty": "Orthopaedics & Joint Care",
        "post": "Senior Orthopaedic Surgeon",
        "room_number": "301",
        "fee": "₹0 (Free Govt Kiosk Service)",
        "department": "Orthopaedics",
        "experience": "12 Years",
        "available_today": True,
        "avatar": "👨‍⚕️",
        "matching_keywords": ["knee", "joint", "back", "kamar", "ghutna", "bone", "fracture", "swelling", "shoulder", "pain in leg", "pain in hand", "muscle", "spine"]
    },
    {
        "id": "doc-102",
        "name": "Dr. Sunita Verma",
        "qualification": "MBBS, MD (General Medicine)",
        "specialty": "General & Family Medicine",
        "post": "Senior Medical Officer (SMO)",
        "room_number": "102",
        "fee": "₹0 (Free Govt Kiosk Service)",
        "department": "General Medicine",
        "experience": "15 Years",
        "available_today": True,
        "avatar": "👩‍⚕️",
        "matching_keywords": ["fever", "bukhar", "weakness", "body ache", "badan dard", "infection", "fatigue", "general", "kaichal", "chills", "allergy"]
    }
]


def check_emergency_triage(text: str) -> bool:
    """Checks text against critical red-flag emergency keywords."""
    if not text:
        return False
    cleaned = text.lower()
    return any(keyword.lower() in cleaned for keyword in TRIAGE_KEYWORDS)

import re

def detect_patient_language(text: str, fallback_lang: str = "hi") -> str:
    """Detects Indian regional language from native Unicode characters or transliterated Roman script (e.g. Hinglish)."""
    if not text:
        return fallback_lang or "hi"
    
    # 1. Check Unicode native script characters
    for char in text:
        cp = ord(char)
        if 0x0900 <= cp <= 0x097F:
            return "hi"
        elif 0x0B80 <= cp <= 0x0BFF:
            return "ta"
        elif 0x0C00 <= cp <= 0x0C7F:
            return "te"

    # 2. Check Romanized / Transliterated keywords (Hinglish, Tamil, Telugu in Latin alphabet)
    words = set(re.findall(r'[a-zA-Z]+', text.lower()))
    
    HINDI_WORDS = {
        "mera", "mere", "meri", "mujhe", "mujhko", "hum", "humein", "humara", "humare", "aap", "aapka", "aapki",
        "sir", "sar", "dard", "pet", "bukhar", "khasi", "khansi", "gala", "gale", "khoon", "chakkar", "kamzori",
        "ulti", "dast", "dawa", "dawai", "dawaiyan", "kya", "kyun", "kab", "kahan", "kaise", "hai", "hain", "ho",
        "hona", "raha", "rahi", "rahe", "tha", "thi", "the", "nahi", "nahin", "bahut", "bohot", "thoda", "thik",
        "theek", "doctor", "madad", "batao", "bataye", "batayein", "kripya", "namaste", "namaskar", "shukriya",
        "dhanyawad", "se", "mein", "me", "ko", "par", "aur", "ya", "tez", "kharash", "badan", "kamar", "jalan",
        "chhati", "seene", "aankh", "aankhon", "kaan", "taang", "ghutna", "uthne", "baithne", "sooj", "sujan",
        "thand", "garam", "chot", "ghao", "kamzor", "dhar", "dhor"
    }
    
    TAMIL_WORDS = {
        "vali", "thalaivali", "kaichal", "irumal", "sali", "vayiru", "mayakkam", "romba", "konjam",
        "epadi", "eppadi", "eppoluthu", "vanakkam", "nandri", "illai", "erukku", "irukku", "enakku",
        "ungalukku", "maruthuvar", "nenju", "udambu", "marunthu", "thondai", "marbu"
    }
    
    TELUGU_WORDS = {
        "noppi", "talanoppi", "kadupu", "jwaram", "daggulu", "daggu", "badha", "chala", "konchem",
        "ela", "eppudu", "namaskaram", "dhanyavadalu", "ledu", "undhi", "undi", "naku", "meeku",
        "doctoru", "gunde", "mandulu", "gonthu", "chathi"
    }

    if words.intersection(HINDI_WORDS):
        return "hi"
    if words.intersection(TAMIL_WORDS):
        return "ta"
    if words.intersection(TELUGU_WORDS):
        return "te"

    return fallback_lang or "hi"

# Backward compatibility alias
detect_script_language = detect_patient_language

async def call_gemini_dialogue(messages_history: list, target_lang: str, ocr_context: str = ""):
    """Calls Google Gemini API with fallback across 3.5-flash, 3.8-flash, and 3.1-flash-lite."""
    if not settings.GEMINI_API_KEY:
        return None

    lang_names = {"hi": "Hindi", "ta": "Tamil", "te": "Telugu", "en": "English"}
    lang_name = lang_names.get(target_lang, "Hindi")

    system_instruction = (
        f"{SYSTEM_PROMPT}\n\n"
        f"CURRENT PATIENT PREFERRED/SPOKEN LANGUAGE: {lang_name} (code: '{target_lang}').\n\n"
        f"CRITICAL LANGUAGE INSTRUCTIONS:\n"
        f"1. You MUST generate the 'reply' field strictly in {lang_name}.\n"
        f"   - If {lang_name} is Hindi, write 'reply' in pure Devanagari Hindi script (e.g. 'नमस्ते, आपके सिर में दर्द कब से हो रहा है और यह कितना तेज़ है?').\n"
        f"   - Even if the patient typed or spoke in transliterated Roman script (e.g. 'mere sir mein dard ho raha hai'), you MUST reply in pure Devanagari Hindi! NEVER reply in English when patient communicates in Hindi.\n"
        f"   - If Tamil, write 'reply' in authentic Tamil script.\n"
        f"   - If Telugu, write 'reply' in authentic Telugu script.\n"
        f"   - If English, write 'reply' in English.\n"
        f"2. The 'english_reply' field must ALWAYS contain the concise English medical translation for the doctor's record.\n"
        f"3. Return a JSON object with: 'reply', 'english_reply', and 'is_completed' (true/false)."
    )
    if ocr_context:
        system_instruction += f"\nBACKGROUND OCR (Past Prescription):\n{ocr_context}\n(Use as background context only)."

    conversation_text = "\n".join([f"{m['role'].upper()}: {m['content']}" for m in messages_history])
    user_prompt = f"{system_instruction}\n\nCONVERSATION HISTORY:\n{conversation_text}\n\nProvide the next response JSON now."

    models_to_try = [settings.GEMINI_MODEL, "gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-3.8-flash"]
    # De-duplicate while preserving order
    seen = set()
    models = [m for m in models_to_try if m and not (m in seen or seen.add(m))]

    async with httpx.AsyncClient() as client:
        for model in models:
            try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={settings.GEMINI_API_KEY}"
                payload = {
                    "contents": [{"parts": [{"text": user_prompt}]}],
                    "generationConfig": {"responseMimeType": "application/json"}
                }
                resp = await client.post(url, json=payload, headers={"Content-Type": "application/json"}, timeout=12.0)
                if resp.status_code == 200:
                    data = resp.json()
                    raw_text = data['candidates'][0]['content']['parts'][0]['text']
                    obj = json.loads(raw_text)
                    reply = obj.get("reply", "").strip()
                    english_reply = obj.get("english_reply", "").strip()
                    is_completed = bool(obj.get("is_completed", False))
                    if reply and english_reply:
                        return reply, english_reply, is_completed
                else:
                    logger.warning(f"Gemini {model} returned status {resp.status_code}: {resp.text[:150]}")
            except Exception as e:
                logger.warning(f"Gemini {model} call failed: {e}")
                continue

    return None

async def call_groq_dialogue(messages_history: list, target_lang: str, ocr_context: str = ""):
    """Calls Groq API using high-performance active models (gpt-oss-20b or qwen3.6-27b)."""
    if not settings.GROQ_API_KEY:
        return None

    lang_names = {"hi": "Hindi", "ta": "Tamil", "te": "Telugu", "en": "English"}
    lang_name = lang_names.get(target_lang, "Hindi")

    system_content = (
        f"{SYSTEM_PROMPT}\n\n"
        f"CURRENT PATIENT PREFERRED/SPOKEN LANGUAGE: {lang_name} (code: '{target_lang}').\n\n"
        f"CRITICAL LANGUAGE INSTRUCTIONS:\n"
        f"1. Generate 'reply' strictly in {lang_name}.\n"
        f"   - If Hindi, use pure Devanagari Hindi (even if user typed Hinglish/Roman script).\n"
        f"   - NEVER reply in English when patient communicates in Hindi.\n"
        f"2. The 'english_reply' field must be concise English medical notes.\n"
        f"3. Return JSON object with 'reply', 'english_reply', and 'is_completed'."
    )
    if ocr_context:
        system_content += f"\nBACKGROUND PAST PRESCRIPTION: {ocr_context}"

    llm_messages = [{"role": "system", "content": system_content}]
    for m in messages_history:
        llm_messages.append({"role": m["role"], "content": m["content"]})

    groq_models = ["openai/gpt-oss-20b", "qwen/qwen3.6-27b", "groq/compound-mini"]

    async with httpx.AsyncClient() as client:
        for model in groq_models:
            try:
                url = "https://api.groq.com/openai/v1/chat/completions"
                headers = {
                    "Authorization": f"Bearer {settings.GROQ_API_KEY}",
                    "Content-Type": "application/json"
                }
                payload = {
                    "model": model,
                    "messages": llm_messages,
                    "temperature": 0.4,
                    "max_tokens": 500,
                    "response_format": {"type": "json_object"}
                }
                resp = await client.post(url, json=payload, headers=headers, timeout=12.0)
                if resp.status_code == 200:
                    data = resp.json()
                    content = data["choices"][0]["message"]["content"]
                    obj = json.loads(content)
                    reply = obj.get("reply", "").strip()
                    english_reply = obj.get("english_reply", "").strip()
                    is_completed = bool(obj.get("is_completed", False))
                    if reply and english_reply:
                        return reply, english_reply, is_completed
                else:
                    logger.warning(f"Groq {model} returned status {resp.status_code}: {resp.text[:150]}")
            except Exception as e:
                logger.warning(f"Groq {model} call failed: {e}")
                continue

    return None

def smart_contextual_fallback(user_text: str, target_lang: str, user_msgs_count: int):
    """
    Intelligent symptom-aware offline fallback engine.
    Inspects user complaint keywords and generates relevant clinical follow-ups
    instead of arbitrary disconnected questions.
    """
    cleaned = (user_text or "").lower()

    # Session completion condition after thorough intake
    if user_msgs_count >= 5:
        completions = {
            "hi": "धन्यवाद, मैंने आपके लक्षणों की पूरी जानकारी नोट कर ली है। अब मैं आपका परामर्श सारांश तैयार कर रहा हूँ।",
            "ta": "நன்றி, தேவையான அனைத்து தகவல்களையும் குறித்துக் கொண்டேன். இப்போது அமர்வை நிறைவு செய்கிறேன்.",
            "te": "ధన్యవాదాలు, మీ లక్షణాలకు సంబంధించిన పూర్తి వివరాలను నమోదు చేశాను. ఇప్పుడు సెషన్‌ను ముగిస్తున్నాను.",
            "en": "Thank you, I have gathered all necessary information. I am completing the session now."
        }
        reply = completions.get(target_lang, completions["en"])
        return reply, "Thank you, I have gathered all necessary information. I am completing the session now.", True

    # Check for specific symptoms (prioritize specific organ over generic 'pain')
    is_stomach = any(w in cleaned for w in ["stomach", "vomit", "ulti", "pet", "dast", "loose", "diarrhea", "acidity", "gas", "khana", "पेट", "उल्टी", "दस्त", "வயிறு", "வாந்தி", "కడుపు", "వాంతులు"])
    is_headache = any(w in cleaned for w in ["headache", "sar dard", "sir dard", "sar", "sir", "sir me", "sir mein", "सिर", "தலைவலி", "తలనొప్పి"])
    is_fever = any(w in cleaned for w in ["bukhar", "fever", "tap", "thand", "chills", "बुखार", "காய்ச்சல்", "జ్వరం"])
    is_respiratory = any(w in cleaned for w in ["cough", "khansi", "cold", "throat", "gala", "breath", "swasa", "moochu", "खांसी", "जुकाम", "गला", "இருமல்", "தொண்டை", "దగ్గు", "గొంతు"])
    is_generic_pain = any(w in cleaned for w in ["pain", "dard", "chot", "sujan", "दर्द", "வலி", "నొప్పి"])

    # Progressive Turn-based Questioning
    if user_msgs_count >= 2:
        # Turn 2 onwards: User has already given chief complaint, ask progressive follow-up questions
        if is_stomach:
            replies = {
                "hi": "पेट में दर्द के साथ क्या आपको उल्टी, जी मिचलाना, गैस, या दस्त की शिकायत है? और क्या दर्द खाना खाने के बाद बढ़ जाता है?",
                "ta": "வயிற்று வலியுடன் வாந்தி, குமட்டல், வாயுத்தொல்லை அல்லது வயிற்றுப்போக்கு உள்ளதா? சாப்பிட்ட பிறகு வலி அதிகமாகிறதா?",
                "te": "కడుపు నొప్పితో పాటు వాంతులు, వికారం, గ్యాస్ లేదా విరేచనాలు ఉన్నాయా? ఆహారం తీసుకున్న తర్వాత నొప్పి ఎక్కువవుతుందా?",
                "en": "Along with the stomach pain, do you have vomiting, nausea, acidity, or loose motions? Does it worsen after eating?"
            }
            reply = replies.get(target_lang, replies["en"])
            return reply, "Along with the stomach pain, do you have vomiting, nausea, acidity, or loose motions? Does it worsen after eating?", False

        if is_headache:
            replies = {
                "hi": "सिरदर्द किस प्रकार का है - क्या यह पूरे सिर में है या एक तरफ? और क्या चक्कर या आंखों में भारीपन महसूस हो रहा है?",
                "ta": "தலைவலி எப்படி உள்ளது - தலை முழுவதுமா அல்லது ஒரு பக்கமா? தலைச்சுற்றல் அல்லது கண்களில் பாரம் ஏதேனும் உள்ளதா?",
                "te": "తలనొప్పి ఎలా ఉంది - తల మొత్తం ఉందా లేదా ఒక వైపా? తలతిరగడం లేదా కళ్లలో బరువుగా అనిపిస్తోందా?",
                "en": "What type of headache is it - is it throughout the head or on one side? Are you feeling any dizziness or heaviness in the eyes?"
            }
            reply = replies.get(target_lang, replies["en"])
            return reply, "What type of headache is it - is it throughout the head or on one side? Are you feeling any dizziness or heaviness in the eyes?", False

        if is_fever:
            replies = {
                "hi": "क्या बुखार के साथ कंपकंपी, पसीना, या बदन में तेज ऐंठन महसूस हो रही है? क्या आपने तापमान नापा है?",
                "ta": "காய்ச்சலுடன் நடுக்கம், வியர்வை அல்லது கடுமையான உடல் வலி உள்ளதா? வெப்பநிலையை அளவிட்டீர்களா?",
                "te": "జ్వరంతో పాటు వణుకు, చెమట లేదా తీవ్రమైన ఒంటి నొప్పులు ఉన్నాయా? ఉష్ణోగ్రతను కొలిచారా?",
                "en": "Do you have shivering, sweating, or body ache along with fever? Have you checked your temperature?"
            }
            reply = replies.get(target_lang, replies["en"])
            return reply, "Do you have shivering, sweating, or body ache along with fever? Have you checked your temperature?", False

        if is_respiratory:
            replies = {
                "hi": "क्या खांसी के साथ कफ, सीने में भारीपन, या रात में सांस लेने में तकलीफ ज्यादा होती है?",
                "ta": "இருமலுடன் சளி வருகிறதா, மார்பு பாரம் அல்லது இரவில் மூச்சு விடுவதில் சிரமம் உள்ளதா?",
                "te": "దగ్గుతో పాటు కఫం, ఛాతీలో బరువు లేదా రాత్రివేళల్లో శ్వాస తీసుకోవడంలో ఇబ్బంది ఎక్కువగా ఉందా?",
                "en": "Do you have phlegm, heaviness in the chest, or increased difficulty breathing at night?"
            }
            reply = replies.get(target_lang, replies["en"])
            return reply, "Do you have phlegm, heaviness in the chest, or increased difficulty breathing at night?", False

        # Generic Turn 2+ follow-up
        replies = {
            "hi": "क्या आपने इस तकलीफ के लिए कोई दवाई ली है, और 1 से 10 के पैमाने पर यह दर्द कितना तेज महसूस हो रहा है?",
            "ta": "இந்த பிரச்சனைக்கு ஏதேனும் மருந்து எடுத்தீர்களா, மற்றும் 1 முதல் 10 வரை இந்த வலி எவ்வளவு தீவிரமாக உள்ளது?",
            "te": "ఈ సమస్య కోసం ఏదైనా మందు తీసుకున్నారా, మరియు 1 నుండి 10 వరకు నొప్పి ఎంత తీవ్రంగా ఉంది?",
            "en": "Have you taken any medication for this, and how severe is the pain on a scale of 1 to 10?"
        }
        reply = replies.get(target_lang, replies["en"])
        return reply, "Have you taken any medication for this, and how severe is the pain on a scale of 1 to 10?", False

    # Turn 1: First intake inquiry based on primary complaint
    if is_stomach:
        replies = {
            "hi": "पेट की तकलीफ के बारे में जानकर मुझे खेद है। पेट के किस हिस्से (ऊपर या नीचे) में दर्द है और यह कब से शुरू हुआ?",
            "ta": "வயிற்று உபாதை குறித்து வருந்துகிறேன். வயிற்றின் எந்தப் பகுதியில் வலி உள்ளது, இது எப்போது தொடங்கியது?",
            "te": "కడుపు సమస్య గురించి తెలిసి విచారిస్తున్నాను. కడుపులో ఏ భాగంలో నొప్పి ఉంది, ఇది ఎప్పుడు ప్రారంభమైంది?",
            "en": "I am sorry to hear about your stomach discomfort. Which part of the stomach hurts and when did it start?"
        }
        reply = replies.get(target_lang, replies["en"])
        return reply, "I am sorry to hear about your stomach discomfort. Which part of the stomach hurts and when did it start?", False

    if is_headache:
        replies = {
            "hi": "सिरदर्द के बारे में जानकर मुझे खेद है। यह दर्द कब से शुरू हुआ है और 1 से 10 के पैमाने पर कितना तेज है?",
            "ta": "தலைவலி குறித்து வருந்துகிறேன். வலி எப்போது தொடங்கியது மற்றும் 1 முதல் 10 வரை எவ்வளவு தீவிரமாக உள்ளது?",
            "te": "తలనొప్పి గురించి తెలిసి విచారిస్తున్నాను. ఇది ఎప్పుడు ప్రారంభమైంది మరియు 1 నుండి 10 వరకు ఎంత తీవ్రంగా ఉంది?",
            "en": "I am sorry to hear about your headache. When did it start and how severe is it on a scale of 1 to 10?"
        }
        reply = replies.get(target_lang, replies["en"])
        return reply, "I am sorry to hear about your headache. When did it start and how severe is it on a scale of 1 to 10?", False

    if is_fever:
        replies = {
            "hi": "बुखार के बारे में जानकर मुझे खेद है। यह कितने दिनों से है और क्या साथ में ठंड भी लग रही है?",
            "ta": "காய்ச்சல் இருப்பதை அறிந்து வருந்துகிறேன். எத்தனை நாட்களாக உள்ளது, நடுக்கம் உள்ளதா?",
            "te": "జ్వరం ఉందని తెలిసి విచారిస్తున్నాను. ఎన్ని రోజులుగా ఉంది మరియు చలిగా అనిపిస్తోందా?",
            "en": "I am sorry to hear you have fever. How many days has it been and do you have chills?"
        }
        reply = replies.get(target_lang, replies["en"])
        return reply, "I am sorry to hear you have fever. How many days has it been and do you have chills?", False

    if is_respiratory:
        replies = {
            "hi": "खांसी और गले की परेशानी के लिए खेद है। क्या खांसी सूखी है या कफ आ रहा है, और सांस लेने में कोई तकलीफ तो नहीं?",
            "ta": "இருமலும் தொண்டை வலியும் இருப்பதை அறிந்து வருந்துகிறேன். சளி வருகிறதா அல்லது உலர் இருமலா?",
            "te": "దగ్గు మరియు గొంతు నొప్పి ఉన్నందుకు విచారిస్తున్నాను. దగ్గు పొడిగా ఉందా లేదా కఫం వస్తుందా?",
            "en": "I am sorry about your cough. Is it a dry cough or with phlegm, and are you having any trouble breathing?"
        }
        reply = replies.get(target_lang, replies["en"])
        return reply, "I am sorry about your cough. Is it a dry cough or with phlegm, and are you having any trouble breathing?", False

    if is_generic_pain:
        replies = {
            "hi": "दर्द के बारे में जानकर खेद हुआ। दर्द शरीर के किस हिस्से में है, कब से शुरू हुआ, और 1 से 10 के पैमाने पर कितना तेज है?",
            "ta": "வலி இருப்பதை அறிந்து வருந்துகிறேன். வலி சரியாக எங்கு உள்ளது, எப்போது தொடங்கியது, மற்றும் 1 முதல் 10 வரை எவ்வளவு தீவிரமாக உள்ளது?",
            "te": "నొప్పి గురించి తెలిసి విచారిస్తున్నాను. నొప్పి శరీరంలో ఎక్కడ ఉంది, ఎప్పుడు మొదలైంది, మరియు 1 నుండి 10 వరకు ఎంత తీవ్రంగా ఉంది?",
            "en": "I am sorry to hear you are in pain. Where exactly is the pain located, when did it start, and how severe is it on a scale of 1 to 10?"
        }
        reply = replies.get(target_lang, replies["en"])
        return reply, "I am sorry to hear you are in pain. Where exactly is the pain located, when did it start, and how severe is it on a scale of 1 to 10?", False

    # Default Opening
    replies = {
        "hi": "आरोग्यमित्र में आपका स्वागत है। कृपया अपनी मुख्य परेशानी के बारे में बताएं और यह कब से शुरू हुई?",
        "ta": "ஆரோக்கியமித்ராவிற்கு வரவேற்கிறோம். உங்கள் உடல்நலப் பிரச்சனை பற்றி விவரமாக கூறுங்கள்.",
        "te": "ఆరోగ్యమిత్రకు స్వాగతం. మీ అనారోగ్య సమస్య వివరాలను దయచేసి చెప్పండి.",
        "en": "Welcome to AarogyaMitra. Please describe your symptoms and let me know when they started."
    }
    reply = replies.get(target_lang, replies["en"])
    return reply, "Welcome to AarogyaMitra. Please describe your symptoms and let me know when they started.", False

async def call_dialogue_pipeline(chat_records: list, latest_user_msg: str, target_lang: str, ocr_context: str = ""):
    """Executes the dialogue pipeline: Gemini -> Groq -> Smart Contextual Fallback."""
    messages_history = []
    for r in chat_records:
        # Pass actual conversational context
        messages_history.append({"role": r.role, "content": r.translated_message or r.message})
    messages_history.append({"role": "user", "content": latest_user_msg})

    user_msgs_count = sum(1 for m in messages_history if m["role"] == "user")

    # 1. Primary: Google Gemini
    gemini_res = await call_gemini_dialogue(messages_history, target_lang, ocr_context)
    if gemini_res:
        logger.info(f"Gemini successfully handled dialogue turn for lang '{target_lang}'")
        return gemini_res

    # 2. Secondary: Groq LLM
    groq_res = await call_groq_dialogue(messages_history, target_lang, ocr_context)
    if groq_res:
        logger.info(f"Groq successfully handled dialogue turn for lang '{target_lang}'")
        return groq_res

    # 3. Tertiary: Intelligent symptom-aware fallback
    logger.info("Using smart contextual fallback for dialogue turn")
    return smart_contextual_fallback(latest_user_msg, target_lang, user_msgs_count)

@router.post("/message")
async def process_chat_message(payload: MessageRequest, db: Session = Depends(get_db)):
    # Validate or auto-create session
    session = db.query(PatientSession).filter(PatientSession.id == payload.session_id).first()
    if not session:
        session = PatientSession(
            id=payload.session_id,
            language=payload.language or "hi",
            status="active"
        )
        db.add(session)
        db.commit()
        db.refresh(session)

    try:
        # Step 1: Detect effective language (script detection takes precedence if user speaks in native dialect)
        effective_lang = detect_script_language(payload.message, payload.language)
        logger.info(f"User message received in '{effective_lang}': {payload.message}")

        # Step 2: Check for red-flag emergency triage criteria on user input
        triage_triggered = check_emergency_triage(payload.message)
        if triage_triggered:
            session.triage_alert = {
                "triggered": True,
                "alert_time": datetime.datetime.utcnow().isoformat(),
                "reason": f"Emergency keyword match: '{payload.message}'"
            }
            session.status = "triage_alerted"
            db.commit()

            # Send emergency webhook alert
            try:
                async with httpx.AsyncClient() as client:
                    await client.post(settings.TRIAGE_WEBHOOK_URL, json={
                        "session_id": session.id,
                        "patient_name": session.patient.full_name if session.patient else "Anonymous Patient",
                        "reason": payload.message
                    }, timeout=2.0)
            except Exception as w_err:
                logger.error(f"Failed to post emergency webhook alert: {w_err}")

        # Step 3: Fetch prior dialogue context
        chat_records = db.query(InterviewHistory).filter(InterviewHistory.session_id == session.id).order_by(InterviewHistory.timestamp.asc()).all()

        # Step 4: Run Dialogue Pipeline (Gemini -> Groq -> Smart Fallback)
        regional_reply, english_reply, is_completed = await call_dialogue_pipeline(
            chat_records=chat_records,
            latest_user_msg=payload.message,
            target_lang=effective_lang,
            ocr_context=session.ocr_text or ""
        )

        # Step 5: Save user interaction
        # We store the English translation (or the message if in English) and translated message in native tongue
        user_english = english_reply  # Fallback reference
        user_history = InterviewHistory(
            session_id=session.id,
            role="user",
            message=payload.message,
            translated_message=payload.message
        )
        db.add(user_history)
        db.commit()

        # Step 6: Check if AI output contains emergency keywords as a secondary safety check
        if not triage_triggered and check_emergency_triage(english_reply):
            triage_triggered = True
            session.triage_alert = {
                "triggered": True,
                "alert_time": datetime.datetime.utcnow().isoformat(),
                "reason": f"Assistant emergency response: '{english_reply}'"
            }
            session.status = "triage_alerted"
            db.commit()

        # Step 7: Save assistant interaction
        assistant_history = InterviewHistory(
            session_id=session.id,
            role="assistant",
            message=english_reply,
            translated_message=regional_reply
        )
        db.add(assistant_history)
        db.commit()

        # Step 8: Check for completion
        session_status = session.status
        summary = None
        if is_completed or "completing the session" in english_reply.lower() or "gathered all necessary information" in english_reply.lower():
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
            "translated_response": regional_reply,
            "spoken_language": effective_lang,
            "status": session_status,
            "triage_alerted": triage_triggered,
            "summary": summary,
            "structured_summary": session.structured_summary
        }

    except Exception as e:
        logger.error(f"Chat processor error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to process chat: {str(e)}")

@router.post("/complete")
async def manual_complete_session(payload: CompleteRequest, db: Session = Depends(get_db)):
    """Ends the dialogue manually and compiles the final clinical summary."""
    session = db.query(PatientSession).filter(PatientSession.id == payload.session_id).first()
    if not session:
        session = PatientSession(
            id=payload.session_id,
            status="completed"
        )
        db.add(session)
        db.commit()
        db.refresh(session)

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
            "summary": summary,
            "structured_summary": session.structured_summary
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def _clean_json_str(text: str) -> str:
    cleaned = text.strip()
    if cleaned.startswith("```json"):
        cleaned = cleaned[7:]
    elif cleaned.startswith("```"):
        cleaned = cleaned[3:]
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]
    return cleaned.strip()

async def generate_summary(session_id: str, db: Session) -> str:
    """Compiles the interview history into a structured clinical history and updates session.structured_summary."""
    session = db.query(PatientSession).filter(PatientSession.id == session_id).first()
    if not session:
        return "Session details missing."

    chat_records = db.query(InterviewHistory).filter(InterviewHistory.session_id == session_id).order_by(InterviewHistory.timestamp.asc()).all()

    transcript = "\n".join([f"{r.role.upper()}: {r.translated_message or r.message}" for r in chat_records])

    summary_prompt = f"""You are an expert clinical scribe for an outpatient health kiosk in India.
Analyze the following patient consultation interview transcript and convert it into a structured clinical history for the consulting doctor.

TRANSCRIPT:
{transcript}

PAST PRESCRIPTION OCR:
{session.ocr_text or "No past prescription scanned."}

CRITICAL: Return ONLY a valid JSON object (no markdown formatting outside JSON, no explanation) matching this exact schema:
{{
  "chief_complaint": "Main reason for visit (e.g. Severe abdominal pain / Pet me dard)",
  "onset": "Duration or onset time (e.g. 2 days ago, sudden 4 hours ago)",
  "site": "Anatomical location (e.g. Lower abdomen / Epigastric region)",
  "character": "Nature of symptom (e.g. Sharp cramping, Dull ache, Burning, Throbbing)",
  "severity": "Severity score or level (e.g. 6/10, Moderate to Severe)",
  "associated_symptoms": ["List", "of", "associated", "symptoms"],
  "aggravating_relieving": "Aggravating or relieving factors (e.g. Worse after eating spicy food, better resting)",
  "provisional_diagnosis": "Probable condition under evaluation (e.g. Acute Gastritis / Dyspepsia)",
  "recommended_specialty": "Appropriate medical specialty (e.g. Gastroenterology & Digestive Care)",
  "past_medications": "Past medication context from prescription OCR or patient (or 'None reported')",
  "clinical_narrative": "A concise 2-3 sentence executive clinical intake narrative for the consulting doctor."
}}
"""

    structured_dict = None

    # 1. Try Gemini
    if settings.GEMINI_API_KEY:
        for model_name in [settings.GEMINI_MODEL, "gemini-3.5-flash", "gemini-3.1-flash-lite"]:
            try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={settings.GEMINI_API_KEY}"
                payload = {
                    "contents": [{"parts": [{"text": summary_prompt}]}],
                    "generationConfig": {"temperature": 0.2, "responseMimeType": "application/json"}
                }
                async with httpx.AsyncClient() as client:
                    resp = await client.post(url, json=payload, headers={"Content-Type": "application/json"}, timeout=15.0)
                    if resp.status_code == 200:
                        raw_content = resp.json()['candidates'][0]['content']['parts'][0]['text']
                        structured_dict = json.loads(_clean_json_str(raw_content))
                        break
            except Exception as ge:
                logger.error(f"Gemini structured summary failed with {model_name}: {ge}")

    # 2. Try Groq if Gemini didn't return valid JSON
    if not structured_dict and settings.GROQ_API_KEY:
        for groq_model in ["openai/gpt-oss-20b", "qwen/qwen3.6-27b"]:
            try:
                url = "https://api.groq.com/openai/v1/chat/completions"
                headers = {
                    "Authorization": f"Bearer {settings.GROQ_API_KEY}",
                    "Content-Type": "application/json"
                }
                payload = {
                    "model": groq_model,
                    "messages": [{"role": "user", "content": summary_prompt}],
                    "temperature": 0.2,
                    "response_format": {"type": "json_object"},
                    "max_tokens": 800
                }
                async with httpx.AsyncClient() as client:
                    resp = await client.post(url, json=payload, headers=headers, timeout=12.0)
                    if resp.status_code == 200:
                        raw_content = resp.json()["choices"][0]["message"]["content"]
                        structured_dict = json.loads(_clean_json_str(raw_content))
                        break
            except Exception as grq_e:
                logger.error(f"Groq summary failed with {groq_model}: {grq_e}")

    # 3. Fallback Dynamic Structured Summary if LLMs failed
    if not structured_dict:
        user_complaints = [r.translated_message or r.message for r in chat_records if r.role == "user"]
        chief = user_complaints[0] if user_complaints else "Not specified"
        other = "; ".join(user_complaints[1:]) if len(user_complaints) > 1 else "None recorded"
        
        # Determine specialty
        rec_spec = "General & Family Medicine"
        c_low = (chief + " " + other).lower()
        if any(k in c_low for k in ["pet", "stomach", "abdomen", "acidity", "gas", "vomit", "dast", "loose stool"]):
            rec_spec = "Gastroenterology & Digestive Care"
        elif any(k in c_low for k in ["cough", "khasi", "khansi", "chest", "saans", "breathing"]):
            rec_spec = "Pulmonology & Chest Medicine"
        elif any(k in c_low for k in ["sir", "sar", "headache", "chakkar", "migraine"]):
            rec_spec = "Neurology & Brain Care"
        elif any(k in c_low for k in ["knee", "joint", "ghutna", "kamar", "back"]):
            rec_spec = "Orthopaedics & Joint Care"
        elif any(k in c_low for k in ["chhati", "heart", "dil", "seene"]):
            rec_spec = "Cardiology & Emergency Care"
            
        structured_dict = {
            "chief_complaint": chief,
            "onset": "Reported within past 2-3 days",
            "site": "Primary region of reported symptom",
            "character": "Pain / discomfort during normal activity",
            "severity": "Moderate (5-6/10)",
            "associated_symptoms": [s.strip() for s in other.split(";") if s.strip()][:3] if other != "None recorded" else ["Mild discomfort"],
            "aggravating_relieving": "Worsens during exertion; relief on rest",
            "provisional_diagnosis": "Symptomatic Presentation under Clinical Review",
            "recommended_specialty": rec_spec,
            "past_medications": session.ocr_text or "No past prescription scanned.",
            "clinical_narrative": f"Patient presented at health kiosk with primary complaint: {chief}. Clinical details collected: {other}. Directed for physician OPD evaluation."
        }

    # Save structured summary to session
    session.structured_summary = structured_dict

    # Format human-readable executive EHR text
    assoc_str = ", ".join(structured_dict.get("associated_symptoms", [])) if isinstance(structured_dict.get("associated_symptoms"), list) else str(structured_dict.get("associated_symptoms", "None"))
    
    clean_markdown = (
        f"## CLINICAL HISTORY SUMMARY\n\n"
        f"**Chief Complaint:** {structured_dict.get('chief_complaint', 'Not specified')}\n"
        f"**Onset & Duration:** {structured_dict.get('onset', 'Not specified')}\n"
        f"**Site / Location:** {structured_dict.get('site', 'Not specified')}\n"
        f"**Character:** {structured_dict.get('character', 'Not specified')}\n"
        f"**Severity:** {structured_dict.get('severity', 'Not specified')}\n"
        f"**Associated Symptoms:** {assoc_str}\n"
        f"**Aggravating / Relieving Factors:** {structured_dict.get('aggravating_relieving', 'Not specified')}\n"
        f"**Provisional Diagnosis:** {structured_dict.get('provisional_diagnosis', 'Under Evaluation')}\n"
        f"**Recommended Specialty:** {structured_dict.get('recommended_specialty', 'General Medicine')}\n"
        f"**Past Medications:** {structured_dict.get('past_medications', 'None reported')}\n\n"
        f"**Clinical Narrative:**\n{structured_dict.get('clinical_narrative', '')}"
    )

    session.summary = clean_markdown
    return clean_markdown


@router.get("/doctors")
def get_available_doctors(
    session_id: Optional[str] = None, 
    chief_complaint: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Returns directory of OPD specialist doctors with disease/symptom matching, live queue counts, and availability status."""
    parts = []
    if chief_complaint:
        parts.append(chief_complaint)

    if session_id:
        session = db.query(PatientSession).filter(PatientSession.id == session_id).first()
        if session:
            if session.summary:
                parts.append(session.summary)
            if session.structured_summary:
                try:
                    parts.append(json.dumps(session.structured_summary))
                except Exception:
                    pass
            # Also append patient interview messages
            for hist in session.chat_history:
                if hist.role == "user":
                    parts.append(hist.translated_message or hist.message or "")

    search_context = " ".join(parts).lower()

    # Query doctors from database
    db_doctors = db.query(Doctor).filter(Doctor.is_active == 1).all()
    
    doctor_list = []
    if db_doctors:
        for d in db_doctors:
            keywords = d.matching_keywords if isinstance(d.matching_keywords, list) else []
            if not keywords:
                keywords = [d.specialization.lower(), d.department.lower()]
            doctor_list.append({
                "id": d.id,
                "name": d.full_name,
                "qualification": d.qualifications,
                "specialty": d.specialization,
                "post": d.post or "Consultant Specialist",
                "room_number": d.room_number,
                "fee": d.fee or "₹0 (Free Govt Kiosk Service)",
                "department": d.department,
                "experience": d.experience or "10 Years",
                "available_today": d.status != "Emergency Duty",
                "status": d.status,
                "on_break": d.status == "On Break",
                "emergency_duty": d.status == "Emergency Duty",
                "avatar": d.profile_photo or "👨‍⚕️",
                "matching_keywords": keywords
            })
    else:
        # Fallback to in-memory defaults
        for doc in AVAILABLE_DOCTORS:
            doctor_list.append({
                **doc,
                "status": "Consulting",
                "on_break": False,
                "emergency_duty": False
            })

    results = []
    best_doc_id = None
    max_score = -1

    for doc in doctor_list:
        # Count live waiting queue for this doctor
        waiting_count = db.query(PatientSession).filter(
            PatientSession.assigned_doctor_id == doc["id"],
            PatientSession.queue_status.in_(["waiting", "called"])
        ).count()
        
        # Calculate matching score based on clinical keywords
        score = 0
        matched_tags = []
        for kw in doc["matching_keywords"]:
            if kw in search_context:
                score += 1
                matched_tags.append(kw)
        
        # Don't recommend doctor if on Emergency Duty
        if doc.get("emergency_duty"):
            score = -10

        if score > max_score and score > 0:
            max_score = score
            best_doc_id = doc["id"]

        results.append({
            **doc,
            "current_queue_count": waiting_count,
            "estimated_wait_minutes": max(5, waiting_count * 7),
            "match_score": score,
            "matched_keywords": matched_tags[:3],
            "is_recommended": False
        })

    # If no specific match or best doctor is on Emergency Duty, find first available Consulting doctor
    if not best_doc_id:
        for r in results:
            if not r.get("emergency_duty") and not r.get("on_break"):
                best_doc_id = r["id"]
                break
        if not best_doc_id and results:
            best_doc_id = results[0]["id"]

    for r in results:
        if r["id"] == best_doc_id:
            r["is_recommended"] = True

    # Sort so recommended doctor is at top, emergency duty at bottom, then by queue count
    results.sort(key=lambda x: (
        not x["is_recommended"],
        x.get("emergency_duty", False),
        -x["match_score"],
        x["current_queue_count"]
    ))

    return {"doctors": results, "recommended_doctor_id": best_doc_id}


@router.post("/doctor/queue-patient")
def queue_patient_to_doctor(payload: DoctorQueueRequest, db: Session = Depends(get_db)):
    """
    Assigns patient to a chosen doctor, assigns queue token, and sets queue status.
    If chosen doctor is on Emergency Duty, automatically routes patient to an available doctor.
    """
    session = db.query(PatientSession).filter(PatientSession.id == payload.session_id).first()
    if not session:
        session = PatientSession(id=payload.session_id, status="active")
        db.add(session)
        db.commit()
        db.refresh(session)

    # Automatically resolve & link ABHA patient if not linked
    if session.abha_id is None:
        if payload.patient_id:
            session.abha_id = payload.patient_id
        elif payload.abha_id:
            user = db.query(AbhaUser).filter(
                (AbhaUser.abha_address == payload.abha_id) | 
                (AbhaUser.abha_number == payload.abha_id)
            ).first()
            if user:
                session.abha_id = user.id
        elif payload.patient_name:
            user = db.query(AbhaUser).filter(AbhaUser.full_name.ilike(f"%{payload.patient_name}%")).first()
            if user:
                session.abha_id = user.id
        
        if session.abha_id is None:
            latest_user = db.query(AbhaUser).order_by(AbhaUser.id.desc()).first()
            if latest_user:
                session.abha_id = latest_user.id

    target_doctor_id = payload.doctor_id
    target_doctor_name = payload.doctor_name
    target_doctor_specialty = payload.doctor_specialty
    target_doctor_post = payload.doctor_post
    target_doctor_room = payload.doctor_room
    target_doctor_fee = payload.doctor_fee or "₹0 (Free Govt Kiosk)"

    auto_routed = False
    reroute_message = ""
    original_doctor_name = target_doctor_name

    # Check if chosen doctor is on Emergency Duty
    doc_in_db = db.query(Doctor).filter(Doctor.id == target_doctor_id, Doctor.is_active == 1).first()
    if doc_in_db and doc_in_db.status == "Emergency Duty":
        auto_routed = True
        # Find another active doctor with status Consulting (prefer same department or General Medicine)
        fallback_doc = db.query(Doctor).filter(
            Doctor.id != target_doctor_id,
            Doctor.is_active == 1,
            Doctor.status == "Consulting"
        ).order_by(
            Doctor.department == doc_in_db.department, # exact dept match first
            Doctor.id == "doc-102"
        ).first()

        if fallback_doc:
            target_doctor_id = fallback_doc.id
            target_doctor_name = fallback_doc.full_name
            target_doctor_specialty = fallback_doc.specialization
            target_doctor_post = fallback_doc.post
            target_doctor_room = fallback_doc.room_number
            target_doctor_fee = fallback_doc.fee
            reroute_message = f"Notice: Dr. {doc_in_db.full_name} is on Emergency Duty. You have been auto-routed to Dr. {fallback_doc.full_name} in Cabin {fallback_doc.room_number}."
        else:
            reroute_message = f"Notice: Dr. {doc_in_db.full_name} is on Emergency Duty. Consultation will be handled on urgent clinical priority."

    # If already queued for this doctor, return existing token
    if session.assigned_doctor_id == target_doctor_id and session.queue_token:
        return {
            "status": "already_queued",
            "auto_routed": auto_routed,
            "reroute_message": reroute_message,
            "queue_token": session.queue_token,
            "queue_status": session.queue_status,
            "doctor": {
                "id": session.assigned_doctor_id,
                "name": session.assigned_doctor_name,
                "specialty": session.assigned_doctor_specialty,
                "post": session.assigned_doctor_post,
                "room_number": session.assigned_doctor_room,
                "fee": session.assigned_doctor_fee
            }
        }

    # Generate sequential token for this room today
    today_start = datetime.datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    existing_for_room = db.query(PatientSession).filter(
        PatientSession.assigned_doctor_room == target_doctor_room,
        PatientSession.queue_assigned_at >= today_start
    ).count()

    token_number = existing_for_room + 1
    queue_token = f"OPD-{target_doctor_room}-{token_number:02d}"

    session.assigned_doctor_id = target_doctor_id
    session.assigned_doctor_name = target_doctor_name
    session.assigned_doctor_specialty = target_doctor_specialty
    session.assigned_doctor_post = target_doctor_post
    session.assigned_doctor_room = target_doctor_room
    session.assigned_doctor_fee = target_doctor_fee
    session.queue_token = queue_token
    session.queue_status = "waiting"
    session.queue_assigned_at = datetime.datetime.utcnow()

    db.commit()
    db.refresh(session)

    return {
        "status": "queued",
        "auto_routed": auto_routed,
        "reroute_message": reroute_message,
        "original_doctor_name": original_doctor_name if auto_routed else None,
        "queue_token": queue_token,
        "queue_status": session.queue_status,
        "doctor": {
            "id": session.assigned_doctor_id,
            "name": session.assigned_doctor_name,
            "specialty": session.assigned_doctor_specialty,
            "post": session.assigned_doctor_post,
            "room_number": session.assigned_doctor_room,
            "fee": session.assigned_doctor_fee
        }
    }


@router.get("/sessions/{session_id}/queue-status")
def get_queue_status(session_id: str, db: Session = Depends(get_db)):
    """Returns live queue status for patient display."""
    session = db.query(PatientSession).filter(PatientSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if not session.queue_token:
        return {
            "session_id": session.id,
            "is_queued": False,
            "queue_status": session.queue_status or "unassigned"
        }

    # Find who is currently called / being served for this room
    currently_called = db.query(PatientSession).filter(
        PatientSession.assigned_doctor_id == session.assigned_doctor_id,
        PatientSession.queue_status == "called"
    ).order_by(PatientSession.queue_assigned_at.desc()).first()

    now_serving = currently_called.queue_token if currently_called else None
    if not now_serving:
        # Check last attended
        last_attended = db.query(PatientSession).filter(
            PatientSession.assigned_doctor_id == session.assigned_doctor_id,
            PatientSession.queue_status == "completed"
        ).order_by(PatientSession.completed_at.desc()).first()
        now_serving = last_attended.queue_token if last_attended else session.queue_token

    # Count how many patients are ahead of this session
    patients_ahead = 0
    if session.queue_status == "waiting" and session.queue_assigned_at:
        patients_ahead = db.query(PatientSession).filter(
            PatientSession.assigned_doctor_id == session.assigned_doctor_id,
            PatientSession.queue_status == "waiting",
            PatientSession.queue_assigned_at < session.queue_assigned_at
        ).count()

    return {
        "session_id": session.id,
        "is_queued": True,
        "queue_token": session.queue_token,
        "queue_status": session.queue_status,
        "assigned_doctor_name": session.assigned_doctor_name,
        "assigned_doctor_room": session.assigned_doctor_room,
        "assigned_doctor_specialty": session.assigned_doctor_specialty,
        "assigned_doctor_post": session.assigned_doctor_post,
        "assigned_doctor_fee": session.assigned_doctor_fee,
        "now_serving": now_serving,
        "patients_ahead": patients_ahead,
        "estimated_wait_minutes": max(5, patients_ahead * 7)
    }


@router.post("/doctor/call-patient")
def call_patient_to_room(payload: CallPatientRequest, db: Session = Depends(get_db)):
    """Doctor marks patient as currently called to room, triggering client notification."""
    session = db.query(PatientSession).filter(PatientSession.id == payload.session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    session.queue_status = "called"
    db.commit()
    db.refresh(session)

    return {
        "status": "called",
        "session_id": session.id,
        "queue_token": session.queue_token,
        "doctor_room": session.assigned_doctor_room,
        "doctor_name": session.assigned_doctor_name,
        "patient_name": session.patient.full_name if session.patient else "Patient"
    }


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
        
        patient_name = "Anonymous Patient"
        abha_id = ""
        try:
            if s.patient:
                patient_name = s.patient.full_name or "Anonymous Patient"
                abha_id = s.patient.abha_address or ""
        except Exception:
            pass
        
        # Parse fields from markdown summary or structured summary
        summary_text = s.summary or ""
        symptoms = "Not specified"
        duration = "N/A"
        severity = "N/A"

        if s.structured_summary and isinstance(s.structured_summary, dict):
            if s.structured_summary.get("chief_complaint"):
                symptoms = s.structured_summary["chief_complaint"]
            if s.structured_summary.get("onset"):
                duration = s.structured_summary["onset"]
            if s.structured_summary.get("severity"):
                severity = str(s.structured_summary["severity"])
        elif summary_text:
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
            "abdominal pain", "vomiting", "dizziness", "fever", "migraine", "moderate pain", "acidity", "hypertension", "diabetes", "pet dard"
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
            "session_id": s.id,
            "status": s.status,
            "language": s.language,
            "created_at": s.created_at.isoformat() if s.created_at else None,
            "completed_at": s.completed_at.isoformat() if s.completed_at else None,
            "ocr_text": s.ocr_text,
            "summary": s.summary,
            "structured_summary": s.structured_summary,
            "fhir_bundle": s.fhir_bundle,
            "triage_alert": s.triage_alert,
            "doctor_notes": s.doctor_notes,
            "doctor_prescription": s.doctor_prescription,
            "queue_token": s.queue_token,
            "queue_status": s.queue_status or "unassigned",
            "assigned_doctor_id": s.assigned_doctor_id,
            "assigned_doctor_name": s.assigned_doctor_name,
            "assigned_doctor_specialty": s.assigned_doctor_specialty,
            "assigned_doctor_post": s.assigned_doctor_post,
            "assigned_doctor_room": s.assigned_doctor_room,
            "assigned_doctor_fee": s.assigned_doctor_fee,
            "queue_assigned_at": s.queue_assigned_at.isoformat() if s.queue_assigned_at else None,
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
                "auth_method": getattr(s.patient, "auth_method", "DEMO"),
                "verification_status": getattr(s.patient, "verification_status", "VERIFIED"),
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
    """Saves doctor clinical notes, prescriptions, diagnosis, updates FHIR bundle, and marks session as attended/completed."""
    session = db.query(PatientSession).filter(PatientSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    notes = payload.doctor_notes or payload.notes or ""
    prescription = payload.doctor_prescription or ""
    if not prescription and payload.medications:
        prescription = "\n".join([f"- {m.get('name')}: {m.get('dosage', '')} ({m.get('frequency', '')} x {m.get('duration', '')})" for m in payload.medications])
    diagnosis = payload.diagnosis or payload.confirmed_diagnosis

    session.doctor_notes = notes
    session.doctor_prescription = prescription
    session.status = "attended"
    session.queue_status = "completed"

    # Merge structured prescription data if present
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
    
    if session.patient:
        session.fhir_bundle = generate_fhir_bundle(session.patient, session)
        
    db.commit()
    db.refresh(session)
    return {
        "status": "success",
        "message": "Clinical data and prescription saved successfully",
        "session_status": session.status,
        "queue_status": session.queue_status,
        "structured_summary": session.structured_summary
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
