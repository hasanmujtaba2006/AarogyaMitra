# AarogyaMitra (आरोग्यमित्र)

**Multilingual AI-Powered Healthcare Kiosk & Telemedicine Platform**

AarogyaMitra is a comprehensive healthcare kiosk system designed to bridge the healthcare divide in rural and semi-urban India. It offers multilingual conversational AI triage, ABDM (Ayushman Bharat Digital Mission) integration, prescription OCR, FHIR health records generation, and a real-time doctor telemedicine dashboard.

---

## 🌟 Key Features

- 🗣️ **Multilingual AI Symptom Checker & Voice Triage**: Supports Indian regional languages with Bhashini integration and AI LLMs.
- 🆔 **ABDM Integration**: Seamless ABHA ID verification, linking, and digital health records creation.
- 📄 **Prescription & Lab OCR**: Upload and extract structured clinical data from doctor prescriptions.
- 📋 **FHIR R4 Standardized Output**: Interoperable medical record generation adhering to national standards.
- 🩺 **Doctor Teleconsultation Portal**: Live queue management, clinical notes, and e-prescription generation.
- 🏥 **Emergency / Red-Flag Detection**: Automatic vitals check and urgent care escalation.

---

## 🏗️ Tech Stack

- **Frontend**: Next.js 14, React 18, Tailwind CSS, Lucide Icons, TypeScript
- **Backend**: FastAPI (Python), SQLAlchemy, PostgreSQL / SQLite, Pydantic
- **AI / LLMs**: Groq / OpenAI LLM APIs, Bhashini AI models for speech and translation
- **Deployment**: Vercel ready (Frontend & Backend serverless configuration)

---

## 🚀 Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+ and npm
- Git

### 1. Backend Setup

`ash
cd backend
python -m venv .venv
# On Windows:
.venv\Scripts\activate
# On Linux/macOS:
source .venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
# Fill in your API keys in .env
uvicorn main:app --reload --port 8000
`

### 2. Frontend Setup

`ash
cd frontend
npm install
npm run dev
`

The application will be accessible at \http://localhost:3000\ with the backend API running at \http://localhost:8000\.
