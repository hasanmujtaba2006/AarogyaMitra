'use client'

import React, { useState, useEffect } from 'react'
import { 
  Stethoscope, Users, User, Clock, FileText, Search, PlusCircle, 
  CheckCircle, AlertCircle, RefreshCw, LogOut, HeartPulse, Send,
  ChevronRight, Calendar, Activity, CheckCircle2, ShieldAlert
} from 'lucide-react'
import Header from '@/components/Header'
import Footer from '@/components/Footer'

interface SessionInfo {
  id: string;
  patient_name: string;
  abha_id: string;
  language: string;
  status: string;
  created_at: string;
  
  // Triage details
  symptoms: string;
  duration: string;
  severity: string;
  vital_signs: string;
  
  // AI recommendations
  ai_triage_category: string;
  ai_recommendation: string;
  session_summary: string;
}

export default function DoctorDashboard() {
  const [sessions, setSessions] = useState<SessionInfo[]>([])
  const [selectedSession, setSelectedSession] = useState<SessionInfo | null>(null)
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

  const handleSelectSession = (session: SessionInfo) => {
    setSelectedSession(session)
    setDoctorNotes('')
    setPrescription('')
    setMessage('')
    setMobileTab('consultation') // Switch to consultation tab on mobile when patient is selected
  }

  const handleSavePrescription = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedSession) return
    
    setSaving(true)
    setMessage('')
    setError('')
    
    try {
      const response = await fetch(`/api/chat/doctor/sessions/${selectedSession.id}/prescription`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doctor_notes: doctorNotes,
          doctor_prescription: prescription
        })
      })
      
      if (!response.ok) throw new Error('Failed to save prescription')
      
      setMessage('Prescription and notes saved successfully. FHIR care context linked.')
      fetchSessions(true)
      
      setSelectedSession({
        ...selectedSession,
        status: 'completed'
      })
    } catch (err: any) {
      setError(err.message || 'Failed to submit data')
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
      
      <main className="container mx-auto px-4 py-8 flex-1 max-w-7xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 text-center sm:text-left">
          <div className="flex items-center gap-3 justify-center sm:justify-start">
            <div className="p-2 bg-[#002F6C] text-white rounded-xl shadow-md">
              <Stethoscope className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-800">OPD Clinical Dashboard</h1>
              <p className="text-xs text-slate-500">AarogyaMitra Connected Practitioner Interface</p>
            </div>
          </div>
          <button
            onClick={() => {
              setIsRefreshing(true)
              fetchSessions()
            }}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 rounded-xl text-sm font-semibold text-slate-700 transition-colors shadow-sm w-fit mx-auto sm:mx-0"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh Queue
          </button>
        </div>

        {error && !selectedSession && (
          <div className="mb-6 p-4 bg-red-50 text-red-800 border border-red-200 rounded-2xl flex items-start gap-3">
            <AlertCircle className="w-6 h-6 shrink-0 text-red-600" />
            <div>
              <h4 className="font-bold text-sm">Dashboard Connection Error</h4>
              <p className="text-xs text-red-700/90 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Mobile Responsive Tabs */}
        <div className="flex lg:hidden mb-6 border border-slate-200 bg-white rounded-xl p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setMobileTab('queue')}
            className={`flex-1 py-3 text-center font-bold text-sm rounded-lg transition-all flex items-center justify-center gap-2 ${
              mobileTab === 'queue'
                ? 'bg-blue-50 text-[#002F6C] shadow-inner'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Patient Queue ({sessions.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setMobileTab('consultation')}
            className={`flex-1 py-3 text-center font-bold text-sm rounded-lg transition-all flex items-center justify-center gap-2 ${
              mobileTab === 'consultation'
                ? 'bg-blue-50 text-[#002F6C] shadow-inner'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Consultation {selectedSession ? `(${selectedSession.patient_name.split(' ')[0]})` : ''}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch min-h-[600px]">
          {/* Left panel: Sessions list queue */}
          <div className={`lg:col-span-4 bg-white rounded-3xl border border-slate-100 shadow-sm flex-col overflow-hidden ${
            mobileTab === 'queue' ? 'flex' : 'hidden lg:flex'
          }`}>
            <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-slate-500" />
                <h3 className="font-extrabold text-slate-800 text-base">Patient Queue</h3>
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
                sessions.map((session) => (
                  <button
                    key={session.id}
                    onClick={() => handleSelectSession(session)}
                    className={`w-full p-4 text-left transition-all hover:bg-slate-50/60 flex items-center justify-between gap-4 ${
                      selectedSession?.id === session.id ? 'bg-slate-50 border-l-4 border-l-[#002F6C]' : ''
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`w-2.5 h-2.5 rounded-full ${
                          session.status === 'completed' ? 'bg-slate-300' : 'bg-emerald-500 animate-pulse'
                        }`} />
                        <h4 className="font-bold text-slate-800 text-sm truncate">{session.patient_name}</h4>
                      </div>
                      <p className="text-xs text-slate-400 font-mono mb-2 truncate">ID: {session.abha_id}</p>
                      {getTriageBadge(session.ai_triage_category)}
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-300" />
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Right panel: Active session details and clinical entry */}
          <div className={`lg:col-span-8 bg-white rounded-3xl border border-slate-100 shadow-sm p-6 flex-col ${
            mobileTab === 'consultation' ? 'flex' : 'hidden lg:flex'
          }`}>
            {selectedSession ? (
              <div className="flex-1 flex flex-col justify-between">
                <div>
                  {/* Patient mini card */}
                  <div className="bg-slate-50 rounded-2xl border border-slate-100 p-5 mb-6 flex flex-wrap justify-between items-center gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-[#002F6C]/10 rounded-2xl flex items-center justify-center text-[#002F6C] font-black text-lg">
                        {selectedSession.patient_name[0]}
                      </div>
                      <div>
                        <h3 className="font-extrabold text-slate-800 text-lg leading-tight">{selectedSession.patient_name}</h3>
                        <p className="text-xs text-slate-400 font-mono mt-0.5">ABHA: {selectedSession.abha_id}</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-xl text-xs font-semibold">
                        Lang: {selectedSession.language.toUpperCase()}
                      </span>
                      <span className={`px-3 py-1 rounded-xl text-xs font-bold uppercase ${
                        selectedSession.status === 'completed' ? 'bg-slate-100 text-slate-500' : 'bg-emerald-50 text-emerald-700'
                      }`}>
                        {selectedSession.status}
                      </span>
                    </div>
                  </div>

                  {/* AI Triage outputs */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mb-6">
                    <div className="md:col-span-4 bg-slate-50 rounded-2xl p-4 border border-slate-100">
                      <h4 className="font-bold text-xs text-slate-400 uppercase tracking-wider mb-3">AI Diagnostic Triage</h4>
                      {getTriageBadge(selectedSession.ai_triage_category)}
                      
                      <div className="mt-4 space-y-2.5 text-xs text-slate-600">
                        <div>
                          <span className="text-slate-400 block">Symptoms</span>
                          <span className="font-semibold text-slate-800">{selectedSession.symptoms || 'None reported'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Duration</span>
                          <span className="font-semibold text-slate-800">{selectedSession.duration || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Severity</span>
                          <span className="font-semibold text-slate-800">{selectedSession.severity || 'N/A'}</span>
                        </div>
                        {selectedSession.vital_signs && (
                          <div>
                            <span className="text-slate-400 block">Vital Signs / Scanner</span>
                            <span className="font-semibold text-slate-800 font-mono whitespace-pre-wrap">{selectedSession.vital_signs}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="md:col-span-8 bg-slate-50 rounded-2xl p-4 border border-slate-100 flex flex-col justify-between">
                      <div>
                        <h4 className="font-bold text-xs text-slate-400 uppercase tracking-wider mb-2">AI Summary</h4>
                        <p className="text-slate-700 text-xs leading-relaxed italic bg-white p-3 rounded-xl border border-slate-100 font-medium">
                          "{selectedSession.session_summary || 'No summary available.'}"
                        </p>
                      </div>
                      
                      <div className="mt-4">
                        <h4 className="font-bold text-xs text-slate-400 uppercase tracking-wider mb-1.5">AI Primary Recommendation</h4>
                        <p className="text-slate-600 text-xs leading-relaxed whitespace-pre-wrap bg-white p-3 rounded-xl border border-slate-100">
                          {selectedSession.ai_recommendation || 'No recommendation.'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Submission success message */}
                  {message && (
                    <div className="mb-6 p-4 bg-emerald-50 text-emerald-800 border border-emerald-100 rounded-xl flex items-center gap-2.5 text-sm">
                      <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                      <span className="font-medium">{message}</span>
                    </div>
                  )}

                  {/* Submission error message */}
                  {error && selectedSession && (
                    <div className="mb-6 p-4 bg-red-50 text-red-800 border border-red-100 rounded-xl flex items-center gap-2.5 text-sm">
                      <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
                      <span className="font-medium">{error}</span>
                    </div>
                  )}

                  {/* Clinical input forms */}
                  <form onSubmit={handleSavePrescription} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-1.5">Practitioner Notes</label>
                        <textarea
                          rows={4}
                          value={doctorNotes}
                          onChange={(e) => setDoctorNotes(e.target.value)}
                          placeholder="Enter symptoms verified, history, and examination findings..."
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#002F6C]/20 focus:border-[#002F6C] text-slate-700 text-xs font-medium"
                          disabled={saving || selectedSession.status === 'completed'}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-1.5">Prescription & Advice</label>
                        <textarea
                          rows={4}
                          value={prescription}
                          onChange={(e) => setPrescription(e.target.value)}
                          placeholder="e.g. Paracetamol 650mg TDS x 3 days..."
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#002F6C]/20 focus:border-[#002F6C] text-slate-700 text-xs font-medium"
                          disabled={saving || selectedSession.status === 'completed'}
                        />
                      </div>
                    </div>

                    {selectedSession.status !== 'completed' && (
                      <button
                        type="submit"
                        disabled={saving}
                        className="w-full mt-4 py-3 bg-[#002F6C] hover:bg-[#002F6C]/90 text-white rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2 shadow-md shadow-[#002F6C]/10"
                      >
                        {saving ? 'Submitting clinical records...' : 'Link & Save Medical Record'}
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    )}
                  </form>
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
      </main>
      
      <Footer />
    </div>
  )
}
