'use client'

import React, { useState, useEffect, useRef } from 'react'
import { 
  Users, 
  Stethoscope, 
  Sparkles, 
  Clock, 
  MapPin, 
  CheckCircle2, 
  ChevronRight, 
  Bell, 
  FolderHeart, 
  RefreshCw, 
  AlertCircle,
  Volume2,
  Building2,
  CreditCard
} from 'lucide-react'
import { useLanguage } from '@/context/LanguageContext'
import { StructuredClinicalData } from './StructuredClinicalSummaryCard'

export interface DoctorItem {
  id: string;
  name: string;
  qualification: string;
  specialty: string;
  post: string;
  room_number: string;
  fee: string;
  department: string;
  experience: string;
  avatar: string;
  current_queue_count: number;
  estimated_wait_minutes: number;
  match_score?: number;
  matched_keywords?: string[];
  is_recommended: boolean;
  available_today?: boolean;
}

export interface QueueState {
  is_queued: boolean;
  queue_token: string;
  queue_status: string; // 'waiting' | 'called' | 'completed' | 'unassigned'
  assigned_doctor_name: string;
  assigned_doctor_room: string;
  assigned_doctor_specialty: string;
  assigned_doctor_post: string;
  assigned_doctor_fee: string;
  now_serving?: string;
  patients_ahead: number;
  estimated_wait_minutes: number;
}

interface DoctorSelectionAndQueueProps {
  sessionId: string;
  patientName?: string;
  abhaId?: string;
  structuredSummary: StructuredClinicalData | null;
  rawSummary: string;
  onViewMedicalRecords: () => void;
}

const DEFAULT_DOCTORS_CATALOG: DoctorItem[] = [
  {
    id: 'doc-104',
    name: 'Dr. Rajesh Sharma',
    qualification: 'MBBS, MD, DM (Gastroenterology)',
    specialty: 'Gastroenterology & Digestive Care',
    post: 'Chief Gastroenterologist',
    room_number: '104',
    fee: '₹0 (Free Govt Kiosk Service)',
    department: 'Gastroenterology',
    experience: '16 Years',
    available_today: true,
    avatar: '👨‍⚕️',
    current_queue_count: 1,
    estimated_wait_minutes: 7,
    is_recommended: false
  },
  {
    id: 'doc-108',
    name: 'Dr. Vikram Patel',
    qualification: 'MBBS, MD (Pulmonary Medicine)',
    specialty: 'Pulmonology & Chest Medicine',
    post: 'Senior Consultant Pulmonologist',
    room_number: '108',
    fee: '₹0 (Free Govt Kiosk Service)',
    department: 'Pulmonology',
    experience: '11 Years',
    available_today: true,
    avatar: '👨‍⚕️',
    current_queue_count: 2,
    estimated_wait_minutes: 14,
    is_recommended: false
  },
  {
    id: 'doc-205',
    name: 'Dr. Arvind Menon',
    qualification: 'MBBS, MD, DM (Neurology)',
    specialty: 'Neurology & Brain Care',
    post: 'Head of Neurosciences',
    room_number: '205',
    fee: '₹0 (Free Govt Kiosk Service)',
    department: 'Neurology',
    experience: '18 Years',
    available_today: true,
    avatar: '👨‍⚕️',
    current_queue_count: 1,
    estimated_wait_minutes: 8,
    is_recommended: false
  },
  {
    id: 'doc-101',
    name: 'Dr. Priya Sundaram',
    qualification: 'MBBS, MD, DNB (Cardiology)',
    specialty: 'Cardiology & Emergency Care',
    post: 'Senior Consultant Cardiologist',
    room_number: '101',
    fee: '₹0 (Free Govt Kiosk Service)',
    department: 'Cardiology',
    experience: '14 Years',
    available_today: true,
    avatar: '👩‍⚕️',
    current_queue_count: 3,
    estimated_wait_minutes: 20,
    is_recommended: false
  },
  {
    id: 'doc-301',
    name: 'Dr. Amit Deshmukh',
    qualification: 'MBBS, MS (Orthopaedics)',
    specialty: 'Orthopaedics & Joint Care',
    post: 'Senior Orthopaedic Surgeon',
    room_number: '301',
    fee: '₹0 (Free Govt Kiosk Service)',
    department: 'Orthopaedics',
    experience: '12 Years',
    available_today: true,
    avatar: '👨‍⚕️',
    current_queue_count: 2,
    estimated_wait_minutes: 15,
    is_recommended: false
  },
  {
    id: 'doc-102',
    name: 'Dr. Sunita Verma',
    qualification: 'MBBS, MD (General Medicine)',
    specialty: 'General & Family Medicine',
    post: 'Senior Medical Officer (SMO)',
    room_number: '102',
    fee: '₹0 (Free Govt Kiosk Service)',
    department: 'General Medicine',
    experience: '15 Years',
    available_today: true,
    avatar: '👩‍⚕️',
    current_queue_count: 1,
    estimated_wait_minutes: 5,
    is_recommended: true
  }
]

