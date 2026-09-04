'use client'

import React, { useState, useEffect } from 'react'
import { 
  Stethoscope, Users, User, Clock, FileText, Search, PlusCircle, 
  CheckCircle, AlertCircle, RefreshCw, LogOut, HeartPulse, Send,
  ChevronRight, Calendar, Activity, CheckCircle2, ShieldAlert,
  ShieldCheck, X, Bell, Pill, Trash2, Plus, Sparkles, CheckSquare,
  Building2
} from 'lucide-react'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import AbhaCard, { PatientInfo } from '@/components/AbhaCard'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import StructuredClinicalSummaryCard from '@/components/StructuredClinicalSummaryCard'
import { useLanguage } from '@/context/LanguageContext'

export interface PrescribedMed {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
}

interface SessionInfo {
  id: string;
  patient_name: string;
  abha_id: string;
  language: string;
  status: string;
  created_at: string;
  patient_details?: PatientInfo;
  
  // Triage details
  symptoms: string;
  duration: string;
  severity: string;
  vital_signs: string;
  
  // AI recommendations & EHR
  ai_triage_category: string;
  ai_recommendation: string;
  session_summary: string;
  structured_summary?: any;
  
  // Doctor Queue details
  queue_token?: string;
  queue_status?: string;
  assigned_doctor_name?: string;
  assigned_doctor_room?: string;
  assigned_doctor_specialty?: string;
  assigned_doctor_post?: string;
  assigned_doctor_fee?: string;
  
  doctor_notes?: string;
  doctor_prescription?: string;
}

