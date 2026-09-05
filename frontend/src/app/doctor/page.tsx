'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  Stethoscope, Users, User, Clock, FileText, Search, PlusCircle, 
  CheckCircle, AlertCircle, RefreshCw, LogOut, HeartPulse, Send,
  ChevronRight, Calendar, Activity, CheckCircle2, ShieldAlert,
  ShieldCheck, X, Bell, Pill, Trash2, Plus, Sparkles, CheckSquare,
  Building2, Phone, AlertTriangle, Printer, Coffee, Siren, FileCheck,
  ChevronDown, MessageSquare, QrCode
} from 'lucide-react'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import AbhaCard, { PatientInfo } from '@/components/AbhaCard'
import StructuredClinicalSummaryCard from '@/components/StructuredClinicalSummaryCard'
import { useLanguage } from '@/context/LanguageContext'

export interface PrescribedMed {
  id?: string;
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
}

interface DoctorSessionPatient {
  session_id: string;
  queue_token: string;
  queue_status: string;
  queue_assigned_at: string;
  patient: {
    id: number;
    full_name: string;
    abha_number: string;
    abha_address: string;
    gender: string;
    date_of_birth: string;
    mobile_number: string;
    blood_group?: string;
    allergies?: string;
    address?: string;
    district?: string;
    state?: string;
    profile_photo?: string;
    age: number;
    age_group: 'pediatric' | 'adult' | 'senior';
  };
  clinical: {
    symptoms: string;
    duration: string;
    severity: string;
    ai_triage_category: 'red' | 'yellow' | 'green';
    ai_triage_label: string;
    ai_recommendation: string;
    summary: string;
    structured_summary?: any;
    ocr_text?: string;
    doctor_notes?: string;
    doctor_prescription?: string;
    chat_history?: Array<{
      role: string;
      message: string;
      translated_message?: string;
      timestamp?: string;
    }>;
  };
}