export default function DoctorSelectionAndQueue({
  sessionId,
  patientName = 'Patient',
  abhaId = '',
  structuredSummary,
  rawSummary,
  onViewMedicalRecords
}: DoctorSelectionAndQueueProps) {
  const { t } = useLanguage()

  const [doctors, setDoctors] = useState<DoctorItem[]>(DEFAULT_DOCTORS_CATALOG)
  const [loadingDoctors, setLoadingDoctors] = useState(false)
  const [selectedDoctorId, setSelectedDoctorId] = useState<string | null>('doc-102')
  const [joiningQueue, setJoiningQueue] = useState(false)
  const [queueState, setQueueState] = useState<QueueState | null>(null)
  const [isAlertPlaying, setIsAlertPlaying] = useState(false)
  const [hasNotifiedCall, setHasNotifiedCall] = useState(false)
  const audioContextRef = useRef<any>(null)

  // Determine initial recommended doctor from symptoms immediately on client
  useEffect(() => {
    const text = ((structuredSummary?.chief_complaint || '') + ' ' + (rawSummary || '')).toLowerCase()
    let recId = 'doc-102'
    if (text.includes('stomach') || text.includes('pet') || text.includes('abdomen') || text.includes('vomit') || text.includes('acid') || text.includes('dast')) {
      recId = 'doc-104'
    } else if (text.includes('cough') || text.includes('khasi') || text.includes('breath') || text.includes('saans') || text.includes('asthma') || text.includes('chest congestion')) {
      recId = 'doc-108'
    } else if (text.includes('head') || text.includes('sir') || text.includes('migraine') || text.includes('chakkar') || text.includes('dizz')) {
      recId = 'doc-205'
    } else if (text.includes('chest') || text.includes('heart') || text.includes('bp') || text.includes('dil') || text.includes('palpitation')) {
      recId = 'doc-101'
    } else if (text.includes('knee') || text.includes('bone') || text.includes('joint') || text.includes('kamar') || text.includes('back') || text.includes('ghutna')) {
      recId = 'doc-301'
    }
    setSelectedDoctorId(recId)
    setDoctors(prev => prev.map(d => ({ ...d, is_recommended: d.id === recId })))
  }, [structuredSummary, rawSummary])

  // Play audio chime when patient is called by doctor
  const playCallChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
      if (!AudioCtx) return
      const ctx = new AudioCtx()
      
      const now = ctx.currentTime
      // Harmonious hospital announcement chime (Chime: E5 -> G#5 -> B5)
      const notes = [659.25, 830.61, 987.77]
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(freq, now + idx * 0.22)
        
        gain.gain.setValueAtTime(0, now + idx * 0.22)
        gain.gain.linearRampToValueAtTime(0.35, now + idx * 0.22 + 0.04)
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.22 + 0.6)
        
        osc.connect(gain)
        gain.connect(ctx.destination)
        
        osc.start(now + idx * 0.22)
        osc.stop(now + idx * 0.22 + 0.65)
      })
      setIsAlertPlaying(true)
      setTimeout(() => setIsAlertPlaying(false), 3000)
    } catch (e) {
      console.warn('Audio chime playback error:', e)
    }
  }

  // Fetch available doctors matching disease from backend API
  const fetchDoctors = async () => {
    try {
      const queryParams = new URLSearchParams()
      if (sessionId) queryParams.append('session_id', sessionId)
      if (structuredSummary?.chief_complaint) {
        queryParams.append('chief_complaint', structuredSummary.chief_complaint)
      } else if (rawSummary) {
        queryParams.append('chief_complaint', rawSummary)
      }

      const res = await fetch(`/api/chat/doctors?${queryParams.toString()}`)
      if (res.ok) {
        const data = await res.json()
        if (data.doctors && data.doctors.length > 0) {
          setDoctors(data.doctors)
          if (data.recommended_doctor_id) {
            setSelectedDoctorId(data.recommended_doctor_id)
          }
        }
      }
    } catch (err) {
      console.error('Failed to load doctors:', err)
    }
  }

  // Poll queue status every 3 seconds if patient is queued
  const fetchQueueStatus = async () => {
    if (!sessionId) return
    try {
      const res = await fetch(`/api/chat/sessions/${encodeURIComponent(sessionId)}/queue-status`)
      if (res.ok) {
        const data = await res.json()
        if (data.is_queued) {
          setQueueState(data)

          // Check if doctor called the patient
          if (data.queue_status === 'called' && !hasNotifiedCall) {
            setHasNotifiedCall(true)
            playCallChime()
          }
        }
      }
    } catch (err) {
      console.warn('Queue polling error:', err)
    }
  }

  useEffect(() => {
    fetchDoctors()
    fetchQueueStatus()
  }, [sessionId])

  useEffect(() => {
    if (!queueState?.is_queued) return
    const timer = setInterval(() => {
      fetchQueueStatus()
    }, 3000)
    return () => clearInterval(timer)
  }, [queueState?.is_queued, hasNotifiedCall])

  // Save consultation intake & doctor selection to localStorage Medical Records
  const saveToMedicalRecord = (doc: DoctorItem, token: string) => {
    try {
      const existingStr = localStorage.getItem('aarogya_medical_records')
      let records: any[] = []
      if (existingStr) {
        try { records = JSON.parse(existingStr) } catch (e) {}
      }

      const newRecord = {
        id: `cons_${sessionId}_${Date.now()}`,
        session_id: sessionId,
        timestamp: new Date().toISOString(),
        date: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
        patient_name: patientName,
        abha_id: abhaId,
        doctor: {
          id: doc.id,
          name: doc.name,
          specialty: doc.specialty,
          post: doc.post,
          room: doc.room_number,
          fee: doc.fee
        },
        token: token,
        chief_complaint: structuredSummary?.chief_complaint || 'General Clinical Consultation',
        provisional_diagnosis: structuredSummary?.provisional_diagnosis || 'Symptomatic Assessment',
        structured_summary: structuredSummary,
        raw_summary: rawSummary,
        status: 'Waiting for Doctor Call'
      }

      // Prepend so latest is first
      records.unshift(newRecord)
      localStorage.setItem('aarogya_medical_records', JSON.stringify(records))
      localStorage.setItem('aarogya_latest_token', token)
    } catch (e) {
      console.warn('Failed saving to medical records:', e)
    }
  }

  // Handle patient choosing a doctor
  const handleSelectAndQueue = async (doc: DoctorItem) => {
    setJoiningQueue(true)
    try {
      const res = await fetch('/api/chat/doctor/queue-patient', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          doctor_id: doc.id,
          doctor_name: doc.name,
          doctor_specialty: doc.specialty,
          doctor_post: doc.post,
          doctor_room: doc.room_number,
          doctor_fee: doc.fee
        })
      })

      if (res.ok) {
        const data = await res.json()
        const token = data.queue_token
        setQueueState({
          is_queued: true,
          queue_token: token,
          queue_status: data.queue_status || 'waiting',
          assigned_doctor_name: doc.name,
          assigned_doctor_room: doc.room_number,
          assigned_doctor_specialty: doc.specialty,
          assigned_doctor_post: doc.post,
          assigned_doctor_fee: doc.fee,
          now_serving: token,
          patients_ahead: doc.current_queue_count,
          estimated_wait_minutes: Math.max(5, doc.current_queue_count * 7)
        })

        // Auto-save clinical history & doctor assignment into patient's Medical Records
        saveToMedicalRecord(doc, token)
      }
    } catch (e) {
      console.error('Queue assignment failed:', e)
    } finally {
      setJoiningQueue(false)
    }
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 text-left">
      {/* SECTION A: PATIENT ALREADY IN QUEUE (LIVE TRACKER) */}
      {queueState && queueState.is_queued ? (
        <div className="space-y-6">
          {/* URGENT CALL BANNER: WHEN DOCTOR CALLS PATIENT */}
          {queueState.queue_status === 'called' && (
            <div className="relative overflow-hidden bg-gradient-to-r from-emerald-600 via-teal-600 to-green-600 rounded-2xl sm:rounded-3xl p-5 sm:p-7 text-white shadow-2xl border-4 border-amber-300 animate-pulse">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-white shrink-0 shadow-inner">
                    <Bell className="w-9 h-9 sm:w-11 sm:h-11 animate-bounce text-amber-200" />
                  </div>
                  <div>
                    <span className="bg-amber-400 text-slate-900 font-black text-xs uppercase px-3 py-1 rounded-full shadow-sm tracking-wider">
                      🔔 {t('DOCTOR IS CALLING YOU NOW!', 'डॉक्टर आपको बुला रहे हैं!', 'மருத்துவர் அழைக்கிறார்!', 'వైద్యులు మిమ్మల్ని పిలుస్తున్నారు!')}
                    </span>
                    <h3 className="text-xl sm:text-2xl font-black text-white mt-1.5">
                      {t('Please Proceed to Room', 'कृपया कमरा नंबर में प्रवेश करें:', 'அறைக்குச் செல்லவும்:', 'దయచేసి గదికి వెళ్లండి:')} {queueState.assigned_doctor_room}
                    </h3>
                    <p className="text-sm sm:text-base text-emerald-100 font-bold mt-0.5">
                      {queueState.assigned_doctor_name} ({queueState.assigned_doctor_post}) {t('is waiting for you.', 'आपकी प्रतीक्षा कर रहे हैं।', 'உங்களுக்காக காத்திருக்கிறார்.', 'మీ కోసం వేచి ఉన్నారు.')}
                    </p>
                  </div>
                </div>

                <button
                  onClick={playCallChime}
                  className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shrink-0 border border-white/30"
                >
                  <Volume2 className="w-4 h-4 text-amber-200" />
                  <span>{t('Replay Chime', 'घंटी पुनः बजाएं', 'மணி ஒலிக்கவும்', 'బెల్ మోగించండి')}</span>
                </button>
              </div>
            </div>
          )}

          {/* MAIN QUEUE TRACKER TICKET */}
          <div className="bg-white rounded-2xl sm:rounded-3xl border-2 sm:border-4 border-blue-900 shadow-xl overflow-hidden">
            <div className="bg-gradient-to-r from-blue-950 via-blue-900 to-indigo-900 p-5 sm:p-7 text-white flex flex-col sm:flex-row justify-between items-center gap-4 text-center sm:text-left">
              <div>
                <span className="bg-blue-800/80 text-blue-200 text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full border border-blue-700">
                  {t('Live OPD Queue Tracker', 'लाइव ओपीडी कतार ट्रैकर', 'நேரலை OPD வரிசை', 'లైవ్ OPD క్యూ ట్రాకర్')}
                </span>
                <h3 className="text-xl sm:text-2xl font-black text-white mt-1">
                  {queueState.assigned_doctor_name}
                </h3>
                <p className="text-xs sm:text-sm text-blue-200 font-medium">
                  {queueState.assigned_doctor_post} • {queueState.assigned_doctor_specialty}
                </p>
              </div>

              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/15">
                <MapPin className="w-5 h-5 text-emerald-300" />
                <div className="text-left">
                  <span className="text-[10px] text-blue-200 uppercase font-black block">{t('Consultation Room', 'कमरा संख्या', 'ஆலோசனை அறை', 'సంప్రదింపు గది')}</span>
                  <span className="text-base sm:text-lg font-black text-white">Room {queueState.assigned_doctor_room}</span>
                </div>
              </div>
            </div>

            {/* Token Highlight Area */}
            <div className="p-6 sm:p-8 bg-slate-50 flex flex-col items-center justify-center space-y-5 text-center">
              <div>
                <span className="text-xs uppercase font-extrabold text-slate-500 tracking-wider block">
                  {t('Your OPD Token Number', 'आपका ओपीडी टोकन नंबर', 'உங்கள் டோக்கன் எண்', 'మీ టోకెన్ సంఖ్య')}
                </span>
                <div className="mt-2 inline-flex items-center justify-center px-8 py-3 bg-gradient-to-r from-blue-900 to-indigo-900 text-white font-mono text-3xl sm:text-5xl font-black rounded-2xl shadow-xl tracking-wider border-2 border-blue-400">
                  {queueState.queue_token}
                </div>
              </div>

              {/* Status Meter Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 w-full max-w-xl">
                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
                  <span className="text-[11px] uppercase font-extrabold text-slate-400 block">{t('Now Serving', 'अभी सेवा में', 'தற்போதைய டோக்கன்', 'ప్రస్తుత టోకెన్')}</span>
                  <span className="text-lg sm:text-xl font-black text-emerald-700 font-mono mt-0.5 block">
                    {queueState.now_serving || queueState.queue_token}
                  </span>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
                  <span className="text-[11px] uppercase font-extrabold text-slate-400 block">{t('Patients Ahead', 'आपसे आगे मरीज', 'முன்னால் உள்ளவர்கள்', 'మీ ముందున్న రోగులు')}</span>
                  <span className="text-lg sm:text-xl font-black text-blue-900 mt-0.5 block">
                    {queueState.patients_ahead} {t('Patients', 'मरीज', 'நபர்கள்', 'రోగులు')}
                  </span>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
                  <span className="text-[11px] uppercase font-extrabold text-slate-400 block">{t('Estimated Wait', 'अनुमानित प्रतीक्षा', 'மதிப்பிடப்பட்ட நேரம்', 'అంచనా వేసిన సమయం')}</span>
                  <span className="text-lg sm:text-xl font-black text-amber-700 mt-0.5 block">
                    ~{queueState.estimated_wait_minutes} {t('Mins', 'मिनट', 'நிமிடம்', 'నిమి')}
                  </span>
                </div>
              </div>

              {/* Live Polling Indicator */}
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping" />
                <span>{t('Live Queue Status Active • Auto-refreshing every 3s', 'लाइव कतार स्थिति सक्रिय • हर 3 सेकंड में स्वतः अपडेट', 'நேரலை கண்காணிப்பு • 3 வினாடிகளில் புதுப்பிக்கப்படுகிறது', 'లైవ్ క్యూ యాక్టివ్ • ప్రతి 3 సెకన్లకు రిఫ్రెష్')}</span>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3 justify-center pt-2">
                <button
                  onClick={onViewMedicalRecords}
                  className="h-12 sm:h-14 px-6 bg-blue-900 hover:bg-blue-950 text-white font-black text-sm sm:text-base rounded-xl sm:rounded-2xl shadow-md flex items-center gap-2 transition-all"
                >
                  <FolderHeart className="w-5 h-5" />
                  <span>{t('View in Medical Records', 'मेडिकल रिकॉर्ड में देखें', 'மருத்துவப் பதிவுகள்', 'మెడికల్ రికార్డులు')}</span>
                </button>

                <button
                  onClick={() => window.print()}
                  className="h-12 sm:h-14 px-5 bg-white hover:bg-slate-100 text-slate-800 font-extrabold text-sm sm:text-base rounded-xl sm:rounded-2xl border border-slate-300 shadow-xs flex items-center gap-2"
                >
                  <span>{t('Print Token Slip', 'टोकन पर्ची प्रिंट करें', 'டோக்கன் அச்சிடுக', 'టోకెన్ ప్రింట్ చేయండి')}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* SECTION B: SELECT DOCTOR ACCORDING TO ILLNESS */
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-blue-900 to-indigo-900 rounded-2xl sm:rounded-3xl p-4 sm:p-6 text-white shadow-lg flex flex-col sm:flex-row justify-between sm:items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-blue-700 text-blue-100 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full">
                  {t('Step 2: Doctor Selection', 'चरण 2: डॉक्टर चयन', 'படி 2: மருத்துவர் தேர்வு', 'దశ 2: వైద్యుల ఎంపిక')}
                </span>
                <span className="text-emerald-300 text-xs font-bold flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  {t('AI Matched to your symptoms', 'आपके लक्षणों के अनुसार', 'உங்கள் அறிகுறிகளுக்கு ஏற்ப', 'మీ లక్షణాలకు అనుగుణంగా')}
                </span>
              </div>
              <h3 className="text-lg sm:text-2xl font-black text-white mt-1">
                {t('Choose Your Consulting Specialist Doctor', 'परामर्श हेतु विशेषज्ञ डॉक्टर चुनें', 'ஆலோசனைக்கு சிறப்பு மருத்துவரைத் தேர்வு செய்க', 'సంప్రదింపు కోసం ప్రత్యేక వైద్యుడిని ఎంచుకోండి')}
              </h3>
              <p className="text-xs sm:text-sm text-blue-200 mt-0.5">
                {t('Select a doctor to generate your OPD token and join their live consultation queue.', 'ओपीडी टोकन प्राप्त करने और डॉक्टर की कतार में शामिल होने के लिए चुनें।', 'OPD டோக்கன் பெற்று வரிசையில் இணைய மருத்துவரைத் தேர்ந்தெடுக்கவும்.', 'OPD టోకెన్ పొంది క్యూలో చేరడానికి వైద్యుడిని ఎంచుకోండి.')}
              </p>
            </div>

            <button
              onClick={fetchDoctors}
              disabled={loadingDoctors}
              className="px-3.5 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold flex items-center gap-1.5 self-start sm:self-auto border border-white/20"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingDoctors ? 'animate-spin' : ''}`} />
              <span>{t('Refresh', 'रीफ्रेश', 'புதுப்பிக்கவும்', 'రిఫ్రెష్')}</span>
            </button>
          </div>

          {loadingDoctors ? (
            <div className="p-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200 flex flex-col items-center justify-center gap-3">
              <RefreshCw className="w-8 h-8 animate-spin text-blue-700" />
              <p className="text-sm font-bold text-slate-600">
                {t('Matching OPD specialist doctors to your symptoms...', 'आपके लक्षणों के अनुसार डॉक्टरों की सूची लोड हो रही है...', 'பொருத்தமான மருத்துவர்களைக் கண்டறிகிறது...', 'వైద్యుల జాబితా లోడ్ అవుతోంది...')}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {doctors.map((doc) => {
                const isRec = doc.is_recommended
                const isSelected = selectedDoctorId === doc.id

                return (
                  <div
                    key={doc.id}
                    onClick={() => setSelectedDoctorId(doc.id)}
                    className={`relative rounded-2xl sm:rounded-3xl p-4 sm:p-5 transition-all cursor-pointer border-2 shadow-sm hover:shadow-md flex flex-col justify-between ${
                      isRec
                        ? 'border-emerald-500 bg-gradient-to-br from-emerald-50/50 via-white to-teal-50/30'
                        : isSelected
                        ? 'border-blue-700 bg-blue-50/40'
                        : 'border-slate-200 bg-white hover:border-blue-400'
                    }`}
                  >
                    {/* Recommended Ribbon */}
                    {isRec && (
                      <div className="mb-2 flex items-center gap-1.5 bg-emerald-600 text-white text-[10px] sm:text-xs font-black px-2.5 py-0.5 rounded-full w-fit shadow-xs">
                        <Sparkles className="w-3 h-3 text-amber-300" />
                        <span>{t('Recommended for Your Disease / Symptoms', 'आपके रोग के लिए विशेष रूप से अनुशंसित', 'உங்கள் நோய்க்குப் பரிந்துரைக்கப்படுகிறது', 'మీ వ్యాధికి సిఫార్సు చేయబడింది')}</span>
                      </div>
                    )}

                    <div>
                      {/* Doctor Profile Header */}
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-blue-100 flex items-center justify-center text-2xl shrink-0 shadow-xs border border-blue-200">
                          {doc.avatar || '👨‍⚕️'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                            {doc.name}
                          </h4>
                          <p className="text-xs font-bold text-blue-900 mt-0.5">
                            {doc.post}
                          </p>
                          <p className="text-xs font-medium text-slate-500">
                            {doc.qualification}
                          </p>
                        </div>
                      </div>

                      {/* Doctor Details Grid */}
                      <div className="mt-3.5 grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-white/80 p-2.5 rounded-xl border border-slate-200/80">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">{t('Specialisation', 'विशेषज्ञता', 'சிறப்பு', 'ప్రత్యేకత')}</span>
                          <span className="font-extrabold text-slate-800 truncate block mt-0.5">{doc.specialty}</span>
                        </div>

                        <div className="bg-white/80 p-2.5 rounded-xl border border-slate-200/80">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">{t('Consulting Fee', 'परामर्श शुल्क', 'கட்டணம்', 'ఫీజు')}</span>
                          <span className="font-black text-emerald-700 flex items-center gap-1 mt-0.5">
                            <CreditCard className="w-3 h-3" />
                            {doc.fee}
                          </span>
                        </div>

                        <div className="bg-white/80 p-2.5 rounded-xl border border-slate-200/80">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">{t('Room Location', 'कमरा नंबर', 'அறை', 'గది సంఖ్య')}</span>
                          <span className="font-black text-blue-950 flex items-center gap-1 mt-0.5">
                            <Building2 className="w-3 h-3 text-blue-700" />
                            Room {doc.room_number}
                          </span>
                        </div>

                        <div className="bg-white/80 p-2.5 rounded-xl border border-slate-200/80">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">{t('Current Queue', 'वर्तमान कतार', 'தற்போதைய வரிசை', 'ప్రస్తుత క్యూ')}</span>
                          <span className="font-black text-amber-800 flex items-center gap-1 mt-0.5">
                            <Clock className="w-3 h-3 text-amber-600" />
                            {doc.current_queue_count} {t('waiting', 'प्रतीक्षारत', 'காத்திருப்பு', 'వేచి ఉన్నారు')}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Choose Doctor CTA */}
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-500">
                        {doc.experience} {t('Experience', 'अनुभव', 'அனுபவம்', 'అనుభవం')}
                      </span>

                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleSelectAndQueue(doc)
                        }}
                        disabled={joiningQueue}
                        className={`h-10 sm:h-11 px-4 sm:px-5 font-black text-xs sm:text-sm rounded-xl flex items-center gap-1.5 shadow-md transition-all ${
                          isRec
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            : 'bg-blue-900 hover:bg-blue-950 text-white'
                        }`}
                      >
                        <span>{t('Select & Join Queue', 'चुनें व कतार में लगें', 'தேர்வு செய்து வரிசையில் சேரவும்', 'ఎంచుకుని క్యూలో చేరండి')}</span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
