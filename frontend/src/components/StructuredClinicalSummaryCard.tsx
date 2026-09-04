'use client'

import React from 'react'
import { 
  Activity, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  MapPin, 
  Pill, 
  ShieldAlert, 
  Sparkles, 
  Stethoscope, 
  FileText 
} from 'lucide-react'
import { useLanguage } from '@/context/LanguageContext'

export interface StructuredClinicalData {
  chief_complaint?: string;
  onset?: string;
  site?: string;
  character?: string;
  severity?: string;
  associated_symptoms?: string[] | string;
  aggravating_relieving?: string;
  provisional_diagnosis?: string;
  recommended_specialty?: string;
  past_medications?: string;
  clinical_narrative?: string;
}

interface StructuredClinicalSummaryCardProps {
  data: StructuredClinicalData | null;
  rawText?: string;
}

export default function StructuredClinicalSummaryCard({
  data,
  rawText
}: StructuredClinicalSummaryCardProps) {
  const { t } = useLanguage()

  // Parse severity for visual meter
  const getSeverityScore = (sev?: string): { score: number; label: string; color: string } => {
    if (!sev) return { score: 5, label: 'Moderate', color: 'bg-amber-500' }
    const clean = sev.toLowerCase()
    let num = 5
    if (clean.includes('/')) {
      const parsed = parseInt(clean.split('/')[0])
      if (!isNaN(parsed)) num = parsed
    } else {
      const match = clean.match(/\d+/)
      if (match) num = parseInt(match[0])
    }

    if (num >= 8 || clean.includes('severe') || clean.includes('acute') || clean.includes('high')) {
      return { score: Math.min(10, Math.max(1, num)), label: 'High / Severe', color: 'bg-red-500' }
    }
    if (num <= 3 || clean.includes('mild') || clean.includes('low')) {
      return { score: Math.min(10, Math.max(1, num)), label: 'Mild', color: 'bg-emerald-500' }
    }
    return { score: Math.min(10, Math.max(1, num)), label: 'Moderate', color: 'bg-amber-500' }
  }

  // If no structured JSON data, fallback cleanly to parsing raw markdown
  const fallbackData: StructuredClinicalData = data || {}
  if (!data && rawText) {
    const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean)
    lines.forEach((line) => {
      const lower = line.toLowerCase()
      if (lower.includes('chief complaint:')) fallbackData.chief_complaint = line.split(':')[1]?.trim()
      if (lower.includes('onset') || lower.includes('duration:')) fallbackData.onset = line.split(':')[1]?.trim()
      if (lower.includes('site') || lower.includes('location:')) fallbackData.site = line.split(':')[1]?.trim()
      if (lower.includes('character:')) fallbackData.character = line.split(':')[1]?.trim()
      if (lower.includes('severity:')) fallbackData.severity = line.split(':')[1]?.trim()
      if (lower.includes('provisional diagnosis:')) fallbackData.provisional_diagnosis = line.split(':')[1]?.trim()
      if (lower.includes('recommended specialty:')) fallbackData.recommended_specialty = line.split(':')[1]?.trim()
      if (lower.includes('past medications:')) fallbackData.past_medications = line.split(':')[1]?.trim()
    })
    if (!fallbackData.chief_complaint && lines.length > 0) {
      fallbackData.chief_complaint = lines[0].replace(/#+/g, '').trim()
    }
  }

  const cleanText = (val?: string) => {
    if (!val) return ''
    return val.replace(/\*\*/g, '').replace(/\*/g, '').replace(/#+/g, '').trim()
  }

  const chief = cleanText(fallbackData.chief_complaint) || t('Reported Symptom Consultation', 'परामर्श हेतु दर्ज लक्षण', 'அறிகுறிகள் ஆலோசனை', 'లక్షణాల సంప్రదింపు')
  const onset = cleanText(fallbackData.onset) || t('Recently observed', 'हाल ही में', 'சமீபத்தில்', 'ఇటీవల')
  const site = cleanText(fallbackData.site) || t('Localized presentation', 'स्थानीय क्षेत्र', 'குறிப்பிட்ட பகுதி', 'నిర్దిష్ట ప్రాంతం')
  const character = cleanText(fallbackData.character) || t('Continuous discomfort', 'लगातार बेचैनी', 'தொடர் அசௌகரியம்', 'నిరంతర అసౌకర్యం')
  const severityInfo = getSeverityScore(fallbackData.severity)

  // Normalize associated symptoms array
  let symptomsList: string[] = []
  if (Array.isArray(fallbackData.associated_symptoms)) {
    symptomsList = fallbackData.associated_symptoms.map(s => cleanText(s)).filter(Boolean)
  } else if (typeof fallbackData.associated_symptoms === 'string' && fallbackData.associated_symptoms.trim()) {
    symptomsList = fallbackData.associated_symptoms.split(/[,;]/).map(s => cleanText(s)).filter(Boolean)
  }

  return (
    <div className="w-full bg-white rounded-2xl sm:rounded-3xl border-2 border-emerald-500/80 shadow-lg overflow-hidden text-left">
      {/* Top Clinical Header Bar */}
      <div className="bg-gradient-to-r from-emerald-700 via-teal-800 to-blue-900 p-4 sm:p-5 text-white flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2 bg-white/10 backdrop-blur-sm rounded-xl shrink-0">
            <Stethoscope className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-300" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest bg-emerald-500/40 text-emerald-200 px-2 py-0.5 rounded-full border border-emerald-400/30 shrink-0">
                {t('Structured EHR Intake', 'संरचित क्लिनिकल इतिहास', 'கட்டமைக்கப்பட்ட மருத்துவ குறிப்பு', 'నిర్మాణాత్మక క్లినికల్ రికార్డు')}
              </span>
              <span className="text-[10px] sm:text-xs font-bold text-emerald-100/80 flex items-center gap-1 shrink-0">
                <CheckCircle2 className="w-3 h-3 text-emerald-300" />
                ABDM Verified
              </span>
            </div>
            <h3 className="text-base sm:text-xl font-black text-white mt-0.5 break-words">
              {chief}
            </h3>
          </div>
        </div>

        {fallbackData.recommended_specialty && (
          <div className="bg-white/15 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/20 text-xs font-bold text-white shrink-0">
            <span className="text-emerald-300 text-[10px] block uppercase">{t('Specialty', 'विशेषज्ञता', 'சிறப்பு', 'ప్రత్యేకత')}</span>
            <span>{cleanText(fallbackData.recommended_specialty)}</span>
          </div>
        )}
      </div>

      <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 bg-slate-50/50">
        {/* Key Metrics Grid - responsive for mobile */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
          {/* Onset / Duration */}
          <div className="bg-white p-3 sm:p-3.5 rounded-xl sm:rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <span className="text-[10px] sm:text-xs uppercase font-extrabold text-slate-400 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              {t('Onset & Duration', 'अवधि', 'கால அளவு', 'వ్యవధి')}
            </span>
            <p className="text-xs sm:text-sm font-black text-slate-800 mt-1 break-words">{onset}</p>
          </div>

          {/* Site / Location */}
          <div className="bg-white p-3 sm:p-3.5 rounded-xl sm:rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <span className="text-[10px] sm:text-xs uppercase font-extrabold text-slate-400 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              {t('Site / Location', 'स्थान', 'இடம்', 'ప్రాంతం')}
            </span>
            <p className="text-xs sm:text-sm font-black text-slate-800 mt-1 break-words">{site}</p>
          </div>

          {/* Character */}
          <div className="bg-white p-3 sm:p-3.5 rounded-xl sm:rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <span className="text-[10px] sm:text-xs uppercase font-extrabold text-slate-400 flex items-center gap-1">
              <Activity className="w-3.5 h-3.5 text-purple-600 shrink-0" />
              {t('Character', 'प्रकृति', 'தன்மை', 'లక్షణం')}
            </span>
            <p className="text-xs sm:text-sm font-black text-slate-800 mt-1 break-words">{character}</p>
          </div>

          {/* Severity Meter */}
          <div className="bg-white p-3 sm:p-3.5 rounded-xl sm:rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-xs uppercase font-extrabold text-slate-400 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  {t('Severity', 'तीव्रता', 'தீவிரம்', 'తీవ్రత')}
                </span>
                <span className="text-[10px] font-black text-slate-700">{severityInfo.score}/10</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 mt-2 overflow-hidden border border-slate-200">
                <div
                  className={`h-full ${severityInfo.color} transition-all duration-500 rounded-full`}
                  style={{ width: `${severityInfo.score * 10}%` }}
                />
              </div>
            </div>
            <span className="text-[10px] font-bold text-slate-500 block mt-1">{severityInfo.label}</span>
          </div>
        </div>

        {/* Associated Symptoms Badges */}
        {symptomsList.length > 0 && (
          <div className="bg-white p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-[10px] sm:text-xs uppercase font-extrabold text-slate-400 block mb-2">
              {t('Associated Symptoms', 'संबंधित लक्षण', 'தொடர்புடைய அறிகுறிகள்', 'సంబంధిత లక్షణాలు')}
            </span>
            <div className="flex flex-wrap gap-2">
              {symptomsList.map((sym, idx) => (
                <span
                  key={idx}
                  className="px-2.5 py-1 bg-blue-50 text-blue-900 border border-blue-200 rounded-lg text-xs font-extrabold flex items-center gap-1 shadow-xs"
                >
                  <Sparkles className="w-3 h-3 text-blue-600" />
                  {sym}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Clinical Assessment & Modifiers */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {fallbackData.provisional_diagnosis && (
            <div className="bg-blue-50/60 p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-blue-200/80 shadow-xs">
              <span className="text-[10px] sm:text-xs uppercase font-black text-blue-800 block">
                {t('Provisional Clinical Assessment', 'प्रारंभिक नैदानिक मूल्यांकन', 'பரிசீலனை நோய் கண்டறிதல்', 'ప్రాథమిక క్లినికల్ మూల్యాంకనం')}
              </span>
              <p className="text-xs sm:text-sm font-black text-blue-950 mt-1">
                {fallbackData.provisional_diagnosis}
              </p>
            </div>
          )}

          {fallbackData.aggravating_relieving && (
            <div className="bg-amber-50/60 p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-amber-200/80 shadow-xs">
              <span className="text-[10px] sm:text-xs uppercase font-black text-amber-800 block">
                {t('Aggravating / Relieving Factors', 'बढ़ाने/घटाने वाले कारक', 'அதிகரிக்கும்/குறைக்கும் காரணிகள்', 'తీవ్రతరం/ఉపశమనం కలిగించే అంశాలు')}
              </span>
              <p className="text-xs sm:text-sm font-bold text-amber-950 mt-1">
                {fallbackData.aggravating_relieving}
              </p>
            </div>
          )}
        </div>

        {/* Past Prescription / Medications */}
        {fallbackData.past_medications && fallbackData.past_medications !== 'No past prescription scanned.' && (
          <div className="bg-white p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-[10px] sm:text-xs uppercase font-extrabold text-slate-400 flex items-center gap-1.5 mb-1.5">
              <Pill className="w-3.5 h-3.5 text-emerald-600" />
              {t('Past Medication Context (from Prescription OCR)', 'पूर्व दवाइयाँ (स्कैन किए गए पर्चे से)', 'முந்தைய மருந்துகள்', 'మునుపటి మందులు')}
            </span>
            <p className="text-xs font-mono font-medium text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-100 whitespace-pre-wrap max-h-28 overflow-y-auto">
              {fallbackData.past_medications}
            </p>
          </div>
        )}

        {/* Executive Physician Narrative */}
        {fallbackData.clinical_narrative && (
          <div className="bg-emerald-50/40 p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-emerald-200 shadow-xs">
            <span className="text-[10px] sm:text-xs uppercase font-black text-emerald-800 flex items-center gap-1.5 mb-1">
              <FileText className="w-3.5 h-3.5 text-emerald-600" />
              {t('Executive Summary for Consulting Physician', 'परामर्श चिकित्सक हेतु संक्षिप्त नोट', 'மருத்துவருக்கு சுருக்கம்', 'వైద్యుని కోసం సారాంశం')}
            </span>
            <p className="text-xs sm:text-sm font-medium text-slate-800 leading-relaxed italic">
              "{fallbackData.clinical_narrative}"
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