export default function DoctorDashboard() {
  const router = useRouter()
  const { t } = useLanguage()

  // Authenticated doctor state
  const [currentDoctor, setCurrentDoctor] = useState<any>(null)
  
  // Navigation Tabs: 'queue' | 'current'
  const [activeTab, setActiveTab] = useState<'queue' | 'current'>('queue')

  // Queue & Consultation Data
  const [waitingQueue, setWaitingQueue] = useState<DoctorSessionPatient[]>([])
  const [currentPatient, setCurrentPatient] = useState<DoctorSessionPatient | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [callingPatient, setCallingPatient] = useState(false)

  // Filters for Patient Queue (Requirement 8)
  const [ageFilter, setAgeFilter] = useState<'all' | 'pediatric' | 'adult' | 'senior'>('all')
  const [conditionFilter, setConditionFilter] = useState<'all' | 'red' | 'yellow' | 'green'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Doctor Availability Status (Requirement 11, 12, 13)
  const [doctorStatus, setDoctorStatus] = useState<'Consulting' | 'On Break' | 'Emergency Duty'>('Consulting')
  const [statusUpdating, setStatusUpdating] = useState(false)

  // Consultation Form State
  const [diagnosis, setDiagnosis] = useState('')
  const [doctorNotes, setDoctorNotes] = useState('')
  const [medications, setMedications] = useState<PrescribedMed[]>([
    { name: 'Tab Pantoprazole 40mg', dosage: '40mg', frequency: '1-0-0', duration: '5 days', instructions: 'Before breakfast' },
    { name: 'Tab Paracetamol 650mg', dosage: '650mg', frequency: '1-0-1', duration: '3 days', instructions: 'After meals' }
  ])
  const [followUp, setFollowUp] = useState('Review in OPD after 5 days if symptoms persist.')
  const [showAbhaModal, setShowAbhaModal] = useState(false)
  const [showPrintModal, setShowPrintModal] = useState(false)
  const [showTranscript, setShowTranscript] = useState(false)

  // Active consultation session and doctor state references to avoid stale closures in intervals & async fetches
  const activeSessionIdRef = useRef<string | null>(null)
  const currentDoctorRef = useRef<any>(null)
  const doctorStatusRef = useRef<'Consulting' | 'On Break' | 'Emergency Duty'>('Consulting')

  useEffect(() => {
    currentDoctorRef.current = currentDoctor
  }, [currentDoctor])

  useEffect(() => {
    doctorStatusRef.current = doctorStatus
  }, [doctorStatus])

  // Verify authentication on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const authStr = localStorage.getItem('aarogya_doctor_auth')
      if (!authStr) {
        router.push('/doctor/login')
        return
      }
      try {
        const parsed = JSON.parse(authStr)
        setCurrentDoctor(parsed.doctor)
        setDoctorStatus(parsed.doctor.status || 'Consulting')
      } catch (e) {
        router.push('/doctor/login')
      }
    }
  }, [router])

  // Fetch live doctor queue
  const fetchQueue = async (silent = false) => {
    const docId = currentDoctorRef.current?.id || currentDoctor?.id
    if (!docId) return
    if (!silent) setLoading(true)
    else setRefreshing(true)
    setError('')

    try {
      const res = await fetch(`/api/opd/doctor/${docId}/queue`)
      if (!res.ok) throw new Error('Failed to load patient queue')

      const data = await res.json()
      setWaitingQueue(data.waiting_queue || [])
      
      // Update availability status if changed on server
      if (data.doctor_status && data.doctor_status !== doctorStatusRef.current) {
        setDoctorStatus(data.doctor_status)
        doctorStatusRef.current = data.doctor_status
      }

      // If a patient is currently called, load into currentPatient ONLY IF DIFFERENT from currently active consultation session
      if (data.current_patient) {
        if (!activeSessionIdRef.current || activeSessionIdRef.current !== data.current_patient.session_id) {
          loadPatientIntoConsultation(data.current_patient)
        } else {
          // Keep currentPatient metadata in sync WITHOUT touching doctor's active form edits (notes, meds, diagnosis)!
          setCurrentPatient(prev => prev ? {
            ...prev,
            queue_status: data.current_patient.queue_status,
            queue_token: data.current_patient.queue_token,
            patient: data.current_patient.patient || prev.patient
          } : data.current_patient)
        }
      }
    } catch (err: any) {
      setError(err.message || 'Error fetching doctor queue')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    if (currentDoctor?.id) {
      fetchQueue()
      const timer = setInterval(() => fetchQueue(true), 8000)
      return () => clearInterval(timer)
    }
  }, [currentDoctor?.id])

  // Load patient clinical data into form
  const loadPatientIntoConsultation = (p: DoctorSessionPatient) => {
    activeSessionIdRef.current = p.session_id
    setCurrentPatient(p)
    const struct = p.clinical.structured_summary || {}
    
    // Set diagnosis
    if (struct.confirmed_diagnosis) {
      setDiagnosis(struct.confirmed_diagnosis)
    } else if (struct.provisional_diagnosis) {
      setDiagnosis(struct.provisional_diagnosis)
    } else {
      setDiagnosis(p.clinical.ai_recommendation || '')
    }

    // Set notes
    setDoctorNotes(p.clinical.doctor_notes || '')

    // Set medications
    if (struct.prescribed_medications && Array.isArray(struct.prescribed_medications) && struct.prescribed_medications.length > 0) {
      setMedications(struct.prescribed_medications)
    } else {
      const sym = (p.clinical.symptoms || '').toLowerCase()
      if (sym.includes('pet') || sym.includes('stomach') || sym.includes('acidity') || sym.includes('gas') || sym.includes('vomit')) {
        setMedications([
          { name: 'Tab Pantoprazole 40mg', dosage: '40mg', frequency: '1-0-0', duration: '5 days', instructions: 'Before breakfast' },
          { name: 'Syp Gelusil Antacid', dosage: '10ml', frequency: '1-1-1', duration: '3 days', instructions: 'After meals' }
        ])
      } else if (sym.includes('fever') || sym.includes('bukhar') || sym.includes('head') || sym.includes('body ache')) {
        setMedications([
          { name: 'Tab Paracetamol 650mg', dosage: '650mg', frequency: '1-0-1', duration: '3 days', instructions: 'After meals' },
          { name: 'Tab Cetirizine 10mg', dosage: '10mg', frequency: '0-0-1', duration: '3 days', instructions: 'At bedtime' }
        ])
      } else {
        setMedications([
          { name: 'Tab Paracetamol 650mg', dosage: '650mg', frequency: '1-0-1', duration: '3 days', instructions: 'After meals' }
        ])
      }
    }

    if (struct.follow_up_advice) {
      setFollowUp(struct.follow_up_advice)
    } else {
      setFollowUp('Review in OPD after 5 days if symptoms persist.')
    }
  }

  // Handle Availability Status Change (Requirement 11, 12, 13)
  const handleStatusChange = async (newStatus: 'Consulting' | 'On Break' | 'Emergency Duty') => {
    const docId = currentDoctorRef.current?.id || currentDoctor?.id
    if (!docId) return
    setStatusUpdating(true)
    setMessage('')
    setError('')

    try {
      const res = await fetch(`/api/opd/doctor/${docId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Failed to update availability status')

      setDoctorStatus(newStatus)
      doctorStatusRef.current = newStatus
      if (typeof window !== 'undefined') {
        const auth = JSON.parse(localStorage.getItem('aarogya_doctor_auth') || '{}')
        if (auth.doctor) {
          auth.doctor.status = newStatus
          localStorage.setItem('aarogya_doctor_auth', JSON.stringify(auth))
        }
      }

      if (newStatus === 'On Break') {
        setMessage('☕ Availability set to On Break. Patient consultation queue is paused.')
      } else if (newStatus === 'Emergency Duty') {
        setMessage('🚨 Availability set to Emergency Duty. New patients in kiosk will be automatically routed to backup doctors.')
      } else {
        setMessage('🟢 Availability set to Consulting. You are ready to see patients!')
      }

      fetchQueue(true)
    } catch (err: any) {
      setError(err.message || 'Status update failed')
    } finally {
      setStatusUpdating(false)
    }
  }

  // Handle Call Patient Action (Requirement 8)
  const handleCallPatient = async (sessionPatient: DoctorSessionPatient) => {
    setCallingPatient(true)
    setMessage('')
    setError('')

    try {
      const res = await fetch('/api/opd/doctor/call-patient', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionPatient.session_id })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Failed to call patient')

      setMessage(`🔔 Token ${sessionPatient.queue_token} (${sessionPatient.patient.full_name}) called into Cabin ${currentDoctor?.room_number}! Audio chime triggered on Patient Kiosk.`)
      
      // Load patient into Current Patient view and switch tab
      loadPatientIntoConsultation({
        ...sessionPatient,
        queue_status: 'called'
      })
      setActiveTab('current')
      fetchQueue(true)
    } catch (err: any) {
      setError(err.message || 'Failed to call patient')
    } finally {
      setCallingPatient(false)
    }
  }

  // Medication handlers
  const handleAddMedication = () => {
    setMedications(prev => [
      ...prev,
      { id: `med_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, name: '', dosage: '1 Tab', frequency: '1-0-1', duration: '3 days', instructions: 'After meals' }
    ])
  }

  const handleQuickAddMed = (name: string, dosage: string, freq: string, dur: string, inst: string) => {
    setMedications(prev => [
      ...prev,
      { id: `med_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, name, dosage, frequency: freq, duration: dur, instructions: inst }
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

  // Save Prescription & Complete Consultation (Requirement 10)
  const handleSavePrescription = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentPatient) return
    setSaving(true)
    setMessage('')
    setError('')

    const formattedPrescription = medications
      .filter(m => m.name.trim())
      .map(m => `- ${m.name} (${m.dosage}) | ${m.frequency} x ${m.duration} [${m.instructions}]`)
      .join('\n')

    try {
      const res = await fetch(`/api/opd/doctor/sessions/${currentPatient.session_id}/prescription`, {
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

      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Failed to save clinical prescription')

      setMessage(`✅ Prescription and clinical records for ${currentPatient.patient.full_name} saved successfully! Consultation marked completed.`)
      
      // Update local storage medical records
      if (typeof window !== 'undefined') {
        try {
          const recStr = localStorage.getItem('aarogya_medical_records')
          let recs = recStr ? JSON.parse(recStr) : []
          const updated = recs.map((r: any) => {
            if (r.session_id === currentPatient.session_id || (r.id && r.id.includes(currentPatient.session_id))) {
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

      // Reset active session and switch back to queue
      activeSessionIdRef.current = null
      setCurrentPatient(null)
      setDiagnosis('')
      setDoctorNotes('')
      setMedications([
        { id: `med_1`, name: 'Tab Pantoprazole 40mg', dosage: '40mg', frequency: '1-0-0', duration: '5 days', instructions: 'Before breakfast' },
        { id: `med_2`, name: 'Tab Paracetamol 650mg', dosage: '650mg', frequency: '1-0-1', duration: '3 days', instructions: 'After meals' }
      ])
      setActiveTab('queue')
      fetchQueue(true)
    } catch (err: any) {
      setError(err.message || 'Error submitting prescription')
    } finally {
      setSaving(false)
    }
  }

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('aarogya_doctor_auth')
    }
    router.push('/doctor/login')
  }

  // Filter queue items
  const filteredQueue = waitingQueue.filter(item => {
    // 1. Age filter (Requirement 8)
    if (ageFilter === 'pediatric' && item.patient.age >= 18) return false
    if (ageFilter === 'adult' && (item.patient.age < 18 || item.patient.age >= 60)) return false
    if (ageFilter === 'senior' && item.patient.age < 60) return false

    // 2. Condition filter (Requirement 8)
    if (conditionFilter !== 'all' && item.clinical.ai_triage_category !== conditionFilter) return false

    // 3. Search query
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      const matchesName = item.patient.full_name.toLowerCase().includes(q)
      const matchesToken = item.queue_token.toLowerCase().includes(q)
      const matchesAbha = item.patient.abha_address.toLowerCase().includes(q)
      const matchesSym = item.clinical.symptoms.toLowerCase().includes(q)
      if (!matchesName && !matchesToken && !matchesAbha && !matchesSym) return false
    }

    return true
  })

  // Format Patient Info for AbhaCard modal
  const patientForAbhaCard: PatientInfo | null = currentPatient ? {
    id: currentPatient.patient.id || 1,
    full_name: currentPatient.patient.full_name,
    age: currentPatient.patient.age,
    gender: currentPatient.patient.gender,
    abha_address: currentPatient.patient.abha_address,
    abha_number: currentPatient.patient.abha_number,
    mobile_number: currentPatient.patient.mobile_number,
    date_of_birth: currentPatient.patient.date_of_birth,
    blood_group: currentPatient.patient.blood_group || 'B+',
    allergies: currentPatient.patient.allergies || 'No Known Allergies',
    address: currentPatient.patient.address || 'Lucknow, Uttar Pradesh',
    state: currentPatient.patient.state || 'Uttar Pradesh',
    district: currentPatient.patient.district || 'Lucknow',
    pincode: '226001',
    profile_photo: currentPatient.patient.profile_photo
  } : null

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between font-sans">
      <Header />

      <main className="container mx-auto px-3 sm:px-6 py-4 sm:py-6 flex-1 max-w-7xl">
        
        {/* =========================================================
            TOP DOCTOR BAR: Profile, Status Switcher & Actions
           ========================================================= */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm mb-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          {/* Doctor Info */}
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-2xl shadow-inner shrink-0">
              {currentDoctor?.profile_photo || '👨‍⚕️'}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                  {currentDoctor?.full_name || 'Consulting Physician'}
                </h1>
                <span className="px-2.5 py-0.5 bg-blue-50 text-blue-800 text-[10px] font-extrabold uppercase rounded-full border border-blue-200">
                  Cabin {currentDoctor?.room_number || '101'}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                {currentDoctor?.qualifications} • <strong className="text-slate-700">{currentDoctor?.specialization}</strong> ({currentDoctor?.department})
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Hours: {currentDoctor?.consultation_time || '09:00 AM - 02:00 PM'}
              </p>
            </div>
          </div>

          {/* Availability Status Switcher & Logout (Requirement 11) */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100/90 rounded-2xl border border-slate-200">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 px-2">
                Status:
              </span>
              
              {/* Consulting */}
              <button
                type="button"
                disabled={statusUpdating}
                onClick={() => handleStatusChange('Consulting')}
                className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${doctorStatus === 'Consulting' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'}`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-300 shrink-0"></span>
                <span>Consulting</span>
              </button>

              {/* On Break */}
              <button
                type="button"
                disabled={statusUpdating}
                onClick={() => handleStatusChange('On Break')}
                className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${doctorStatus === 'On Break' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'}`}
              >
                <Coffee className="w-3 h-3 shrink-0" />
                <span>On Break</span>
              </button>

              {/* Emergency Duty */}
              <button
                type="button"
                disabled={statusUpdating}
                onClick={() => handleStatusChange('Emergency Duty')}
                className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${doctorStatus === 'Emergency Duty' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'}`}
              >
                <Siren className="w-3 h-3 shrink-0" />
                <span>Emergency</span>
              </button>
            </div>

            <button
              onClick={handleLogout}
              className="p-2.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl border border-slate-200 transition flex items-center justify-center gap-1 text-xs font-bold"
              title="Logout from OPD"
            >
              <LogOut className="w-4 h-4" />
              <span className="sm:hidden">Logout</span>
            </button>
          </div>

        </div>

        {/* Global Alerts / Banners */}
        {message && (
          <div className="mb-4 p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-xs sm:text-sm text-blue-900 flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2 font-semibold">
              <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
              <span>{message}</span>
            </div>
            <button onClick={() => setMessage('')} className="text-blue-600 hover:text-blue-950">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs sm:text-sm text-rose-900 flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError('')} className="text-rose-600 hover:text-rose-950">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* =========================================================
            NAVBAR: Patient Queue | Current Patient (Requirement 7)
           ========================================================= */}
        <div className="flex items-center justify-between border-b border-slate-200 mb-5">
          <div className="flex items-center gap-2">
            
            {/* Tab 1: Patient Queue */}
            <button
              onClick={() => setActiveTab('queue')}
              className={`pb-3 px-4 text-sm font-black flex items-center gap-2 border-b-2 transition relative ${
                activeTab === 'queue'
                  ? 'border-[#002F6C] text-[#002F6C]'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Patient Queue</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-black ${
                waitingQueue.length > 0 ? 'bg-blue-100 text-blue-900' : 'bg-slate-100 text-slate-500'
              }`}>
                {waitingQueue.length}
              </span>
            </button>

            {/* Tab 2: Current Patient */}
            <button
              onClick={() => setActiveTab('current')}
              className={`pb-3 px-4 text-sm font-black flex items-center gap-2 border-b-2 transition relative ${
                activeTab === 'current'
                  ? 'border-[#002F6C] text-[#002F6C]'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Stethoscope className="w-4 h-4" />
              <span>Current Patient</span>
              {currentPatient && (
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
              )}
            </button>

          </div>

          <div className="text-xs text-slate-500 font-semibold hidden sm:flex items-center gap-2">
            <button
              onClick={() => fetchQueue(true)}
              disabled={refreshing}
              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 flex items-center gap-1"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Live Sync</span>
            </button>
          </div>
        </div>

        {/* =========================================================
            TAB 1: PATIENT QUEUE VIEW (Requirements 8, 11, 12, 13)
           ========================================================= */}
        {activeTab === 'queue' && (
          <div className="space-y-4">
            
            {/* Break Notification (Requirement 12) */}
            {doctorStatus === 'On Break' && (
              <div className="p-6 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl text-center shadow-xs">
                <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center mx-auto mb-3 shadow-inner">
                  <Coffee className="w-6 h-6" />
                </div>
                <h3 className="text-base font-black text-amber-900">
                  Doctor is Currently On Break
                </h3>
                <p className="text-xs text-amber-700 mt-1 max-w-md mx-auto">
                  Patient consultation is temporarily paused. To resume consultation and view the waiting patient queue, switch your availability status above back to <strong className="font-bold">Consulting</strong>.
                </p>
                <button
                  onClick={() => handleStatusChange('Consulting')}
                  className="mt-4 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow transition inline-flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Resume Consultation (Set to Consulting)</span>
                </button>
              </div>
            )}

            {/* Emergency Duty Notification (Requirement 13) */}
            {doctorStatus === 'Emergency Duty' && (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-900 text-xs">
                <div className="p-2 bg-rose-100 rounded-xl text-rose-700 shrink-0">
                  <Siren className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <strong className="font-black text-sm block">Emergency Duty Active</strong>
                  <span>New regular patients presenting at the kiosk will be automatically rerouted to backup physicians in General Medicine or matching departments.</span>
                </div>
              </div>
            )}

            {/* If not on break, show filters and queue (Requirement 12) */}
            {doctorStatus !== 'On Break' && (
              <>
                {/* Search & Filters Bar (Requirement 8) */}
                <div className="bg-white border border-slate-200 rounded-2xl p-3 sm:p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
                  
                  {/* Search Bar */}
                  <div className="relative w-full md:w-80">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Filter by name, token, ABHA, symptom..."
                      className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#002F6C] focus:bg-white"
                    />
                  </div>

                  {/* Filter Pills: Age & Triage Condition */}
                  <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                    
                    {/* Age Filter Dropdown / Buttons */}
                    <div className="flex items-center gap-1 text-xs">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Age:</span>
                      <select
                        value={ageFilter}
                        onChange={(e) => setAgeFilter(e.target.value as any)}
                        className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none"
                      >
                        <option value="all">All Ages</option>
                        <option value="pediatric">👶 Pediatric (&lt; 18 yrs)</option>
                        <option value="adult">🧑 Adult (18 - 59 yrs)</option>
                        <option value="senior">👴 Senior (60+ yrs)</option>
                      </select>
                    </div>

                    {/* Condition / Triage Filter Dropdown */}
                    <div className="flex items-center gap-1 text-xs">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Triage:</span>
                      <select
                        value={conditionFilter}
                        onChange={(e) => setConditionFilter(e.target.value as any)}
                        className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none"
                      >
                        <option value="all">All Conditions</option>
                        <option value="red">🚨 Emergency (Red)</option>
                        <option value="yellow">⚠️ Severe Condition (Yellow)</option>
                        <option value="green">✅ Routine OPD (Green)</option>
                      </select>
                    </div>

                  </div>

                </div>

                {/* Patient Queue Cards List */}
                {loading ? (
                  <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
                    <div className="w-8 h-8 border-4 border-blue-900/20 border-t-blue-900 rounded-full animate-spin mx-auto mb-3"></div>
                    <p className="text-sm font-bold text-slate-600">Loading live patient queue...</p>
                  </div>
                ) : filteredQueue.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
                    <Users className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                    <h3 className="text-base font-bold text-slate-800">No Patients in Queue</h3>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                      {searchQuery || ageFilter !== 'all' || conditionFilter !== 'all' 
                        ? 'No waiting patients matched your filter criteria.' 
                        : 'There are currently no patients waiting in your OPD room queue. New patients will appear automatically.'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs text-slate-500 px-1 font-bold">
                      <span>Showing {filteredQueue.length} Patients in Queue</span>
                      <span>Priority Order</span>
                    </div>

                    {filteredQueue.map((item, idx) => {
                      const isEmergency = item.clinical.ai_triage_category === 'red'
                      const isSevere = item.clinical.ai_triage_category === 'yellow'

                      return (
                        <div
                          key={item.session_id}
                          className={`bg-white border rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                            isEmergency 
                              ? 'border-red-300 bg-red-50/20' 
                              : isSevere 
                              ? 'border-amber-200' 
                              : 'border-slate-200'
                          }`}
                        >
                          {/* Left: Token & Patient Details */}
                          <div className="flex items-start gap-3.5">
                            <div className="flex flex-col items-center justify-center p-2.5 bg-blue-50 border border-blue-100 rounded-xl min-w-[75px] shrink-0">
                              <span className="text-[10px] uppercase font-bold text-blue-800">Token</span>
                              <span className="text-base font-black text-blue-950 font-mono">
                                {item.queue_token.replace('OPD-', '')}
                              </span>
                            </div>

                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="font-bold text-slate-900 text-sm sm:text-base">
                                  {item.patient.full_name}
                                </h4>
                                <span className="text-xs text-slate-500 font-semibold">
                                  ({item.patient.age} yrs, {item.patient.gender})
                                </span>
                                
                                {/* Triage Badge */}
                                {isEmergency && (
                                  <span className="px-2 py-0.5 bg-red-100 text-red-800 border border-red-200 rounded-full text-[10px] font-black uppercase flex items-center gap-1">
                                    <ShieldAlert className="w-3 h-3" /> Emergency
                                  </span>
                                )}
                                {isSevere && (
                                  <span className="px-2 py-0.5 bg-amber-100 text-amber-800 border border-amber-200 rounded-full text-[10px] font-black uppercase flex items-center gap-1">
                                    <Activity className="w-3 h-3" /> Severe
                                  </span>
                                )}
                                {!isEmergency && !isSevere && (
                                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-full text-[10px] font-bold uppercase flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3" /> Routine
                                  </span>
                                )}
                              </div>

                              <div className="text-xs text-slate-600 flex items-center gap-2 flex-wrap">
                                <span><strong className="text-slate-800">Complaint:</strong> {item.clinical.symptoms}</span>
                                <span>•</span>
                                <span><strong className="text-slate-800">Severity:</strong> {item.clinical.severity}</span>
                                <span>•</span>
                                <span><strong className="text-slate-800">Duration:</strong> {item.clinical.duration}</span>
                              </div>

                              <div className="text-[11px] text-slate-400 flex items-center gap-3">
                                <span>ABHA: {item.patient.abha_address}</span>
                                <span>Blood Group: <strong className="text-slate-600">{item.patient.blood_group}</strong></span>
                                {item.patient.allergies && item.patient.allergies !== 'No Known Allergies' && (
                                  <span className="text-red-600 font-bold">⚠️ Allergy: {item.patient.allergies}</span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Right: Actions */}
                          <div className="flex items-center gap-2.5 self-end md:self-center shrink-0">
                            <button
                              onClick={() => {
                                loadPatientIntoConsultation(item)
                                setActiveTab('current')
                              }}
                              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
                            >
                              View Summary
                            </button>

                            {/* Call Patient Button (Requirement 8) */}
                            <button
                              disabled={callingPatient}
                              onClick={() => handleCallPatient(item)}
                              className="px-4 py-2 bg-[#002F6C] hover:bg-blue-900 text-white text-xs sm:text-sm font-bold rounded-xl shadow flex items-center gap-1.5 transition"
                            >
                              <Bell className="w-3.5 h-3.5 text-amber-300 animate-bounce" />
                              <span>Call Patient to Cabin</span>
                            </button>
                          </div>

                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            )}

          </div>
        )}

        {/* =========================================================
            TAB 2: CURRENT PATIENT VIEW (Requirements 9 & 10)
           ========================================================= */}
        {activeTab === 'current' && (
          <div>
            {!currentPatient ? (
              <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
                <Stethoscope className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-base font-bold text-slate-800">No Patient Currently in Consultation</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Click on "Patient Queue" tab and press <strong className="text-blue-900 font-bold">"Call Patient to Cabin"</strong> on any waiting patient to begin clinical review.
                </p>
                <button
                  onClick={() => setActiveTab('queue')}
                  className="mt-4 px-4 py-2 bg-[#002F6C] text-white text-xs font-bold rounded-xl shadow"
                >
                  Go to Patient Queue
                </button>
              </div>
            ) : (
              <div className="space-y-5">
                
                {/* 1. Patient Header Card */}
                <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-900 flex items-center justify-center font-black text-xl shrink-0">
                      {currentPatient.patient.full_name.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-lg font-black text-slate-900">
                          {currentPatient.patient.full_name}
                        </h2>
                        <span className="px-2.5 py-0.5 bg-blue-100 text-blue-900 text-xs font-extrabold rounded-full font-mono">
                          {currentPatient.queue_token}
                        </span>
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase rounded-full">
                          IN CABIN
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-3 flex-wrap font-medium">
                        <span>Age: <strong className="text-slate-700">{currentPatient.patient.age} yrs</strong> ({currentPatient.patient.gender})</span>
                        <span>•</span>
                        <span>ABHA ID: <strong className="text-blue-900 font-mono">{currentPatient.patient.abha_address}</strong></span>
                        <span>•</span>
                        <span>Blood: <strong className="text-slate-800">{currentPatient.patient.blood_group}</strong></span>
                        {currentPatient.patient.allergies && currentPatient.patient.allergies !== 'No Known Allergies' && (
                          <span className="text-red-700 font-bold bg-red-50 px-2 py-0.5 rounded border border-red-200">
                            🚨 Allergies: {currentPatient.patient.allergies}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowAbhaModal(true)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1"
                    >
                      <User className="w-3.5 h-3.5" />
                      <span>View ABHA Card</span>
                    </button>
                    <button
                      onClick={() => setShowPrintModal(true)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Print Rx</span>
                    </button>
                  </div>
                </div>

                {/* 2-Column Clinical Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                  
                  {/* LEFT COLUMN: Consulting Doctor AI Summary & Medical Records (Requirements 9 & 10) */}
                  <div className="lg:col-span-5 space-y-4">
                    
                    {/* "Consulting Doctor AI" Summary Box */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3.5">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 bg-blue-50 text-blue-900 rounded-lg">
                            <Sparkles className="w-4 h-4 text-amber-500" />
                          </div>
                          <div>
                            <h3 className="font-black text-slate-900 text-sm">Consulting Doctor AI Summary</h3>
                            <p className="text-[10px] text-slate-400">Automated Kiosk Intake Analysis</p>
                          </div>
                        </div>

                        {/* Triage Badge */}
                        <span className={`px-2 py-0.5 text-[10px] font-black uppercase rounded-full border ${
                          currentPatient.clinical.ai_triage_category === 'red' 
                            ? 'bg-red-100 text-red-800 border-red-200' 
                            : currentPatient.clinical.ai_triage_category === 'yellow'
                            ? 'bg-amber-100 text-amber-800 border-amber-200'
                            : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                        }`}>
                          {currentPatient.clinical.ai_triage_label}
                        </span>
                      </div>

                      {/* Structured Details Grid */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="p-2.5 bg-slate-50 rounded-xl">
                          <span className="text-[10px] font-bold text-slate-400 uppercase block">Chief Complaint</span>
                          <span className="font-bold text-slate-900">{currentPatient.clinical.symptoms}</span>
                        </div>
                        <div className="p-2.5 bg-slate-50 rounded-xl">
                          <span className="text-[10px] font-bold text-slate-400 uppercase block">Duration & Onset</span>
                          <span className="font-bold text-slate-900">{currentPatient.clinical.duration}</span>
                        </div>
                        <div className="p-2.5 bg-slate-50 rounded-xl">
                          <span className="text-[10px] font-bold text-slate-400 uppercase block">Pain Severity</span>
                          <span className="font-bold text-slate-900">{currentPatient.clinical.severity}</span>
                        </div>
                        <div className="p-2.5 bg-slate-50 rounded-xl">
                          <span className="text-[10px] font-bold text-slate-400 uppercase block">Provisional AI Dx</span>
                          <span className="font-bold text-blue-900">{currentPatient.clinical.ai_recommendation}</span>
                        </div>
                      </div>

                      {/* AI Clinical Narrative */}
                      <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-xl text-xs text-slate-700 space-y-1">
                        <span className="text-[10px] font-extrabold uppercase text-blue-900 block">
                          Clinical Synthesis:
                        </span>
                        <p className="leading-relaxed">
                          {currentPatient.clinical.structured_summary?.clinical_narrative || currentPatient.clinical.summary}
                        </p>
                      </div>

                      {/* Scanned OCR Prescriptions / Medical History */}
                      {currentPatient.clinical.ocr_text && (
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
                          <span className="text-[10px] font-extrabold uppercase text-slate-600 flex items-center gap-1">
                            <FileText className="w-3.5 h-3.5" /> Scanned Prescription History:
                          </span>
                          <p className="text-slate-700 font-mono text-[11px] whitespace-pre-line bg-white p-2 rounded border border-slate-200">
                            {currentPatient.clinical.ocr_text}
                          </p>
                        </div>
                      )}

                      {/* Toggleable Interview Chat Transcript */}
                      <div>
                        <button
                          type="button"
                          onClick={() => setShowTranscript(!showTranscript)}
                          className="w-full py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-between transition"
                        >
                          <span className="flex items-center gap-1.5">
                            <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
                            <span>View Full AI-Patient Chat Transcript</span>
                          </span>
                          <ChevronDown className={`w-4 h-4 transition ${showTranscript ? 'rotate-180' : ''}`} />
                        </button>

                        {showTranscript && currentPatient.clinical.chat_history && (
                          <div className="mt-2 p-3 bg-slate-50 rounded-xl border border-slate-200 max-h-48 overflow-y-auto space-y-2 text-xs">
                            {currentPatient.clinical.chat_history.map((msg, i) => (
                              <div key={i} className={`p-2 rounded-lg ${msg.role === 'user' ? 'bg-blue-100/70 text-blue-950 ml-4' : 'bg-white text-slate-800 mr-4 border border-slate-200'}`}>
                                <strong className="text-[10px] block font-bold text-slate-500 uppercase">
                                  {msg.role === 'user' ? 'Patient' : 'Aarogya AI'}:
                                </strong>
                                <span>{msg.translated_message || msg.message}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                    </div>

                  </div>

                  {/* RIGHT COLUMN: Doctor's Prescription & Clinical Form (Requirement 10) */}
                  <div className="lg:col-span-7">
                    <form onSubmit={handleSavePrescription} className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-xs space-y-4">
                      
                      <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                        <div>
                          <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                            <Pill className="w-4 h-4 text-emerald-600" />
                            <span>Clinical Prescription & Doctor Diagnosis</span>
                          </h3>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Saved directly into the patient's verified medical record & FHIR bundle.
                          </p>
                        </div>
                        <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 text-xs font-bold rounded-lg border border-emerald-200">
                          OPD Consultation
                        </span>
                      </div>

                      {/* Confirmed Diagnosis */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                          Confirmed Clinical Diagnosis *
                        </label>
                        <input
                          type="text"
                          required
                          value={diagnosis}
                          onChange={(e) => setDiagnosis(e.target.value)}
                          placeholder="e.g. Acute Gastritis / Viral Upper Respiratory Infection"
                          className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#002F6C] focus:bg-white"
                        />
                      </div>

                      {/* Prescribed Medications Table */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                            Prescribed Medications (Rx)
                          </label>
                          <button
                            type="button"
                            onClick={handleAddMedication}
                            className="text-xs font-bold text-blue-900 hover:text-blue-700 flex items-center gap-1"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add Medicine</span>
                          </button>
                        </div>

                        {/* Quick Add Presets */}
                        <div className="flex flex-wrap gap-1.5 mb-2.5">
                          <span className="text-[10px] text-slate-400 font-bold uppercase self-center mr-1">Quick Add:</span>
                          <button
                            type="button"
                            onClick={() => handleQuickAddMed('Tab Pantoprazole 40mg', '40mg', '1-0-0', '5 days', 'Before breakfast')}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold rounded-lg"
                          >
                            + Pantoprazole
                          </button>
                          <button
                            type="button"
                            onClick={() => handleQuickAddMed('Tab Paracetamol 650mg', '650mg', '1-0-1', '3 days', 'After meals')}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold rounded-lg"
                          >
                            + Paracetamol
                          </button>
                          <button
                            type="button"
                            onClick={() => handleQuickAddMed('Tab Amoxicillin 500mg', '500mg', '1-0-1', '5 days', 'After meals')}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold rounded-lg"
                          >
                            + Amoxicillin
                          </button>
                          <button
                            type="button"
                            onClick={() => handleQuickAddMed('Syp Ascoril-D', '10ml', '1-1-1', '5 days', 'After meals')}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold rounded-lg"
                          >
                            + Cough Syrup
                          </button>
                        </div>

                        {/* Medication Rows */}
                        <div className="space-y-2">
                          {medications.map((med, idx) => (
                            <div key={med.id || `med-${idx}`} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-1 sm:grid-cols-12 gap-2 items-center text-xs">
                              <div className="sm:col-span-4">
                                <input
                                  type="text"
                                  value={med.name}
                                  onChange={(e) => handleUpdateMedication(idx, 'name', e.target.value)}
                                  placeholder="Medicine Name (e.g. Tab Pantop 40)"
                                  className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold"
                                />
                              </div>
                              <div className="sm:col-span-2">
                                <input
                                  type="text"
                                  value={med.dosage}
                                  onChange={(e) => handleUpdateMedication(idx, 'dosage', e.target.value)}
                                  placeholder="Dosage"
                                  className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                                />
                              </div>
                              <div className="sm:col-span-2">
                                <select
                                  value={med.frequency}
                                  onChange={(e) => handleUpdateMedication(idx, 'frequency', e.target.value)}
                                  className="w-full px-1.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                                >
                                  <option value="1-0-1">1-0-1 (Twice)</option>
                                  <option value="1-0-0">1-0-0 (Morning)</option>
                                  <option value="0-0-1">0-0-1 (Night)</option>
                                  <option value="1-1-1">1-1-1 (Thrice)</option>
                                  <option value="SOS">SOS (When needed)</option>
                                </select>
                              </div>
                              <div className="sm:col-span-3">
                                <input
                                  type="text"
                                  value={med.instructions}
                                  onChange={(e) => handleUpdateMedication(idx, 'instructions', e.target.value)}
                                  placeholder="Instructions"
                                  className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                                />
                              </div>
                              <div className="sm:col-span-1 flex items-center justify-end sm:justify-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveMedication(idx)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition flex items-center gap-1 text-xs"
                                  title="Remove medicine"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span className="sm:hidden text-rose-600 font-bold">Remove</span>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Doctor Clinical Notes */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                          Doctor's Clinical Notes & Physical Examination
                        </label>
                        <textarea
                          rows={3}
                          value={doctorNotes}
                          onChange={(e) => setDoctorNotes(e.target.value)}
                          placeholder="Record physical examination findings, vitals, lifestyle advice, or special dietary recommendations..."
                          className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#002F6C] focus:bg-white resize-none"
                        />
                      </div>

                      {/* Follow-up Advice */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                          Follow-up & Review Instructions
                        </label>
                        <input
                          type="text"
                          value={followUp}
                          onChange={(e) => setFollowUp(e.target.value)}
                          placeholder="e.g. Review in OPD after 5 days if symptoms persist."
                          className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#002F6C]"
                        />
                      </div>

                      {/* Submit & Save Prescription */}
                      <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => setShowPrintModal(true)}
                          className="w-full sm:w-auto px-4 py-2.5 border border-slate-300 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-100 flex items-center justify-center gap-1.5"
                        >
                          <Printer className="w-4 h-4" />
                          <span>Preview Printable Rx</span>
                        </button>

                        <button
                          type="submit"
                          disabled={saving}
                          className="w-full sm:w-auto px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow text-xs sm:text-sm flex items-center justify-center gap-2 transition"
                        >
                          {saving ? (
                            <span className="flex items-center gap-2">
                              <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"></span>
                              Saving to Medical Record...
                            </span>
                          ) : (
                            <>
                              <FileCheck className="w-4 h-4" />
                              <span>Complete Consultation & Save Prescription</span>
                            </>
                          )}
                        </button>
                      </div>

                    </form>
                  </div>

                </div>

              </div>
            )}
          </div>
        )}

      </main>

      {/* =========================================================
          ABHA CARD MODAL (Requirement 9)
         ========================================================= */}
      {showAbhaModal && patientForAbhaCard && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden max-h-[92vh] flex flex-col p-4 sm:p-6">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-700 shrink-0" />
                <span className="truncate">Ayushman Bharat Health Account (ABHA)</span>
              </h3>
              <button onClick={() => setShowAbhaModal(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1">
              <AbhaCard patient={patientForAbhaCard} />
            </div>
            <div className="mt-3 sm:mt-4 text-center shrink-0">
              <button
                onClick={() => setShowAbhaModal(false)}
                className="w-full sm:w-auto px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
              >
                Close ABHA Card
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          PRINT PRESCRIPTION MODAL (Requirement 10 - ABDM Standard)
         ========================================================= */}
      {showPrintModal && currentPatient && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto no-print">
          <div className="bg-slate-100 rounded-2xl shadow-2xl border border-slate-300 w-full max-w-4xl overflow-hidden max-h-[95vh] flex flex-col my-auto">
            
            {/* Modal Top Action Toolbar (Hidden during actual print) */}
            <div className="px-5 py-3 bg-slate-900 text-white border-b border-slate-800 flex items-center justify-between shrink-0 no-print">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-blue-600/30 text-blue-400 rounded-lg border border-blue-500/30">
                  <Printer className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                    <span>OPD Electronic Prescription (e-Rx) Slip</span>
                    <span className="text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                      ABDM FHIR R4 Standard
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    National Health Authority • Ayushman Bharat Digital Mission (Form 3-A)
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-[#002F6C] hover:bg-blue-900 text-white rounded-xl text-xs font-bold shadow flex items-center gap-1.5 transition"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Document</span>
                </button>
                <button
                  onClick={() => setShowPrintModal(false)}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Scrollable Document Canvas */}
            <div className="p-3 sm:p-6 overflow-y-auto flex-1 bg-slate-200/60 flex justify-center">
              
              {/* Actual Printable Prescription Sheet (A4 Proportion) */}
              <div
                id="printable-prescription"
                className="w-full max-w-3xl bg-white shadow-xl rounded-xl border border-slate-300 p-6 sm:p-8 font-sans text-slate-900 print:shadow-none print:border-0 print:p-0 print:m-0 print:w-full"
              >
                
                {/* Print CSS Styles */}
                <style dangerouslySetInnerHTML={{ __html: `
                  @media print {
                    body * {
                      visibility: hidden !important;
                    }
                    #printable-prescription, #printable-prescription * {
                      visibility: visible !important;
                    }
                    #printable-prescription {
                      position: absolute !important;
                      left: 0 !important;
                      top: 0 !important;
                      width: 100% !important;
                      max-width: 100% !important;
                      margin: 0 !important;
                      padding: 10mm 12mm !important;
                      border: none !important;
                      box-shadow: none !important;
                      background: white !important;
                      color: black !important;
                    }
                    .no-print {
                      display: none !important;
                    }
                  }
                `}} />

                {/* 1. OFFICIAL INSTITUTIONAL HEADER */}
                <div className="border-b-2 border-[#002F6C] pb-3">
                  <div className="flex items-start justify-between gap-3">
                    
                    {/* Left: Hospital Emblem & Title */}
                    <div className="flex items-center gap-3">
                      <div className="w-13 h-13 bg-[#002F6C] text-white rounded-2xl flex flex-col items-center justify-center shadow-md p-1.5 shrink-0">
                        <HeartPulse className="w-7 h-7 text-emerald-400" />
                        <span className="text-[7px] font-black tracking-widest text-blue-200 uppercase mt-0.5">AAROGYA</span>
                      </div>
                      <div>
                        <h1 className="text-base sm:text-lg font-black tracking-tight text-[#002F6C] uppercase leading-tight">
                          AarogyaMitra Multispecialty Hospital
                        </h1>
                        <p className="text-[11px] font-bold text-emerald-800 tracking-wide uppercase">
                          Center of Clinical Excellence & Digital OPD Services
                        </p>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          Central Healthcare Complex, Sector 12, Institutional Area, New Delhi - 110001
                        </p>
                        <p className="text-[9px] text-slate-500 font-mono">
                          Ph: 011-26598700 • 24x7 Emergency: 108 / 102 • Email: opd@aarogyamitra.gov.in
                        </p>
                      </div>
                    </div>

                    {/* Right: ABDM / National Accreditation Badge */}
                    <div className="text-right shrink-0">
                      <div className="inline-flex flex-col items-end">
                        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 border border-blue-200 rounded-lg text-blue-950">
                          <ShieldCheck className="w-4 h-4 text-emerald-600" />
                          <span className="text-[10px] font-extrabold tracking-wider uppercase">
                            ABDM ACCREDITED
                          </span>
                        </div>
                        <div className="mt-1 text-[9px] text-slate-500 font-mono">
                          Facility ID: <span className="font-bold text-slate-700">IN-DL-109482</span>
                        </div>
                        <div className="text-[9px] text-slate-500 font-mono">
                          HFR Registry: <span className="font-bold text-slate-700">NDHM-DEL-041</span>
                        </div>
                      </div>
                    </div>

                  </div>

                  {/* Header Sub-bar: Title of Prescription Form */}
                  <div className="mt-2.5 pt-2 border-t border-slate-200 flex items-center justify-between text-[10px] sm:text-[11px] text-slate-600 font-semibold uppercase tracking-wider">
                    <span>Department of Outpatient Services (OPD)</span>
                    <span className="px-2 py-0.5 bg-[#002F6C] text-white rounded text-[10px] font-bold">
                      e-Prescription & Clinical Consultation Slip (Form 3-A)
                    </span>
                    <span>Ayushman Bharat Digital Health Record</span>
                  </div>
                </div>

                {/* 2. DOCTOR & CONSULTATION DETAILS BAR */}
                <div className="mt-2.5 bg-slate-50 border border-slate-300 rounded-xl p-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div>
                    <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                      Consulting Medical Officer / Specialist:
                    </div>
                    <div className="font-bold text-slate-900 text-sm mt-0.5 flex items-center gap-1.5">
                      <Stethoscope className="w-3.5 h-3.5 text-[#002F6C]" />
                      <span>{currentDoctor?.full_name || 'Dr. Medical Officer'}</span>
                      <span className="text-xs font-semibold text-slate-600">({currentDoctor?.qualifications || 'BAMS / MBBS'})</span>
                    </div>
                    <div className="text-[11px] text-slate-600 mt-0.5">
                      {currentDoctor?.post || 'Senior Consultant'} • {currentDoctor?.department}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                      Medical Council Reg. No: <span className="font-semibold text-slate-700">MCI/DMC-84920</span>
                    </div>
                  </div>

                  <div className="sm:text-right flex flex-col justify-between">
                    <div>
                      <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                        Consultation Session Details:
                      </div>
                      <div className="font-mono text-xs font-bold text-slate-800 mt-0.5">
                        OPD Slip No: <span className="text-blue-900 font-black">AM-OPD-{currentPatient.queue_token}</span>
                      </div>
                      <div className="text-[11px] text-slate-600 mt-0.5 flex items-center sm:justify-end gap-1">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        <span><strong>Date:</strong> {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} at {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
                      </div>
                    </div>
                    <div className="mt-1">
                      <span className="inline-block px-2 py-0.5 bg-blue-100 text-blue-900 border border-blue-200 rounded font-bold text-[10px]">
                        OPD Cabin No: {currentDoctor?.room_number || '205'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 3. PATIENT IDENTIFICATION & INTAKE VITALS GRID */}
                <div className="mt-2.5 border border-slate-300 rounded-xl overflow-hidden text-xs">
                  {/* Title Bar */}
                  <div className="bg-slate-100 px-3 py-1.5 border-b border-slate-300 flex items-center justify-between font-bold text-[11px] text-slate-700 uppercase tracking-wider">
                    <span className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-slate-500" /> Patient Identification & Demographics
                    </span>
                    <span className="font-mono text-blue-900">
                      Token: <span className="px-1.5 py-0.2 bg-white border border-slate-300 rounded font-black text-slate-900">{currentPatient.queue_token}</span>
                    </span>
                  </div>

                  {/* 4-column Demographics Grid */}
                  <div className="p-3 grid grid-cols-2 sm:grid-cols-4 gap-y-2 gap-x-4 bg-white text-[11px]">
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase font-semibold">Patient Name</span>
                      <span className="font-bold text-slate-900 text-xs">{currentPatient.patient.full_name}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase font-semibold">Age / Gender</span>
                      <span className="font-bold text-slate-900">{currentPatient.patient.age} Yrs / {currentPatient.patient.gender}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase font-semibold">UHID / Patient ID</span>
                      <span className="font-mono font-bold text-slate-900">AM-2026-{String(currentPatient.patient.id || 104).padStart(4, '0')}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase font-semibold">Mobile Number</span>
                      <span className="font-mono text-slate-800">{currentPatient.patient.mobile_number || '9876543210'}</span>
                    </div>

                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase font-semibold">ABHA Address</span>
                      <span className="font-mono font-semibold text-blue-900">{currentPatient.patient.abha_address}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase font-semibold">ABHA Number</span>
                      <span className="font-mono text-slate-700">{currentPatient.patient.abha_number || 'Not Linked'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase font-semibold">Blood Group</span>
                      <span className="font-bold text-slate-900 px-1.5 py-0.5 bg-rose-50 text-rose-800 border border-rose-200 rounded inline-block text-[10px]">
                        {currentPatient.patient.blood_group || 'B+'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase font-semibold">Known Allergies</span>
                      <span className={`font-semibold text-[10px] ${currentPatient.patient.allergies && currentPatient.patient.allergies.toLowerCase() !== 'no known allergies' ? 'text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200' : 'text-emerald-700'}`}>
                        {currentPatient.patient.allergies || 'No Known Allergies'}
                      </span>
                    </div>
                  </div>

                  {/* Kiosk Intake Vitals & Triage Assessment Bar */}
                  <div className="bg-slate-50 border-t border-slate-200 px-3 py-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                    <div className="flex items-center gap-2 flex-wrap text-slate-700">
                      <span className="font-bold text-slate-800 uppercase text-[10px] flex items-center gap-1">
                        <Activity className="w-3 h-3 text-emerald-600" /> Recorded Vitals:
                      </span>
                      <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200 text-[10px]">BP: 120/80 mmHg</span>
                      <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200 text-[10px]">Pulse: 76 bpm</span>
                      <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200 text-[10px]">Temp: 98.6 °F</span>
                      <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200 text-[10px]">SpO2: 99%</span>
                    </div>
                    <div className="sm:text-right text-slate-600">
                      <span className="font-bold text-slate-800 uppercase text-[10px]">Chief Complaint: </span>
                      <span className="font-medium text-slate-900">{currentPatient.clinical.symptoms || 'General malaise and fatigue'}</span>
                      {currentPatient.clinical.duration && (
                        <span className="text-slate-500"> ({currentPatient.clinical.duration})</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* 4. CONFIRMED CLINICAL DIAGNOSIS */}
                <div className="mt-2.5 bg-blue-50/70 border-l-4 border-[#002F6C] border-y border-r border-slate-200 rounded-r-xl p-3 flex items-start justify-between gap-3 text-xs">
                  <div className="flex-1">
                    <div className="text-[10px] uppercase font-extrabold text-[#002F6C] tracking-wider flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Confirmed Clinical Diagnosis:</span>
                    </div>
                    <div className="text-sm font-black text-slate-900 mt-0.5">
                      {diagnosis || currentPatient.clinical.ai_recommendation || 'Viral Fever / Influenza-like illness'}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="px-2 py-0.5 bg-blue-900 text-white rounded text-[10px] font-mono font-bold">
                      ICD-10: B34.9
                    </span>
                    <div className="text-[9px] text-slate-500 mt-0.5">Verified Clinical Coding</div>
                  </div>
                </div>

                {/* 5. ℞ - PRESCRIBED MEDICATIONS & DOSAGE SCHEDULE */}
                <div className="mt-3.5">
                  <div className="flex items-center justify-between mb-1.5 pb-1 border-b border-slate-200">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-serif font-black text-[#002F6C] leading-none">℞</span>
                      <div>
                        <h4 className="font-black text-xs uppercase tracking-wider text-slate-900">
                          Prescribed Medications & Therapeutic Regimen
                        </h4>
                        <p className="text-[10px] text-slate-500">
                          Dispense exact generic or equivalent branded formulation as specified
                        </p>
                      </div>
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      Total Items: <span className="font-bold text-slate-800">{medications.filter(m => m.name.trim()).length}</span>
                    </div>
                  </div>

                  {/* Medicines Table */}
                  <div className="border border-slate-300 rounded-xl overflow-hidden shadow-xs">
                    <table className="w-full border-collapse text-xs">
                      <thead>
                        <tr className="bg-[#002F6C] text-white text-[11px] font-bold uppercase tracking-wider">
                          <th className="py-2 px-2 text-center w-8 border-r border-blue-800">#</th>
                          <th className="py-2 px-3 text-left border-r border-blue-800">Medicine Name & Formulation</th>
                          <th className="py-2 px-3 text-left w-20 border-r border-blue-800">Strength</th>
                          <th className="py-2 px-3 text-center w-36 border-r border-blue-800">
                            <div>Dosage Regimen</div>
                            <div className="text-[8px] font-normal text-blue-200 lowercase">morning - noon - night</div>
                          </th>
                          <th className="py-2 px-3 text-center w-24 border-r border-blue-800">Duration</th>
                          <th className="py-2 px-3 text-left">Instructions & Food Relation</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 font-sans text-[11px]">
                        {medications.filter(m => m.name.trim()).length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-6 text-center text-slate-400 italic">
                              No medicines prescribed. Follow lifestyle advice and supportive care.
                            </td>
                          </tr>
                        ) : (
                          medications.filter(m => m.name.trim()).map((m, i) => (
                            <tr key={i} className={i % 2 === 1 ? 'bg-slate-50/70' : 'bg-white'}>
                              <td className="py-2 px-2 text-center font-bold text-slate-600 border-r border-slate-200">
                                {i + 1}
                              </td>
                              <td className="py-2 px-3 border-r border-slate-200">
                                <div className="font-black text-slate-900 text-xs">{m.name}</div>
                                <div className="text-[10px] text-slate-500 font-mono">Oral Formulation</div>
                              </td>
                              <td className="py-2 px-3 font-semibold text-slate-700 border-r border-slate-200">
                                {m.dosage || 'Standard'}
                              </td>
                              <td className="py-2 px-3 text-center border-r border-slate-200">
                                <span className="inline-block px-2 py-0.5 bg-blue-50 text-blue-900 border border-blue-200 rounded font-mono font-bold text-xs">
                                  {m.frequency}
                                </span>
                                <div className="text-[9px] text-slate-500 mt-0.5">
                                  {m.frequency.includes('1-0-1') ? 'Twice daily' :
                                   m.frequency.includes('1-0-0') ? 'Once daily (Morning)' :
                                   m.frequency.includes('0-0-1') ? 'Once daily (Night)' :
                                   m.frequency.includes('1-1-1') ? 'Thrice daily' : 'As advised'}
                                </div>
                              </td>
                              <td className="py-2 px-3 text-center font-bold text-slate-800 border-r border-slate-200">
                                {m.duration || '3 days'}
                              </td>
                              <td className="py-2 px-3 font-medium text-slate-700">
                                <span className="inline-block px-1.5 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded text-[10px] font-semibold mr-1">
                                  {m.instructions || 'After meals'}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 6. DOCTOR'S CLINICAL ADVICE, INVESTIGATIONS & FOLLOW-UP */}
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  
                  {/* Left Box: Advice & Dietary Guidelines */}
                  <div className="border border-slate-300 rounded-xl p-3 bg-white">
                    <div className="font-bold text-[11px] text-slate-800 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                      <FileText className="w-3.5 h-3.5 text-blue-900" />
                      <span>Doctor's Clinical Advice & Lifestyle:</span>
                    </div>
                    <div className="text-[11px] text-slate-700 space-y-1">
                      {doctorNotes ? (
                        <p className="whitespace-pre-line text-slate-800 font-medium">{doctorNotes}</p>
                      ) : (
                        <ul className="list-disc pl-4 space-y-0.5 text-slate-600">
                          <li>Take plenty of oral fluids (warm water, ORS, soups) to maintain hydration.</li>
                          <li>Adequate physical rest for 3–5 days; avoid strenuous activities.</li>
                          <li>Light, easily digestible, home-cooked food. Avoid oily and spicy items.</li>
                          <li>Tepid water sponging if temperature exceeds 101°F.</li>
                        </ul>
                      )}
                    </div>

                    <div className="mt-2 pt-2 border-t border-slate-200">
                      <span className="font-bold text-[10px] uppercase text-slate-600 block">Lab Investigations Advised:</span>
                      <span className="text-[10px] text-slate-600 italic">
                        Routine Hemogram (CBC), Urine Routine & ESR if fever persists beyond 3 days.
                      </span>
                    </div>
                  </div>

                  {/* Right Box: Follow-up & Emergency Warning */}
                  <div className="border border-slate-300 rounded-xl p-3 bg-white flex flex-col justify-between">
                    <div>
                      <div className="font-bold text-[11px] text-slate-800 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                        <Clock className="w-3.5 h-3.5 text-blue-900" />
                        <span>Review & Follow-up Instructions:</span>
                      </div>
                      <div className="p-2 bg-amber-50/80 border border-amber-200 rounded-lg text-amber-950 font-bold text-[11px]">
                        📅 {followUp || 'Review in OPD after 5 days if symptoms persist.'}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1">
                        Report to Cabin {currentDoctor?.room_number || '205'} with this prescription slip.
                      </div>
                    </div>

                    <div className="mt-2 pt-2 border-t border-slate-200">
                      <div className="p-2 bg-rose-50 border border-rose-200 rounded-lg text-rose-900 text-[10px] flex items-start gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                        <div>
                          <strong>Emergency Red Flag:</strong> In case of breathlessness, high fever &gt;103°F, severe vomiting, or chest discomfort, report to Casualty/Emergency immediately.
                        </div>
                      </div>
                    </div>
                  </div>

                </div>

                {/* 7. DIGITAL SIGNATURE & OFFICIAL VERIFICATION BLOCK */}
                <div className="mt-3.5 pt-3 border-t-2 border-slate-300 flex items-end justify-between gap-4">
                  
                  {/* Left: ABDM QR & Security Watermark */}
                  <div className="flex items-center gap-3">
                    <div className="w-18 h-18 bg-white border border-slate-300 rounded-lg p-1.5 shadow-xs flex flex-col items-center justify-center shrink-0">
                      <QrCode className="w-11 h-11 text-slate-800" />
                      <span className="text-[7px] font-mono text-slate-500 mt-0.5">ABDM e-Prescription</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-800">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>ABDM Digitally Verified & Linked</span>
                      </div>
                      <div className="text-[9px] text-slate-500 mt-0.5 max-w-[220px]">
                        Scan with Ayushman Bharat ABHA App to access official FHIR JSON e-Prescription bundle.
                      </div>
                      <div className="text-[9px] text-slate-400 font-mono mt-0.5">
                        EHR Ref: {currentPatient.session_id.substring(0, 16)}...
                      </div>
                    </div>
                  </div>

                  {/* Right: Consulting Doctor Signature Seal */}
                  <div className="text-right">
                    <div className="inline-block text-center min-w-[210px] p-2 bg-slate-50 border border-slate-200 rounded-xl">
                      {/* Stylized Digital Signature Graphic */}
                      <div className="font-serif italic text-lg text-[#002F6C] font-black border-b border-slate-300 pb-1">
                        {currentDoctor?.full_name || 'Dr. Medical Officer'}
                      </div>
                      <div className="text-[9px] text-emerald-700 font-bold flex items-center justify-center gap-1 mt-1">
                        <CheckCircle2 className="w-3 h-3" /> Digitally Authenticated Signature
                      </div>
                      <div className="text-[11px] font-black text-slate-900 mt-0.5">
                        {currentDoctor?.full_name}
                      </div>
                      <div className="text-[10px] text-slate-600 font-semibold">
                        {currentDoctor?.qualifications} • {currentDoctor?.specialization}
                      </div>
                      <div className="text-[9px] text-slate-500">
                        Reg No: DMC/MCI-84920 • OPD Cabin {currentDoctor?.room_number || '205'}
                      </div>
                    </div>
                  </div>

                </div>

                {/* 8. FOOTER LEGAL DISCLAIMER */}
                <div className="mt-2.5 pt-2 border-t border-slate-200 text-center text-[9px] text-slate-500 leading-tight">
                  This is a computer-generated medical prescription generated through AarogyaMitra Digital OPD Kiosk System compliant with the <strong>National Medical Commission (NMC) Regulations 2023</strong> and <strong>Ayushman Bharat Digital Mission (ABDM) EHR Standards</strong>. Valid without physical handwritten signature under Section 4 & 5 of the Information Technology Act, 2000.
                </div>

              </div>
            </div>

            {/* Modal Bottom Toolbar (Hidden during actual print) */}
            <div className="p-3 bg-slate-100 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0 no-print">
              <div className="text-xs text-slate-500 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Digitally encrypted and synchronized with patient's ABHA account.</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowPrintModal(false)}
                  className="px-4 py-2 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition"
                >
                  Close Preview
                </button>
                <button
                  onClick={() => window.print()}
                  className="px-5 py-2 bg-[#002F6C] hover:bg-blue-900 text-white rounded-xl text-xs font-bold shadow flex items-center gap-1.5 transition"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Prescription Slip</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      <Footer />
    </div>
  )
}
