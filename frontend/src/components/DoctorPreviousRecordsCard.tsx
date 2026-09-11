'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { 
  FolderHeart, Pill, Activity, FileText, Stethoscope, 
  Calendar, Clock, CheckCircle2, ChevronRight, Plus, 
  Copy, Eye, RefreshCw, AlertTriangle, ShieldCheck, Sparkles,
  ExternalLink, X, FileCheck, Search, ChevronDown
} from 'lucide-react'

export interface HistoricalMedication {
  id?: string;
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
  prescribed_by?: string;
  doctor_room?: string;
  date?: string;
  source?: string;
}

export interface HistoricalConsultation {
  session_id: string;
  date: string;
  time?: string;
  doctor_name: string;
  doctor_specialty?: string;
  doctor_room?: string;
  diagnosis: string;
  notes?: string;
  prescription_raw?: string;
  token?: string;
  status?: string;
}

export interface HistoricalReport {
  id: string;
  title: string;
  date: string;
  facility: string;
  vitals?: Record<string, string>;
  status: string;
  notes: string;
}

export interface HistoricalOcrScan {
  session_id: string;
  date: string;
  preview: string;
  full_text: string;
  vitals?: Record<string, string>;
}

interface DoctorPreviousRecordsCardProps {
  sessionId?: string;
  patientAbha?: string;
  patientName?: string;
  onAddMedication?: (med: { name: string; dosage: string; frequency: string; duration: string; instructions: string }) => void;
}