export default function DoctorDashboard() {
  const { t } = useLanguage()
  const [sessions, setSessions] = useState<SessionInfo[]>([])
  const [selectedSession, setSelectedSession] = useState<SessionInfo | null>(null)
  const [showAbhaModal, setShowAbhaModal] = useState(false)
  const [doctorNotes, setDoctorNotes] = useState('')
  const [prescription, setPrescription] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [isRefreshing, setIsRefreshing] = useState(false)
  
  // Mobile responsive tab state
  const [mobileTab, setMobileTab] = useState<'queue' | 'consultation'>('queue')

  const fetchSessions = async (silent = false) => {
    if (!silent) setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/chat/doctor/sessions')
      if (!response.ok) throw new Error('Failed to fetch patient sessions')
      const data = await response.json()
      setSessions(data.sessions)
    } catch (err: any) {
      setError(err.message || 'Connection failed to backend API')
    } finally {
      setLoading(false)
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    fetchSessions()
    const interval = setInterval(() => fetchSessions(true), 15000)
    return () => clearInterval(interval)
  }, [])

  const [diagnosis, setDiagnosis] = useState('')
  const [medications, setMedications] = useState<PrescribedMed[]>([
    { name: 'Tab Pantoprazole 40mg', dosage: '40mg', frequency: '1-0-0', duration: '5 days', instructions: 'Before breakfast' }
  ])
  const [followUp, setFollowUp] = useState('Review in OPD after 5 days if symptoms persist.')
  const [callingPatient, setCallingPatient] = useState(false)

  const handleSelectSession = (session: SessionInfo) => {
    setSelectedSession(session)
    setDoctorNotes(session.doctor_notes || '')
    setPrescription(session.doctor_prescription || '')
    
    // Pre-fill diagnosis from structured summary if available
    const struct = session.structured_summary
    if (struct?.confirmed_diagnosis) {
      setDiagnosis(struct.confirmed_diagnosis)
    } else if (struct?.provisional_diagnosis) {
      setDiagnosis(struct.provisional_diagnosis)
    } else {
      setDiagnosis('')
    }

    // Pre-fill medications
    if (struct?.prescribed_medications && Array.isArray(struct.prescribed_medications)) {
      setMedications(struct.prescribed_medications)
    } else {
      const sym = (session.symptoms || '').toLowerCase()
      if (sym.includes('pet') || sym.includes('stomach') || sym.includes('abdomen') || sym.includes('acidity') || sym.includes('gas')) {
        setMedications([
          { name: 'Tab Pantoprazole 40mg', dosage: '40mg', frequency: '1-0-0', duration: '5 days', instructions: 'Before breakfast (empty stomach)' },
          { name: 'Syp Gelusil Antacid', dosage: '10ml', frequency: '1-1-1', duration: '3 days', instructions: 'After meals' }
        ])
      } else if (sym.includes('sir') || sym.includes('head') || sym.includes('fever') || sym.includes('bukhar') || sym.includes('cold')) {
        setMedications([
          { name: 'Tab Paracetamol 650mg', dosage: '650mg', frequency: '1-0-1', duration: '3 days', instructions: 'After meals' }
        ])
      } else {
        setMedications([
          { name: 'Tab Paracetamol 650mg', dosage: '650mg', frequency: '1-0-1', duration: '3 days', instructions: 'After meals' }
        ])
      }
    }

    if (struct?.follow_up_advice) {
      setFollowUp(struct.follow_up_advice)
    } else {
      setFollowUp('Review in OPD after 5 days if pain or symptoms persist.')
    }

    setMessage('')
    setMobileTab('consultation')
  }

  const handleCallPatient = async (sessionId: string) => {
    setCallingPatient(true)
    setMessage('')
    setError('')
    try {
      const res = await fetch('/api/chat/doctor/call-patient', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId })
      })
      if (res.ok) {
        setMessage('🔔 Patient called! Audio chime and visual banner triggered on patient kiosk screen.')
        fetchSessions(true)
        if (selectedSession && selectedSession.id === sessionId) {
          setSelectedSession({ ...selectedSession, queue_status: 'called' })
        }
      } else {
        throw new Error('Server returned error while calling patient')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to call patient')
    } finally {
      setCallingPatient(false)
    }
  }

  const handleAddMedication = () => {
    setMedications(prev => [
      ...prev,
      { name: '', dosage: '1 Tab', frequency: '1-0-1', duration: '3 days', instructions: 'After meals' }
    ])
  }

  const handleRemoveMedication = (index: number) => {
    setMedications(prev => prev.filter((_, idx) => idx !== index))
  }

  const handleUpdateMedication = (index: number, field: keyof PrescribedMed, val: string) => {
    setMedications(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: val }
      return updated
    })
  }

  const handleSavePrescription = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedSession) return
    
    setSaving(true)
    setMessage('')
    setError('')

    const formattedPrescription = prescription.trim() || medications
      .filter(m => m.name.trim())
      .map(m => `- ${m.name} (${m.dosage}) | ${m.frequency} x ${m.duration} [${m.instructions}]`)
      .join('\n')
    
    try {
      const response = await fetch(`/api/chat/doctor/sessions/${selectedSession.id}/prescription`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doctor_notes: doctorNotes,
          doctor_prescription: formattedPrescription,
          diagnosis: diagnosis,
          medications: medications.filter(m => m.name.trim()),
          follow_up: followUp
        })
      })
      
      if (!response.ok) throw new Error('Failed to save prescription')
      
      setMessage('Prescription, confirmed diagnosis and consultation notes saved successfully to Medical Records!')
      fetchSessions(true)
      
      setSelectedSession({
        ...selectedSession,
        status: 'attended',
        queue_status: 'completed',
        doctor_notes: doctorNotes,
        doctor_prescription: formattedPrescription
      })

      // Update patient localStorage medical records if present
      if (typeof window !== 'undefined') {
        try {
          const recStr = localStorage.getItem('aarogya_medical_records')
          let recs = recStr ? JSON.parse(recStr) : []
          const updated = recs.map((r: any) => {
            if (r.session_id === selectedSession.id || r.id.includes(selectedSession.id)) {
              return {
                ...r,
                status: 'Consultation Completed',
                confirmed_diagnosis: diagnosis,
                medications: medications.filter(m => m.name.trim()),
                doctor_prescription: formattedPrescription,
                doctor_notes: doctorNotes,
                follow_up: followUp
              }
            }
            return r
          })
          localStorage.setItem('aarogya_medical_records', JSON.stringify(updated))
        } catch (e) {}
      }
    } catch (err: any) {
      setError(err.message || 'Failed to submit clinical data')
    } finally {
      setSaving(false)
    }
  }

  const getTriageBadge = (category: string) => {
    const clean = category ? category.toLowerCase() : 'green'
    if (clean === 'red') {
      return (
        <span className="px-2.5 py-1 bg-red-100 text-red-800 rounded-full text-xs font-black uppercase flex items-center gap-1 w-fit border border-red-200">
          <ShieldAlert className="w-3.5 h-3.5" />
          High Triage (Red)
        </span>
      )
    }
    if (clean === 'yellow') {
      return (
        <span className="px-2.5 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-bold uppercase flex items-center gap-1 w-fit border border-amber-200">
          <Activity className="w-3.5 h-3.5" />
          Medium Triage (Yellow)
        </span>
      )
    }
    return (
      <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-semibold uppercase flex items-center gap-1 w-fit border border-emerald-200">
        <CheckCircle2 className="w-3.5 h-3.5" />
        Low Triage (Green)
      </span>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between font-sans">
      <Header />
      
      <main className="container mx-auto px-2.5 sm:px-4 py-4 sm:py-8 flex-1 max-w-7xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-5 sm:mb-8 text-center sm:text-left">
          <div className="flex items-center gap-3 justify-center sm:justify-start">
            <div className="p-2 bg-[#002F6C] text-white rounded-xl shadow-md">
              <Stethoscope className="w-6 h-6 sm:w-7 sm:h-7" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-800">{t('OPD Clinical Dashboard', 'ओपीडी क्लिनिकल डैशबोर्ड', 'OPD மருத்துவ டேஷ்போர்டு', 'OPD క్లినికల్ డాష్‌బోర్డ్')}</h1>
              <p className="text-xs text-slate-500">{t('AarogyaMitra Connected Practitioner Interface', 'आरोग्यमित्र कनेक्टेड डॉक्टर इंटरफेस', 'ஆரோக்கியமித்ரா இணைக்கப்பட்ட மருத்துவர் இடைமுகம்', 'ఆరోగ్యమిత్ర కనెక్ట్ చేయబడిన డాక్టర్ ఇంటర్‌ఫేస్')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 justify-center sm:justify-end flex-wrap">
            <LanguageSwitcher variant="dashboard" />
            <button
              onClick={() => {
                setIsRefreshing(true)
                fetchSessions()
              }}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-3.5 sm:px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 rounded-xl text-xs sm:text-sm font-semibold text-slate-700 transition-colors shadow-sm w-fit mx-auto sm:mx-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              {t('Refresh Queue', 'कतार रीफ्रेश करें', 'வரிசையைப் புதுப்பிக்கவும்', 'క్యూని రిఫ్రెష్ చేయండి')}
            </button>
          </div>
        </div>

        {error && !selectedSession && (
          <div className="mb-4 sm:mb-6 p-3.5 sm:p-4 bg-red-50 text-red-800 border border-red-200 rounded-2xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 sm:w-6 sm:h-6 shrink-0 text-red-600" />
            <div>
              <h4 className="font-bold text-sm">Dashboard Connection Error</h4>
              <p className="text-xs text-red-700/90 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Mobile Responsive Tabs */}
        <div className="flex lg:hidden mb-4 sm:mb-6 border border-slate-200 bg-white rounded-xl p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setMobileTab('queue')}
            className={`flex-1 py-2.5 sm:py-3 text-center font-bold text-xs sm:text-sm rounded-lg transition-all flex items-center justify-center gap-1.5 sm:gap-2 ${
              mobileTab === 'queue'
                ? 'bg-blue-50 text-[#002F6C] shadow-inner'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Patient Queue ({sessions.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setMobileTab('consultation')}
            className={`flex-1 py-2.5 sm:py-3 text-center font-bold text-xs sm:text-sm rounded-lg transition-all flex items-center justify-center gap-1.5 sm:gap-2 ${
              mobileTab === 'consultation'
                ? 'bg-blue-50 text-[#002F6C] shadow-inner'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <User className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Consultation {selectedSession ? `(${selectedSession.patient_name.split(' ')[0]})` : ''}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-8 items-stretch min-h-[500px] sm:min-h-[600px]">
          {/* Left panel: Sessions list queue */}
          <div className={`lg:col-span-4 bg-white rounded-2xl sm:rounded-3xl border border-slate-100 shadow-sm flex-col overflow-hidden ${
            mobileTab === 'queue' ? 'flex' : 'hidden lg:flex'
          }`}>
            <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 sm:w-5 sm:h-5 text-slate-500" />
                <h3 className="font-extrabold text-slate-800 text-sm sm:text-base">Patient Queue</h3>
              </div>
              <span className="bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full text-xs font-bold">
                {sessions.length} Active
              </span>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-50 max-h-[550px]">
              {loading ? (
                <div className="p-8 text-center text-slate-400 flex flex-col items-center gap-2 justify-center h-48">
                  <RefreshCw className="w-8 h-8 animate-spin text-slate-300" />
                  <span className="text-sm font-medium">Loading session queue...</span>
                </div>
              ) : sessions.length === 0 ? (
                <div className="p-8 text-center text-slate-400 h-48 flex items-center justify-center">
                  <span className="text-sm font-medium">No patient sessions registered today.</span>
                </div>
              ) : (
                sessions.map((session) => {
                  const token = session.queue_token || `OPD-${session.id.slice(-4).toUpperCase()}`
                  const isCalled = session.queue_status === 'called'
                  const isCompleted = session.status === 'completed' || session.queue_status === 'completed'

                  return (
                    <button
                      key={session.id}
                      onClick={() => handleSelectSession(session)}
                      className={`w-full p-3.5 sm:p-4 text-left transition-all hover:bg-slate-50/70 flex items-center justify-between gap-3 ${
                        selectedSession?.id === session.id ? 'bg-slate-50 border-l-4 border-l-[#002F6C]' : ''
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="px-2 py-0.5 bg-blue-900 text-white font-mono text-xs font-black rounded-md shadow-xs">
                            {token}
                          </span>
                          {isCalled ? (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-black rounded-full animate-pulse border border-emerald-300 flex items-center gap-1">
                              <Bell className="w-3 h-3 text-emerald-600" />
                              CALLED
                            </span>
                          ) : isCompleted ? (
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-full border border-slate-200">
                              COMPLETED
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded-full border border-amber-200">
                              WAITING
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-bold text-slate-800 text-sm truncate">{session.patient_name}</h4>
                          <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-1.5 py-0.5 rounded flex items-center gap-0.5 shrink-0">
                            <ShieldCheck className="w-3 h-3 text-emerald-600" />
                            ABHA
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-xs text-slate-400 font-mono mb-2">
                          <span className="truncate">ABHA: {session.abha_id || 'Self-registered'}</span>
                          {session.assigned_doctor_room && (
                            <span className="text-blue-900 font-bold">Room {session.assigned_doctor_room}</span>
                          )}
                        </div>

                        {getTriageBadge(session.ai_triage_category)}
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-300 shrink-0" />
                    </button>
                  )
                })
              )}
            </div>
          </div>

          {/* Right panel: Active session details and clinical entry */}
          <div className={`lg:col-span-8 bg-white rounded-2xl sm:rounded-3xl border border-slate-100 shadow-sm p-4 sm:p-6 flex-col ${
            mobileTab === 'consultation' ? 'flex' : 'hidden lg:flex'
          }`}>
            {selectedSession ? (
              <div className="flex-1 flex flex-col justify-between">
                <div>
                <div className="space-y-6">
                  {/* Patient Header Card with Call Button */}
                  <div className="bg-slate-50 rounded-xl sm:rounded-2xl border border-slate-200 p-4 sm:p-5 flex flex-wrap justify-between items-center gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-[#002F6C]/10 rounded-2xl flex items-center justify-center text-[#002F6C] font-black text-lg">
                        {selectedSession.patient_name[0]}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-extrabold text-slate-800 text-lg leading-tight">{selectedSession.patient_name}</h3>
                          <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3 text-emerald-600" />
                            ABHA VERIFIED
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-400 font-mono mt-0.5">
                          <span>ABHA: {selectedSession.abha_id}</span>
                          {selectedSession.queue_token && (
                            <span className="px-2 py-0.5 bg-blue-900 text-white font-black rounded-md">
                              Token: {selectedSession.queue_token}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 items-center flex-wrap">
                      {/* Call Patient to Room Button */}
                      <button
                        type="button"
                        onClick={() => handleCallPatient(selectedSession.id)}
                        disabled={callingPatient}
                        className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-sm ${
                          selectedSession.queue_status === 'called'
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white animate-pulse'
                            : 'bg-amber-600 hover:bg-amber-700 text-white'
                        }`}
                      >
                        <Bell className={`w-3.5 h-3.5 ${callingPatient ? 'animate-spin' : 'animate-bounce'}`} />
                        <span>
                          {callingPatient
                            ? 'Calling Patient...'
                            : selectedSession.queue_status === 'called'
                            ? '🔔 Patient Called (Ring Again)'
                            : '🔔 Call Patient to Room'}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowAbhaModal(true)}
                        className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
                      >
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                        <span>View ABHA Card</span>
                      </button>

                      <span className={`px-3 py-2 rounded-xl text-xs font-black uppercase ${
                        selectedSession.status === 'attended' || selectedSession.status === 'completed'
                          ? 'bg-slate-100 text-slate-500'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {selectedSession.status}
                      </span>
                    </div>
                  </div>

                  {/* Submission success/error message */}
                  {message && (
                    <div className="p-4 bg-emerald-50 text-emerald-900 border border-emerald-200 rounded-xl flex items-center gap-2.5 text-sm font-bold shadow-xs">
                      <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                      <span>{message}</span>
                    </div>
                  )}

                  {error && selectedSession && (
                    <div className="p-4 bg-red-50 text-red-800 border border-red-100 rounded-xl flex items-center gap-2.5 text-sm font-medium">
                      <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  {/* SECTION 1: STRUCTURED CLINICAL HISTORY AND EHR SUMMARY */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-blue-700" />
                      <span>Structured Clinical History & Intake Summary (AI Verified)</span>
                    </h4>

                    <StructuredClinicalSummaryCard
                      data={selectedSession.structured_summary}
                      rawText={selectedSession.session_summary}
                    />
                  </div>

                  {/* SECTION 2: STRUCTURED PRESCRIPTION & DIAGNOSIS BUILDER */}
                  <form onSubmit={handleSavePrescription} className="space-y-4 bg-slate-50/70 p-4 sm:p-5 rounded-2xl border border-slate-200">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                      <div>
                        <h4 className="font-black text-slate-900 text-sm sm:text-base flex items-center gap-2">
                          <Pill className="w-4 h-4 text-emerald-600" />
                          <span>Physician Consultation & Structured Prescription</span>
                        </h4>
                        <p className="text-xs text-slate-500">Enter confirmed diagnosis and prescription to link with patient's Medical Records.</p>
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 font-mono">FHIR CarePlan v4.0.1</span>
                    </div>

                    {/* Confirmed Diagnosis */}
                    <div>
                      <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                        Confirmed Diagnosis / Clinical Assessment
                      </label>
                      <input
                        type="text"
                        value={diagnosis}
                        onChange={(e) => setDiagnosis(e.target.value)}
                        placeholder="e.g. Acute Gastritis with Dyspepsia / GERD"
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 text-slate-800 text-sm font-bold shadow-xs"
                      />
                    </div>

                    {/* Structured Medications Table */}
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">
                          Prescribed Medications
                        </label>
                        <button
                          type="button"
                          onClick={handleAddMedication}
                          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-xs"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Medicine</span>
                        </button>
                      </div>

                      {/* Quick Prescription Presets */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] font-bold text-slate-400">Quick Presets:</span>
                        {[
                          { name: 'Tab Pantoprazole 40mg', dosage: '40mg', frequency: '1-0-0', duration: '5 days', instructions: 'Before food' },
                          { name: 'Tab Paracetamol 650mg', dosage: '650mg', frequency: '1-0-1', duration: '3 days', instructions: 'After food' },
                          { name: 'Syp Gelusil Antacid', dosage: '10ml', frequency: '1-1-1', duration: '3 days', instructions: 'After food' },
                          { name: 'ORS Sachet (Electrolyte)', dosage: '1 Sachet in 1L', frequency: 'TDS', duration: '2 days', instructions: 'Sip throughout day' },
                          { name: 'Tab Cetirizine 10mg', dosage: '10mg', frequency: '0-0-1', duration: '5 days', instructions: 'At bedtime' }
                        ].map((preset, pIdx) => (
                          <button
                            key={pIdx}
                            type="button"
                            onClick={() => {
                              if (!medications.some(m => m.name === preset.name)) {
                                setMedications(prev => [...prev, preset])
                              }
                            }}
                            className="px-2 py-0.5 bg-white hover:bg-blue-50 text-blue-900 border border-slate-200 rounded-md text-[11px] font-bold shadow-2xs"
                          >
                            + {preset.name}
                          </button>
                        ))}
                      </div>

                      <div className="space-y-2">
                        {medications.map((med, mIdx) => (
                          <div key={mIdx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 bg-white p-2.5 rounded-xl border border-slate-200 items-center shadow-xs">
                            <div className="sm:col-span-4">
                              <input
                                type="text"
                                value={med.name}
                                onChange={(e) => handleUpdateMedication(mIdx, 'name', e.target.value)}
                                placeholder="Medicine name (e.g. Tab Pantoprazole 40mg)"
                                className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-900"
                              />
                            </div>
                            <div className="sm:col-span-2">
                              <input
                                type="text"
                                value={med.dosage}
                                onChange={(e) => handleUpdateMedication(mIdx, 'dosage', e.target.value)}
                                placeholder="Dosage (e.g. 40mg)"
                                className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-900"
                              />
                            </div>
                            <div className="sm:col-span-2">
                              <input
                                type="text"
                                value={med.frequency}
                                onChange={(e) => handleUpdateMedication(mIdx, 'frequency', e.target.value)}
                                placeholder="Frequency (1-0-1)"
                                className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-900"
                              />
                            </div>
                            <div className="sm:col-span-3">
                              <input
                                type="text"
                                value={med.instructions}
                                onChange={(e) => handleUpdateMedication(mIdx, 'instructions', e.target.value)}
                                placeholder="Instructions (e.g. Before food)"
                                className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-900"
                              />
                            </div>
                            <div className="sm:col-span-1 flex justify-end">
                              <button
                                type="button"
                                onClick={() => handleRemoveMedication(mIdx)}
                                className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Follow up & Advice */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                          Follow-up & Patient Instructions
                        </label>
                        <input
                          type="text"
                          value={followUp}
                          onChange={(e) => setFollowUp(e.target.value)}
                          placeholder="e.g. Review in OPD after 5 days if pain persists."
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-blue-900 text-slate-700 text-xs font-medium"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                          Clinical Examination & Physician Notes
                        </label>
                        <input
                          type="text"
                          value={doctorNotes}
                          onChange={(e) => setDoctorNotes(e.target.value)}
                          placeholder="e.g. Abdomen soft, mild epigastric tenderness noted."
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-blue-900 text-slate-700 text-xs font-medium"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={saving}
                      className="w-full py-3.5 bg-gradient-to-r from-blue-900 to-indigo-900 hover:from-blue-950 hover:to-indigo-950 text-white rounded-xl text-sm font-black transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-950/20 active:scale-98"
                    >
                      <CheckSquare className="w-5 h-5 text-emerald-400" />
                      <span>{saving ? 'Submitting & Linking Records...' : 'Save & Issue Prescription to Medical Records'}</span>
                    </button>
                  </form>
                </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 py-12">
                <FileText className="w-16 h-16 text-slate-200 mb-3 animate-pulse" />
                <h3 className="font-extrabold text-slate-700 text-base">No Patient Selected</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-xs text-center">
                  Select an active patient session from the queue on the left to review AI clinical intake and log OPD clinical advice.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ABHA Card Inspection Modal for Doctor */}
        {showAbhaModal && selectedSession && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
            <div className="bg-white rounded-2xl sm:rounded-3xl max-w-xl w-full p-4 sm:p-6 shadow-2xl relative border border-slate-100 max-h-[90vh] overflow-y-auto">
              <button
                type="button"
                onClick={() => setShowAbhaModal(false)}
                className="absolute top-4 right-4 p-2 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-500 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="mb-4">
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                  <span>Ayushman Bharat Verified Health Credentials</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Authenticated via National Health Authority (NHA) ABDM Gateway
                </p>
              </div>

              <AbhaCard
                patient={selectedSession.patient_details || {
                  id: selectedSession.id,
                  full_name: selectedSession.patient_name,
                  abha_number: selectedSession.abha_id,
                  abha_address: selectedSession.abha_id.includes('@') ? selectedSession.abha_id : `${selectedSession.patient_name.toLowerCase().replace(/\s+/g, '.')}@abdm`,
                  gender: 'M',
                  date_of_birth: '1985-06-15',
                  mobile_number: '+91 ******3210',
                  auth_method: 'VERIFIED',
                  verification_status: 'VERIFIED'
                }}
                compact={true}
              />

              <div className="mt-5 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowAbhaModal(false)}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors"
                >
                  Close Preview
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
      
      <Footer />
    </div>
  )
}