export default function DoctorPreviousRecordsCard({
  sessionId,
  patientAbha,
  patientName,
  onAddMedication
}: DoctorPreviousRecordsCardProps) {
  const [activeTab, setActiveTab] = useState<'all' | 'prescriptions' | 'consultations' | 'reports' | 'ocr'>('all')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copiedMedId, setCopiedMedId] = useState<string | null>(null)
  const [selectedScanModal, setSelectedScanModal] = useState<HistoricalOcrScan | null>(null)
  const [selectedConsultModal, setSelectedConsultModal] = useState<HistoricalConsultation | null>(null)

  // Data states
  const [consultations, setConsultations] = useState<HistoricalConsultation[]>([])
  const [prescriptions, setPrescriptions] = useState<HistoricalMedication[]>([])
  const [reports, setReports] = useState<HistoricalReport[]>([])
  const [ocrScans, setOcrScans] = useState<HistoricalOcrScan[]>([])
  const [totalCount, setTotalCount] = useState(0)

  const fetchHistory = useCallback(async () => {
    if (!sessionId) return
    setLoading(true)
    setError('')

    try {
      const res = await fetch(`/api/opd/doctor/sessions/${sessionId}/history`)
      if (!res.ok) throw new Error('Failed to load patient history')
      const data = await res.json()

      let apiConsultations: HistoricalConsultation[] = data.consultations || []
      let apiPrescriptions: HistoricalMedication[] = data.prescriptions || []
      let apiReports: HistoricalReport[] = data.reports || []
      let apiOcr: HistoricalOcrScan[] = data.ocr_scans || []

      // Also merge any local browser kiosk consultations from localStorage
      if (typeof window !== 'undefined') {
        try {
          const raw = localStorage.getItem('aarogya_medical_records')
          if (raw) {
            const localRecs = JSON.parse(raw)
            if (Array.isArray(localRecs)) {
              localRecs.forEach((lr: any, idx: number) => {
                const lrAbha = lr.patient?.abha_address || lr.patient_abha || ''
                const lrName = lr.patient?.full_name || lr.patient_name || ''
                const isMatch = (patientAbha && lrAbha && lrAbha.toLowerCase() === patientAbha.toLowerCase()) ||
                                (patientName && lrName && lrName.toLowerCase() === patientName.toLowerCase())

                // Avoid duplicating if session already present in apiConsultations
                const alreadyPresent = apiConsultations.some(c => c.session_id === lr.session_id)
                if (isMatch && !alreadyPresent) {
                  const doc = lr.doctor || {}
                  apiConsultations.push({
                    session_id: lr.session_id || `local_${idx}`,
                    date: lr.date || 'Previous Visit',
                    time: lr.time || '',
                    doctor_name: doc.name ? (doc.name.startsWith('Dr.') ? doc.name : `Dr. ${doc.name}`) : 'Consulting Physician',
                    doctor_specialty: doc.specialty || doc.post || 'General OPD',
                    doctor_room: doc.room ? String(doc.room) : 'OPD',
                    diagnosis: lr.confirmed_diagnosis || lr.diagnosis || 'OPD Consultation',
                    notes: lr.doctor_advice || lr.notes || '',
                    prescription_raw: lr.doctor_prescription || '',
                    token: lr.token || 'OPD',
                    status: 'completed'
                  })

                  if (Array.isArray(lr.medications)) {
                    lr.medications.forEach((m: any, mIdx: number) => {
                      apiPrescriptions.push({
                        id: `local_med_${idx}_${mIdx}`,
                        name: m.name,
                        dosage: m.dosage || '1 Tab',
                        frequency: m.frequency || '1-0-1',
                        duration: m.duration || '3 days',
                        instructions: m.instructions || 'After meals',
                        prescribed_by: doc.name || 'Consulting Physician',
                        doctor_room: doc.room ? String(doc.room) : 'OPD',
                        date: lr.date || 'Previous Visit',
                        source: 'Kiosk Consultation'
                      })
                    })
                  }
                }
              })
            }
          }
        } catch (e) {
          console.warn('Error reading local medical records:', e)
        }
      }

      setConsultations(apiConsultations)
      setPrescriptions(apiPrescriptions)
      setReports(apiReports)
      setOcrScans(apiOcr)
      setTotalCount(apiConsultations.length + apiPrescriptions.length + apiReports.length + apiOcr.length)
    } catch (err: any) {
      console.error('History fetch error:', err)
      setError(err.message || 'Error fetching records')
    } finally {
      setLoading(false)
    }
  }, [sessionId, patientAbha, patientName])

  useEffect(() => {
    if (sessionId) {
      fetchHistory()
    }
  }, [sessionId, fetchHistory])

  const handleCopyMedication = (med: HistoricalMedication) => {
    if (onAddMedication) {
      onAddMedication({
        name: med.name,
        dosage: med.dosage,
        frequency: med.frequency,
        duration: med.duration,
        instructions: med.instructions
      })
      setCopiedMedId(med.id || med.name)
      setTimeout(() => setCopiedMedId(null), 2000)
    }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3.5 transition-all">
      {/* Header Banner */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100">
            <FolderHeart className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-black text-slate-900 text-sm">
                Previous Medical Records, Reports & Prescriptions
              </h3>
              {totalCount > 0 && (
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-full border border-emerald-200">
                  {totalCount} Total Records
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-400">
              Verified ABHA Health History & Prior Hospital Consultations
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={fetchHistory}
          disabled={loading}
          title="Refresh patient history"
          className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1.5 border-b border-slate-100 pb-2 overflow-x-auto scrollbar-none flex-nowrap -mx-1 px-1">
        {[
          { key: 'all', label: 'All History', count: totalCount },
          { key: 'prescriptions', label: '💊 Prescriptions (Rx)', count: prescriptions.length },
          { key: 'consultations', label: '📋 Consultations', count: consultations.length },
          { key: 'reports', label: '🔬 Reports & Vitals', count: reports.length },
          { key: 'ocr', label: '📄 Scanned Documents', count: ocrScans.length },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key as any)}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              activeTab === tab.key
                ? 'bg-[#002F6C] text-white shadow-xs'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <span>{tab.label}</span>
            {tab.count > 0 && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                activeTab === tab.key ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Loading State */}
      {loading && totalCount === 0 && (
        <div className="py-8 flex flex-col items-center justify-center text-slate-400 space-y-2">
          <RefreshCw className="w-5 h-5 animate-spin text-emerald-600" />
          <span className="text-xs font-semibold">Loading verified medical records...</span>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="p-3 bg-red-50 text-red-700 rounded-xl border border-red-200 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Empty State */}
      {!loading && totalCount === 0 && !error && (
        <div className="p-5 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 space-y-1.5">
          <FolderHeart className="w-6 h-6 text-slate-300 mx-auto" />
          <p className="text-xs font-bold text-slate-700">No Previous Medical Records Found</p>
          <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
            This patient has no recorded prior OPD consultations or scanned prescriptions in their ABHA health locker.
          </p>
        </div>
      )}

      {/* Records Content */}
      {!loading && totalCount > 0 && (
        <div className="max-h-[380px] overflow-y-auto space-y-3 pr-1">

          {/* TAB 1: ALL HISTORY OR TAB 2: PRESCRIPTIONS */}
          {(activeTab === 'all' || activeTab === 'prescriptions') && prescriptions.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Pill className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Prior Prescribed Medications (Rx)</span>
                </span>
                <span className="text-[10px] text-slate-400 font-bold">
                  {prescriptions.length} medicine{prescriptions.length > 1 ? 's' : ''} on record
                </span>
              </div>

              <div className="grid grid-cols-1 gap-2">
                {prescriptions.map((med, idx) => (
                  <div
                    key={med.id || `rx_${idx}`}
                    className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-slate-50 transition flex items-start justify-between gap-2.5"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-extrabold text-slate-900 text-xs truncate">
                          {med.name}
                        </span>
                        <span className="px-1.5 py-0.2 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded border border-emerald-200">
                          {med.dosage}
                        </span>
                        <span className="px-1.5 py-0.2 bg-blue-50 text-blue-700 text-[10px] font-bold rounded border border-blue-200">
                          {med.frequency}
                        </span>
                        <span className="text-[10px] text-slate-500 font-semibold">
                          x {med.duration}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 truncate">
                        {med.instructions && <span className="text-slate-600 font-medium">[{med.instructions}] • </span>}
                        Prescribed by {med.prescribed_by} {med.doctor_room ? `(Cabin ${med.doctor_room})` : ''} on {med.date}
                      </p>
                    </div>

                    {/* Copy to Active Prescription Button */}
                    {onAddMedication && (
                      <button
                        type="button"
                        onClick={() => handleCopyMedication(med)}
                        className={`px-2 py-1 rounded-lg text-[10px] font-extrabold flex items-center gap-1 shrink-0 transition ${
                          copiedMedId === (med.id || med.name)
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 hover:border-emerald-400'
                        }`}
                        title="Copy this medication to active consultation prescription"
                      >
                        {copiedMedId === (med.id || med.name) ? (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-white" />
                            <span>Added!</span>
                          </>
                        ) : (
                          <>
                            <Plus className="w-3 h-3 text-emerald-600" />
                            <span>+ Copy to Rx</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 1: ALL HISTORY OR TAB 3: DOCTOR CONSULTATIONS */}
          {(activeTab === 'all' || activeTab === 'consultations') && consultations.length > 0 && (
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Stethoscope className="w-3.5 h-3.5 text-blue-900" />
                  <span>Prior Doctor Consultations</span>
                </span>
                <span className="text-[10px] text-slate-400 font-bold">
                  {consultations.length} visit{consultations.length > 1 ? 's' : ''}
                </span>
              </div>

              <div className="space-y-2">
                {consultations.map((cons, idx) => (
                  <div
                    key={cons.session_id || `cons_${idx}`}
                    className="p-3 rounded-xl border border-blue-100 bg-blue-50/30 hover:bg-blue-50/60 transition space-y-1.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-extrabold text-slate-900 text-xs">
                            {cons.doctor_name}
                          </h4>
                          <span className="text-[10px] font-bold text-blue-900 bg-blue-100/70 px-2 py-0.2 rounded-md">
                            Cabin {cons.doctor_room} • {cons.doctor_specialty}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          Date: <span className="text-slate-600 font-semibold">{cons.date}</span> {cons.time && `at ${cons.time}`} • Token: {cons.token}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => setSelectedConsultModal(cons)}
                        className="px-2 py-1 bg-white hover:bg-blue-100/50 text-blue-900 border border-blue-200 text-[10px] font-bold rounded-lg flex items-center gap-1 shrink-0 transition"
                      >
                        <Eye className="w-3 h-3" />
                        <span>View Notes</span>
                      </button>
                    </div>

                    <div className="text-xs text-slate-800 bg-white/80 p-2 rounded-lg border border-blue-100">
                      <span className="text-[10px] font-extrabold uppercase text-slate-500 block">Diagnosis:</span>
                      <p className="font-semibold text-slate-900">{cons.diagnosis}</p>
                      {cons.notes && (
                        <p className="text-slate-600 text-[11px] mt-1 italic line-clamp-2">
                          "{cons.notes}"
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 1: ALL HISTORY OR TAB 4: REPORTS & VITALS */}
          {(activeTab === 'all' || activeTab === 'reports') && reports.length > 0 && (
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-purple-600" />
                  <span>Diagnostic Reports & Vitals</span>
                </span>
                <span className="text-[10px] text-slate-400 font-bold">
                  {reports.length} report{reports.length > 1 ? 's' : ''}
                </span>
              </div>

              <div className="space-y-2">
                {reports.map((rep) => (
                  <div
                    key={rep.id}
                    className="p-3 rounded-xl border border-purple-100 bg-purple-50/30 hover:bg-purple-50/50 transition space-y-1.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-extrabold text-slate-900 text-xs">{rep.title}</h4>
                        <p className="text-[10px] text-slate-400">{rep.facility} • {rep.date}</p>
                      </div>
                      <span className="px-2 py-0.5 bg-purple-100 text-purple-800 text-[10px] font-extrabold rounded-md">
                        {rep.status}
                      </span>
                    </div>

                    {rep.vitals && Object.keys(rep.vitals).length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {rep.vitals.bp && (
                          <span className="px-2 py-0.5 bg-white border border-purple-200 text-slate-800 text-[10px] font-bold rounded-md">
                            BP: <strong className="text-purple-900">{rep.vitals.bp}</strong>
                          </span>
                        )}
                        {rep.vitals.pulse && (
                          <span className="px-2 py-0.5 bg-white border border-purple-200 text-slate-800 text-[10px] font-bold rounded-md">
                            Pulse: <strong className="text-purple-900">{rep.vitals.pulse}</strong>
                          </span>
                        )}
                        {rep.vitals.rbs && (
                          <span className="px-2 py-0.5 bg-white border border-purple-200 text-slate-800 text-[10px] font-bold rounded-md">
                            RBS: <strong className="text-purple-900">{rep.vitals.rbs}</strong>
                          </span>
                        )}
                        {rep.vitals.spo2 && (
                          <span className="px-2 py-0.5 bg-white border border-purple-200 text-slate-800 text-[10px] font-bold rounded-md">
                            SpO2: <strong className="text-purple-900">{rep.vitals.spo2}</strong>
                          </span>
                        )}
                      </div>
                    )}

                    {rep.notes && (
                      <p className="text-[11px] text-slate-600 bg-white/70 p-1.5 rounded border border-purple-100">
                        {rep.notes}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 1: ALL HISTORY OR TAB 5: SCANNED DOCUMENTS (OCR) */}
          {(activeTab === 'all' || activeTab === 'ocr') && ocrScans.length > 0 && (
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-amber-600" />
                  <span>Scanned Paper Prescriptions & OCR Scans</span>
                </span>
                <span className="text-[10px] text-slate-400 font-bold">
                  {ocrScans.length} scanned document{ocrScans.length > 1 ? 's' : ''}
                </span>
              </div>

              <div className="space-y-2">
                {ocrScans.map((scan, idx) => (
                  <div
                    key={`scan_${scan.session_id}_${idx}`}
                    className="p-3 rounded-xl border border-amber-200/80 bg-amber-50/30 hover:bg-amber-50/60 transition space-y-1.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="p-1 bg-amber-100 text-amber-800 rounded-md">
                          <FileText className="w-3.5 h-3.5" />
                        </span>
                        <div>
                          <h4 className="font-extrabold text-slate-900 text-xs">Digitized Physical Prescription</h4>
                          <p className="text-[10px] text-slate-400">Scanned Record on {scan.date}</p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setSelectedScanModal(scan)}
                        className="px-2 py-1 bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold rounded-lg flex items-center gap-1 shrink-0 transition"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Inspect Scan</span>
                      </button>
                    </div>

                    <p className="text-slate-700 font-mono text-[10px] bg-white p-2 rounded border border-amber-200 line-clamp-3">
                      {scan.preview}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}

      {/* MODAL 1: INSPECT SCANNED OCR DOCUMENT */}
      {selectedScanModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-600" />
                <div>
                  <h3 className="font-black text-slate-900 text-sm">Digitized Prescription & Document Scan</h3>
                  <p className="text-[10px] text-slate-400">Date: {selectedScanModal.date}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedScanModal(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-3 flex-1">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">
                  Full Optical Character Recognition (OCR) Output:
                </span>
                <pre className="font-mono text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
                  {selectedScanModal.full_text}
                </pre>
              </div>
            </div>

            <div className="p-3 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedScanModal(null)}
                className="px-4 py-1.5 bg-[#002F6C] text-white rounded-xl text-xs font-bold"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: VIEW FULL DOCTOR CONSULTATION SLIP */}
      {selectedConsultModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-blue-50/50">
              <div className="flex items-center gap-2">
                <Stethoscope className="w-4 h-4 text-blue-900" />
                <div>
                  <h3 className="font-black text-slate-900 text-sm">{selectedConsultModal.doctor_name}</h3>
                  <p className="text-[10px] text-slate-500">
                    Cabin {selectedConsultModal.doctor_room} • {selectedConsultModal.doctor_specialty}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedConsultModal(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-3 flex-1 text-xs">
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] font-extrabold uppercase text-slate-500 block">Consultation Date & Token</span>
                <p className="font-bold text-slate-900">{selectedConsultModal.date} {selectedConsultModal.time && `• ${selectedConsultModal.time}`} (Token: {selectedConsultModal.token})</p>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] font-extrabold uppercase text-slate-500 block">Confirmed Clinical Diagnosis</span>
                <p className="font-bold text-blue-900">{selectedConsultModal.diagnosis}</p>
              </div>

              {selectedConsultModal.notes && (
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-extrabold uppercase text-slate-500 block">Doctor Notes & Instructions</span>
                  <p className="text-slate-800 whitespace-pre-wrap">{selectedConsultModal.notes}</p>
                </div>
              )}

              {selectedConsultModal.prescription_raw && (
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-extrabold uppercase text-slate-500 block">Prescribed Medicines</span>
                  <p className="text-slate-800 whitespace-pre-wrap font-mono text-[11px] mt-1">{selectedConsultModal.prescription_raw}</p>
                </div>
              )}
            </div>

            <div className="p-3 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedConsultModal(null)}
                className="px-4 py-1.5 bg-[#002F6C] text-white rounded-xl text-xs font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
