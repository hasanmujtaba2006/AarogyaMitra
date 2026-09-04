'use client'

import React, { useState, useEffect } from 'react'
import { 
  FolderHeart, 
  Pill, 
  Activity, 
  FileText, 
  AlertTriangle, 
  Printer, 
  PlusCircle, 
  CheckCircle2, 
  Calendar, 
  Stethoscope, 
  Eye, 
  ShieldCheck, 
  Sparkles,
  ChevronRight
} from 'lucide-react'
import { PatientInfo } from '@/components/AbhaCard'
import { useLanguage } from '@/context/LanguageContext'

export interface ScannedPrescriptionDetails {
  hospital?: string;
  location?: string;
  date?: string;
  patient_name?: string;
  age?: string;
  gender?: string;
  uhid?: string;
  complaints?: string;
  diagnosis?: string;
  vitals?: {
    bp?: string;
    pulse?: string;
    rbs?: string;
  };
  medications?: Array<{
    name: string;
    dosage?: string;
    route?: string;
    instructions?: string;
    purpose?: string;
  }>;
  doctor_reg?: string;
  extracted_markdown?: string;
}

interface MedicalRecordsViewProps {
  patient: PatientInfo;
  ocrText?: string;
  scannedDetails?: ScannedPrescriptionDetails | null;
  onScanNewPrescription?: () => void;
  onConsultDoctor?: () => void;
}

export default function MedicalRecordsView({
  patient,
  ocrText,
  scannedDetails,
  onScanNewPrescription,
  onConsultDoctor
}: MedicalRecordsViewProps) {
  const { t } = useLanguage()
  const [activeSubTab, setActiveSubTab] = useState<'all' | 'meds' | 'reports' | 'prescriptions'>('all')
  const [showRawOcr, setShowRawOcr] = useState(false)

  // Load saved consultations and doctor prescriptions from localStorage
  const [savedConsultations, setSavedConsultations] = useState<any[]>([])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('aarogya_medical_records')
        if (raw) {
          setSavedConsultations(JSON.parse(raw))
        }
      } catch (e) {}
    }
  }, [])

  // Dynamically extract and structure medications from genuinely scanned prescription
  const scannedMedications = (scannedDetails?.medications || []).map((med, idx) => ({
    id: `scanned_med_${idx}`,
    name: med.name,
    generic: med.name,
    dosage: med.dosage || med.instructions || t('As directed', 'निर्देशानुसार', 'அறிவுறுத்தலின்படி', 'సూచించిన ప్రకారం'),
    purpose: med.instructions || (scannedDetails?.diagnosis ? `${scannedDetails.diagnosis}` : t('Prescribed Therapy', 'निर्धारित उपचार', 'பரிந்துரைக்கப்பட்ட சிகிச்சை', 'సూచించిన చికిత్స')),
    prescribedBy: scannedDetails?.doctor_reg
      ? `Dr. Reg #${scannedDetails.doctor_reg}${scannedDetails.hospital ? ` (${scannedDetails.hospital})` : ''}`
      : (scannedDetails?.hospital || t('Hospital OPD', 'अस्पताल ओपीडी', 'மருத்துவமனை OPD', 'ఆసుపత్రి OPD')),
    startDate: scannedDetails?.date || t('Today (Scanned)', 'आज (स्कैन किया गया)', 'இன்று (ஸ்கேன்)', 'ఈరోజు (స్కాన్)'),
    status: 'Active',
    isScanned: true
  }))

  // Extract medications from saved doctor consultations
  const consultationMedications = savedConsultations.flatMap((cons, cIdx) => {
    const meds = cons.medications || []
    return meds.map((m: any, mIdx: number) => ({
      id: `cons_med_${cIdx}_${mIdx}`,
      name: m.name,
      generic: m.name,
      dosage: m.dosage || 'As directed',
      purpose: m.instructions || cons.confirmed_diagnosis || cons.chief_complaint || t('Prescribed OPD Therapy', 'ओपीडी परामर्श उपचार', 'பரிந்துரைக்கப்பட்ட சிகிச்சை', 'సూచించిన చికిత్స'),
      prescribedBy: cons.doctor
        ? `${cons.doctor.name} (${cons.doctor.post || cons.doctor.specialty}) • Room ${cons.doctor.room}`
        : 'Consulting Doctor',
      startDate: cons.date || t('Today', 'आज', 'இன்று', 'ఈరోజు'),
      status: 'Active',
      isScanned: false
    }))
  })

  // All medications on record
  const allMedications = [...consultationMedications, ...scannedMedications]

  // Dynamic evaluation of point-of-care Random Blood Sugar (RBS) if present on scanned record
  const rbsNum = scannedDetails?.vitals?.rbs ? parseFloat(scannedDetails.vitals.rbs.replace(/[^0-9.]/g, '')) : null
  const rbsEvaluation = rbsNum !== null && !isNaN(rbsNum)
    ? (rbsNum < 70
        ? { label: t('Low (Hypoglycemic)', 'निम्न (हाइपोग्लाइसीमिया)', 'குறைவு (ஹைபோகிளைசீமியா)', 'తక్కువ (హైపోగ్లైసీమియా)'), badgeClass: 'text-red-700 bg-red-50 border border-red-200' }
        : rbsNum > 140
          ? { label: t('High (Elevated)', 'उच्च (बढ़ा हुआ)', 'அதிகம்', 'ఎక్కువ'), badgeClass: 'text-amber-700 bg-amber-50 border border-amber-200' }
          : { label: t('Normal', 'सामान्य', 'இயல்பானது', 'సాధారణం'), badgeClass: 'text-emerald-700 bg-emerald-50 border border-emerald-200' })
    : { label: t('Recorded', 'दर्ज', 'பதிவு செய்யப்பட்டது', 'నమోదు చేయబడింది'), badgeClass: 'text-blue-700 bg-blue-50 border border-blue-200' }

  // Diagnostic & Lab Reports (only real point-of-care test values if present on scanned prescription)
  const labReports = scannedDetails?.vitals?.rbs ? [{
    id: 'lab_scanned_rbs',
    title: t('Random Blood Sugar (RBS) - Point of Care', 'रैंडम ब्लड शुगर (RBS) - पॉइंट ऑफ केयर', 'இரத்த சர்க்கரை (RBS)', 'యాదృచ్ఛిక రక్తంలో గ్లూకోజ్ (RBS)'),
    facility: scannedDetails.hospital || t('Clinical Point of Care', 'क्लिनिकल पॉइंट ऑफ केयर', 'மருத்துவ பரிசோதனை', 'క్లినికల్ పరీక్ష'),
    date: scannedDetails.date || t('Today', 'आज', 'இன்று', 'ఈరోజు'),
    status: rbsEvaluation.label,
    summary: `RBS: ${scannedDetails.vitals.rbs}`,
    isScanned: true
  }] : []

  // Consultation slips from doctor consultations
  const consultationSlips = savedConsultations.map((cons, idx) => ({
    id: `consultation_${cons.id || idx}`,
    title: cons.doctor
      ? `${cons.doctor.name} - ${cons.doctor.specialty}`
      : t('OPD Clinical Consultation', 'ओपीडी क्लिनिकल परामर्श', 'OPD ஆலோசனை', 'OPD సంప్రదింపు'),
    doctor: cons.doctor
      ? `${cons.doctor.name} (${cons.doctor.post}) • Room ${cons.doctor.room}`
      : 'Consulting Physician',
    date: cons.date || 'Today',
    notes: cons.doctor_prescription || cons.raw_summary || '',
    badge: cons.token ? `Token: ${cons.token} • ${cons.status || 'Active'}` : 'OPD Consultation',
    consultationData: cons
  }))

  // Prescriptions history (combines saved consultations + scanned prescriptions)
  const prescriptionsList = [
    ...consultationSlips,
    ...(scannedDetails || ocrText ? [{
      id: 'current_ocr',
      title: scannedDetails?.hospital
        ? scannedDetails.hospital
        : t('Newly Scanned Prescription', 'हाल ही में स्कैन किया गया पर्चा', 'புதிதாக ஸ்கேன் செய்யப்பட்ட மருந்துச்சீட்டு', 'కొత్తగా స్కాన్ చేసిన ప్రిస్క్రిప్షన్'),
      doctor: scannedDetails?.doctor_reg
        ? `Dr. Reg #${scannedDetails.doctor_reg}`
        : t('Self-Scanned at Kiosk', 'कियोस्क पर स्वयं स्कैन किया गया', 'கியோஸ்கில் ஸ்கேன் செய்யப்பட்டது', 'కియోస్క్‌లో స్కాన్ చేయబడింది'),
      date: scannedDetails?.date || t('Today', 'आज', 'இன்று', 'ఈరోజు'),
      notes: ocrText || scannedDetails?.extracted_markdown || '',
      badge: t('Current Session • Digitized', 'वर्तमान सत्र • डिजिटाइज़्ड', 'தற்போதைய அமர்வு • டிஜிட்டல்', 'ప్రస్తుత సెషన్ • డిజిటలైజ్ చేయబడింది'),
      details: scannedDetails
    }] : [])
  ]

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      {/* Header Banner */}
      {/* Top Banner with ABHA Context */}
      <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-lg sm:shadow-xl border-2 border-slate-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-blue-50 border-2 border-blue-200 flex items-center justify-center text-blue-900 shadow-sm shrink-0">
            <FolderHeart className="w-6 h-6 sm:w-8 sm:h-8" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg sm:text-2xl font-black text-slate-900 truncate">
              {t('Electronic Medical Records (EMR)', 'इलेक्ट्रॉनिक मेडिकल रिकॉर्ड्स', 'மின்னணு மருத்துவப் பதிவுகள்', 'ఎలక్ట్రానిక్ మెడికల్ రికార్డులు')}
            </h2>

          </div>
        </div>

        {onScanNewPrescription && (
          <div className="flex items-center gap-2.5 w-full md:w-auto">
            <button
              onClick={onScanNewPrescription}
              className="w-full md:w-auto py-2 sm:py-2.5 px-3.5 sm:px-4 bg-blue-800 hover:bg-blue-900 text-white text-xs font-extrabold rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 shadow-md"
            >
              <PlusCircle className="w-4 h-4 shrink-0" />
              <span>{t('Scan New Prescription', 'नया पर्चा स्कैन करें', 'புதிய மருந்துச்சீட்டு ஸ்கேன்', 'కొత్త ప్రిస్క్రిప్షన్ స్కాన్')}</span>
            </button>
          </div>
        )}
      </div>

      {/* Quick Health Summary Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3">
        <div className="bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl border sm:border-2 border-slate-100 shadow-sm">
          <div className="flex items-center gap-1.5 sm:gap-2 text-slate-400 text-[10px] sm:text-xs font-bold uppercase truncate">
            <Activity className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-500 shrink-0" />
            <span className="truncate">{t('Blood Pressure', 'रक्तचाप', 'இரத்த அழுத்தம்', 'రక్తపోటు')}</span>
          </div>
          <p className="text-base sm:text-xl font-black text-slate-800 mt-1">
            {scannedDetails?.vitals?.bp ? (
              <>
                {scannedDetails.vitals.bp} <span className="text-[10px] sm:text-xs font-bold text-slate-400">mmHg</span>
              </>
            ) : (
              <span className="text-slate-400 text-base sm:text-lg">-- / --</span>
            )}
          </p>
          <span className={`text-[9px] sm:text-[10px] font-extrabold px-1.5 sm:px-2 py-0.5 rounded-md mt-1 inline-block truncate max-w-full ${
            scannedDetails?.vitals?.bp ? 'text-blue-700 bg-blue-50 border border-blue-200' : 'text-slate-500 bg-slate-100'
          }`}>
            {scannedDetails?.vitals?.bp ? t('Prescription Record', 'पर्चे से दर्ज', 'பதிவு செய்யப்பட்டது', 'నమోదు చేయబడింది') : t('Not Recorded', 'दर्ज नहीं', 'பதிவு செய்யப்படவில்லை', 'నమోదు కాలేదు')}
          </span>
        </div>

        <div className="bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl border sm:border-2 border-slate-100 shadow-sm">
          <div className="flex items-center gap-1.5 sm:gap-2 text-slate-400 text-[10px] sm:text-xs font-bold uppercase truncate">
            <Activity className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-500 shrink-0" />
            <span className="truncate">{t('Heart Rate', 'हृदय गति', 'இதய துடிப்பு', 'హృదయ స్పందన')}</span>
          </div>
          <p className="text-base sm:text-xl font-black text-slate-800 mt-1">
            {scannedDetails?.vitals?.pulse ? (
              <>
                {scannedDetails.vitals.pulse.replace(/bpm/i, '').trim()} <span className="text-[10px] sm:text-xs font-bold text-slate-400">BPM</span>
              </>
            ) : (
              <span className="text-slate-400 text-base sm:text-lg">--</span>
            )}
          </p>
          <span className={`text-[9px] sm:text-[10px] font-extrabold px-1.5 sm:px-2 py-0.5 rounded-md mt-1 inline-block truncate max-w-full ${
            scannedDetails?.vitals?.pulse ? 'text-blue-700 bg-blue-50 border border-blue-200' : 'text-slate-500 bg-slate-100'
          }`}>
            {scannedDetails?.vitals?.pulse ? t('Prescription Record', 'पर्चे से दर्ज', 'பதிவு செய்யப்பட்டது', 'నమోదు చేయబడింది') : t('Not Recorded', 'दर्ज नहीं', 'பதிவு செய்யப்படவில்லை', 'నమోదు కాలేదు')}
          </span>
        </div>

        <div className="bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl border sm:border-2 border-slate-100 shadow-sm">
          <div className="flex items-center gap-1.5 sm:gap-2 text-slate-400 text-[10px] sm:text-xs font-bold uppercase truncate">
            <Pill className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-500 shrink-0" />
            <span className="truncate">{t('Active Medicines', 'सक्रिय दवाइयाँ', 'மருந்துகள்', 'మందులు')}</span>
          </div>
          <p className="text-base sm:text-xl font-black text-slate-800 mt-1">
            {allMedications.length} <span className="text-[10px] sm:text-xs font-bold text-slate-400">{t('Prescribed', 'दवाइयाँ', 'மருந்துகள்', 'మందులు')}</span>
          </p>
          <span className={`text-[9px] sm:text-[10px] font-extrabold px-1.5 sm:px-2 py-0.5 rounded-md mt-1 inline-block truncate max-w-full ${
            allMedications.length > 0 ? 'text-blue-700 bg-blue-50 border border-blue-200' : 'text-slate-500 bg-slate-100'
          }`}>
            {allMedications.length > 0
              ? `${allMedications.length} ${t('Scanned Rx', 'पर्चे से', 'ஸ்கேன்', 'స్కాన్')}`
              : t('None Active', 'कोई सक्रिय नहीं', 'செயலில் இல்லை', 'యాక్టివ్ ఏదీ లేదు')}
          </span>
        </div>

        <div className="bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl border sm:border-2 border-slate-100 shadow-sm">
          <div className="flex items-center gap-1.5 sm:gap-2 text-slate-400 text-[10px] sm:text-xs font-bold uppercase truncate">
            <Activity className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-500 shrink-0" />
            <span className="truncate">{t('Blood Sugar (RBS)', 'रक्त शर्करा (RBS)', 'இரத்த சர்க்கரை', 'రక్తంలో గ్లూకోజ్')}</span>
          </div>
          <p className="text-base sm:text-xl font-black text-slate-800 mt-1">
            {scannedDetails?.vitals?.rbs ? (
              scannedDetails.vitals.rbs
            ) : (
              <span className="text-slate-400 text-base sm:text-lg">--</span>
            )}
          </p>
          <span className={`text-[9px] sm:text-[10px] font-extrabold px-1.5 sm:px-2 py-0.5 rounded-md mt-1 inline-block truncate max-w-full ${
            scannedDetails?.vitals?.rbs ? rbsEvaluation.badgeClass : 'text-slate-500 bg-slate-100'
          }`}>
            {scannedDetails?.vitals?.rbs ? rbsEvaluation.label : t('Not Recorded', 'दर्ज नहीं', 'பதிவு செய்யப்படவில்லை', 'నమోదు కాలేదు')}
          </span>
        </div>

        <div className="bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl border sm:border-2 border-slate-100 shadow-sm col-span-2 sm:col-span-1">
          <div className="flex items-center gap-1.5 sm:gap-2 text-slate-400 text-[10px] sm:text-xs font-bold uppercase truncate">
            <AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-500 shrink-0" />
            <span className="truncate">{t('Allergies', 'एलर्जी', 'ஒவ்வாமை', 'అలెర్జీలు')}</span>
          </div>
          <p className="text-xs sm:text-sm font-black text-slate-800 mt-1 truncate" title={patient.allergies || 'No Known Allergies'}>
            {patient.allergies || t('No Known Allergies', 'कोई ज्ञात एलर्जी नहीं', 'ஒவ்வாமை இல்லை', 'తెలిసిన అలెర్జీలు లేవు')}
          </p>
          <span className={`text-[9px] sm:text-[10px] font-extrabold px-1.5 sm:px-2 py-0.5 rounded-md mt-1 inline-block truncate max-w-full ${
            patient.allergies && !patient.allergies.toLowerCase().includes('no known') && !patient.allergies.toLowerCase().includes('none')
              ? 'text-amber-800 bg-amber-50 border border-amber-200'
              : 'text-emerald-700 bg-emerald-50 border border-emerald-200'
          }`}>
            {patient.allergies && !patient.allergies.toLowerCase().includes('no known') && !patient.allergies.toLowerCase().includes('none')
              ? t('Reported in ABHA', 'एबीएचए में दर्ज', 'பதிவு செய்யப்பட்டது', 'నమోదు చేయబడింది')
              : t('No Alert', 'कोई चेतावनी नहीं', 'எச்சரிக்கை இல்லை', 'హెచ్చరిక లేదు')}
          </span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1.5 sm:gap-2 border-b border-slate-200 pb-2 overflow-x-auto scrollbar-none flex-nowrap -mx-1 px-1">
        {[
          { key: 'all', label: t('All Records', 'सभी रिकॉर्ड्स', 'அனைத்துப் பதிவுகளும்', 'అన్ని రికార్డులు') },
          { key: 'meds', label: t('Prescriptions & Medicines', 'दवाइयाँ और पर्चे', 'மருந்துகள்', 'మందులు & ప్రిస్క్రిప్షన్లు') },
          { key: 'reports', label: t('Lab & Diagnostic Tests', 'लैब जांच रिपोर्ट', 'ஆய்வக அறிக்கைகள்', 'ల్యాబ్ నివేదికలు') },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveSubTab(tab.key as any)}
            className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap shrink-0 ${
              activeSubTab === tab.key
                ? 'bg-blue-900 text-white shadow-md'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* SECTION 1: MEDICATIONS & PRESCRIPTIONS */}
      {(activeSubTab === 'all' || activeSubTab === 'meds') && (
        <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-lg sm:shadow-xl border-2 border-slate-100 space-y-3 sm:space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
              <Pill className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600" />
              <span>{t('Active Prescription Medications', 'सक्रिय प्रिस्क्रिप्शन दवाइयाँ', 'செயலில் உள்ள மருந்துகள்', 'యాక్టివ్ ప్రిస్క్రిప్షన్ మందులు')}</span>
            </h3>
            <span className="text-xs font-bold text-slate-400">
              {allMedications.length} {t('Medications on record', 'दवाइयां दर्ज', 'மருந்துகள்', 'మందులు రికార్డు')}
            </span>
          </div>

          {allMedications.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              {allMedications.map((med) => (
                <div
                  key={med.id}
                  className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border-2 border-emerald-400 bg-emerald-50/30 hover:border-emerald-500 shadow-sm transition-all space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-extrabold text-slate-900 text-sm sm:text-base">{med.name}</h4>
                        {(med as any).isScanned && (
                          <span className="bg-emerald-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                            <Sparkles className="w-2.5 h-2.5" />
                            <span>{t('Digitized', 'डिजिटाइज़्ड', 'டிஜிட்டல்', 'డిజిటల్')}</span>
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500">{med.generic} • {med.purpose}</p>
                    </div>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                      {med.status}
                    </span>
                  </div>

                  <div className="bg-white p-2 sm:p-2.5 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                    <span className="font-bold text-blue-900">{med.dosage}</span>
                    <span className="text-slate-400">{med.startDate}</span>
                  </div>

                  <p className="text-[11px] text-slate-400 font-medium">
                    {t('Prescribed by', 'द्वारा निर्धारित', 'பரிந்துரைத்தவர்', 'సూచించినవారు')}: <span className="text-slate-700 font-bold">{med.prescribedBy}</span>
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 sm:py-10 px-4 border-2 border-dashed border-slate-200 rounded-xl sm:rounded-2xl bg-slate-50/50 flex flex-col items-center justify-center gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                <Pill className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div className="max-w-md">
                <h4 className="text-sm font-extrabold text-slate-800">
                  {t('No Active Medications on Record', 'कोई सक्रिय दवाइयाँ दर्ज नहीं हैं', 'செயலில் உள்ள மருந்துகள் இல்லை', 'యాక్టివ్ మందులు ఏవీ రికార్డు కాలేదు')}
                </h4>
                <p className="text-xs text-slate-500 mt-1">
                  {t('Scan an existing doctor prescription slip or consult Doctor AI at this kiosk to record and track your active medications.', 'सक्रिय दवाइयों को ट्रैक करने के लिए अपना पुराना पर्चा स्कैन करें या डॉक्टर एआई से परामर्श लें।', 'உங்கள் மருந்துகளைப் பதிவு செய்ய பழைய மருந்துச்சீட்டை ஸ்கேன் செய்யவும் அல்லது மருத்துவரை அணுகவும்.', 'మీ యాక్టివ్ మందులను రికార్డ్ చేయడానికి ప్రిస్క్రిప్షన్‌ను స్కాన్ చేయండి లేదా డాక్టర్ AIని సంప్రదించండి.')}
                </p>
              </div>
              {onScanNewPrescription && (
                <button
                  onClick={onScanNewPrescription}
                  className="mt-1 px-4 py-2 bg-blue-800 hover:bg-blue-900 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>{t('Scan Prescription', 'पर्चा स्कैन करें', 'மருந்துச்சீட்டு ஸ்கேன்', 'ప్రిస్క్రిప్షన్ స్కాన్')}</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* SECTION 2: PRESCRIPTIONS & OCR SCANS */}
      {(activeSubTab === 'all' || activeSubTab === 'meds') && (
        <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-lg sm:shadow-xl border-2 border-slate-100 space-y-3 sm:space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
              <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-blue-700" />
              <span>{t('Prescription Slips & Doctor Notes', 'पर्चे की प्रति एवं डॉक्टर नोट्स', 'மருந்துச்சீட்டு குறிப்புகள்', 'ప్రిస్క్రిప్షన్ కాపీలు & డాక్టర్ నోట్స్')}</span>
            </h3>
          </div>

          {prescriptionsList.length > 0 ? (
            <div className="space-y-3 sm:space-y-4">
              {prescriptionsList.map((rx) => {
                if (rx.id === 'current_ocr' && (rx as any).details) {
                  const det = (rx as any).details as ScannedPrescriptionDetails
                  return (
                    <div
                      key={rx.id}
                      className="p-3.5 sm:p-6 rounded-2xl sm:rounded-3xl border-2 border-emerald-500 bg-gradient-to-br from-emerald-50/40 via-white to-blue-50/30 shadow-md space-y-3 sm:space-y-4"
                    >
                      {/* Facility Header */}
                      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b border-emerald-100 pb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="bg-emerald-600 text-white text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full shadow-sm">
                              {t('Current Digitized Prescription', 'वर्तमान डिजिटाइज़्ड पर्चा', 'நடப்பு மருந்துச்சீட்டு', 'ప్రస్తుత డిజిటలైజ్డ్ ప్రిస్క్రిప్షన్')}
                            </span>
                            <span className="text-xs font-bold text-slate-400 font-mono">
                              {det.date || 'Today'}
                            </span>
                          </div>
                          <h4 className="text-base sm:text-lg font-black text-slate-900 mt-1">
                            {det.hospital || t('Hospital / Clinic OPD', 'अस्पताल / क्लिनिक ओपीडी', 'மருத்துவமனை OPD', 'ఆసుపత్రి OPD')}
                          </h4>
                          {det.location && (
                            <p className="text-xs text-slate-500">{det.location}</p>
                          )}
                        </div>

                        {det.doctor_reg && (
                          <div className="text-left sm:text-right">
                            <span className="text-[11px] font-bold text-slate-500 block">{t('Doctor Signature', 'डॉक्टर हस्ताक्षर', 'மருத்துவர் கையொப்பம்', 'వైద్యుల సంతకం')}</span>
                            <span className="text-xs font-mono font-black text-slate-800 bg-white px-2 py-1 rounded-lg border border-slate-200 inline-block mt-0.5">
                              Reg #{det.doctor_reg}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Patient & Diagnosis Subheader */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="bg-white/80 p-3 rounded-xl border border-slate-200/80 shadow-xs">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">{t('Patient Name', 'रोगी का नाम', 'நோயாளி பெயர்', 'ரோగి పేరు')}</span>
                          <p className="text-sm font-black text-slate-800">{det.patient_name || patient.full_name} {det.age ? `(${det.age}/${det.gender || 'M'})` : ''}</p>
                          {det.uhid && <span className="text-[10px] font-mono text-slate-400 block">UHID: {det.uhid}</span>}
                        </div>

                        <div className="bg-white/80 p-3 rounded-xl border border-slate-200/80 shadow-xs">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">{t('Chief Complaints (c/o)', 'मुख्य लक्षण', 'அறிகுறிகள்', 'ప్రధాన లక్షణాలు')}</span>
                          <p className="text-sm font-extrabold text-slate-800 capitalize">{det.complaints || t('Not recorded on slip', 'पर्चे पर दर्ज नहीं', 'குறிப்பிடப்படவில்லை', 'పేర్కొనబడలేదు')}</p>
                        </div>

                        <div className="bg-blue-50/70 p-3 rounded-xl border border-blue-200/80 shadow-xs sm:col-span-2">
                          <span className="text-[10px] uppercase font-bold text-blue-700 block">{t('Diagnosis / Clinical Impression (Imp)', 'निदान / बीमारी', 'நோய் கண்டறிதல்', 'వ్యాధి నిర్ధారణ')}</span>
                          <p className="text-sm font-black text-blue-950">{det.diagnosis || t('Clinical evaluation / Consultation record', 'चिकित्सीय मूल्यांकन / परामर्श', 'மருத்துவ மதிப்பீடு', 'క్లినికల్ మూల్యాంకనం')}</p>
                        </div>
                      </div>

                      {/* Clinical Vitals Bar */}
                      {det.vitals && (
                        <div className="bg-white p-3 rounded-xl border border-slate-200 flex flex-wrap items-center gap-3 text-xs font-bold shadow-xs">
                          <span className="text-slate-400 uppercase text-[10px] font-black tracking-wider">{t('Examination Vitals (o/e):', 'जांच रिपोर्ट:', 'பரிசோதனை:', 'పరీక్ష:')}</span>
                          {det.vitals.bp && (
                            <span className="bg-slate-100 px-2.5 py-1 rounded-lg text-slate-800">
                              BP: <strong className="text-blue-900">{det.vitals.bp}</strong>
                            </span>
                          )}
                          {det.vitals.pulse && (
                            <span className="bg-slate-100 px-2.5 py-1 rounded-lg text-slate-800">
                              Pulse: <strong className="text-blue-900">{det.vitals.pulse}</strong>
                            </span>
                          )}
                          {det.vitals.rbs && (
                            <span className="bg-red-50 text-red-700 border border-red-200 px-2.5 py-1 rounded-lg">
                              RBS: <strong className="font-mono">{det.vitals.rbs}</strong>
                            </span>
                          )}
                        </div>
                      )}

                      {/* Prescribed Medications & Regimen */}
                      {det.medications && det.medications.length > 0 && (
                        <div className="space-y-2">
                          <span className="text-xs font-extrabold text-slate-700 flex items-center gap-1.5">
                            <Pill className="w-3.5 h-3.5 text-emerald-600" />
                            <span>{t('Prescribed Medications & Advice (Adv):', 'पर्चे की दवाइयाँ व सलाह:', 'பரிந்துரைக்கப்பட்ட மருந்துகள்:', 'సూచించిన మందులు & సలహాలు:')}</span>
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                            {det.medications.map((m: any, mIdx: number) => (
                              <div key={mIdx} className="bg-white p-3 rounded-xl border border-emerald-200 shadow-xs flex flex-col justify-between">
                                <div>
                                  <h5 className="font-black text-slate-900 text-xs">{m.name}</h5>
                                  <div className="flex items-center gap-1 mt-1">
                                    {m.route && <span className="text-[9px] font-black text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded">{m.route}</span>}
                                    {m.dosage && <span className="text-[10px] font-bold text-slate-600">{m.dosage}</span>}
                                  </div>
                                </div>
                                {m.instructions && (
                                  <p className="text-[11px] text-slate-500 mt-1 italic">{m.instructions}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Actions bar */}
                      <div className="flex flex-wrap items-center justify-between pt-2 border-t border-slate-100 text-xs gap-2">
                        <button
                          onClick={() => setShowRawOcr(!showRawOcr)}
                          className="text-blue-800 hover:underline font-bold flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>{showRawOcr ? t('Hide Raw Text', 'मूल टेक्स्ट छिपाएं', 'மறைக்கவும்', 'దాచు') : t('View Full OCR Transcription', 'पूरी पर्ची का टेक्स्ट देखें', 'முழு உரையைக் காண்க', 'పూర్తి టెక్స్ట్ చూడండి')}</span>
                        </button>

                        {onConsultDoctor && (
                          <button
                            onClick={onConsultDoctor}
                            className="py-1.5 px-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold flex items-center gap-1.5 transition-colors shadow-sm text-xs active:scale-95"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>{t('Consult Doctor with this Rx', 'इस पर्चे के साथ डॉक्टर से परामर्श करें', 'மருத்துவரிடம் செல்லவும்', 'వైద్యుని సంప్రదించండి')}</span>
                          </button>
                        )}
                      </div>

                      {showRawOcr && (
                        <div className="bg-slate-900 text-slate-200 p-4 rounded-2xl text-xs font-mono whitespace-pre-wrap max-h-60 overflow-y-auto">
                          {rx.notes}
                        </div>
                      )}
                    </div>
                  )
                }

                if ((rx as any).consultationData) {
                  const cons = (rx as any).consultationData
                  const meds = cons.medications || []
                  const isCompleted = cons.status === 'Consultation Completed' || cons.doctor_prescription

                  return (
                    <div
                      key={rx.id}
                      className="p-3.5 sm:p-6 rounded-2xl sm:rounded-3xl border-2 border-blue-600 bg-gradient-to-br from-blue-50/40 via-white to-indigo-50/30 shadow-md space-y-3 sm:space-y-4"
                    >
                      {/* Doctor & Facility Header */}
                      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b border-blue-100 pb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="bg-blue-900 text-white text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full shadow-sm">
                              {cons.token ? `Token: ${cons.token}` : 'OPD Consultation'}
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              isCompleted ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {cons.status || 'Active Consultation'}
                            </span>
                            <span className="text-xs font-bold text-slate-400 font-mono">
                              {cons.date || 'Today'}
                            </span>
                          </div>
                          <h4 className="text-base sm:text-lg font-black text-slate-900 mt-1">
                            {cons.doctor?.name || 'Consulting Physician'}
                          </h4>
                          <p className="text-xs text-slate-500">
                            {cons.doctor?.post || cons.doctor?.specialty} • Room {cons.doctor?.room || 'OPD'}
                          </p>
                        </div>

                        {cons.doctor?.fee && (
                          <div className="text-left sm:text-right">
                            <span className="text-[11px] font-bold text-slate-500 block">{t('Consultation Fee', 'परामर्श शुल्क', 'கட்டணம்', 'ఫీజు')}</span>
                            <span className="text-xs font-mono font-black text-emerald-800 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200 inline-block mt-0.5">
                              {cons.doctor.fee}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Chief Complaint & Diagnosis */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="bg-white/80 p-3 rounded-xl border border-slate-200/80 shadow-xs">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">{t('Patient Name', 'रोगी का नाम', 'நோயாளி பெயர்', 'రోగి పేరు')}</span>
                          <p className="text-sm font-black text-slate-800">{cons.patient_name || patient.full_name}</p>
                          {cons.token && <span className="text-[10px] font-mono text-blue-900 font-bold block">Token: {cons.token}</span>}
                        </div>

                        <div className="bg-white/80 p-3 rounded-xl border border-slate-200/80 shadow-xs">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">{t('Chief Complaint', 'मुख्य लक्षण', 'அறிகுறிகள்', 'ప్రధాన లక్షణాలు')}</span>
                          <p className="text-sm font-extrabold text-slate-800 capitalize">{cons.chief_complaint || 'General Consultation'}</p>
                        </div>

                        <div className="bg-blue-50/80 p-3 rounded-xl border border-blue-200 shadow-xs sm:col-span-2">
                          <span className="text-[10px] uppercase font-bold text-blue-700 block">{t('Confirmed Diagnosis / Clinical Assessment', 'पुष्टीकृत निदान / बीमारी', 'நோய் கண்டறிதல்', 'వ్యాధి నిర్ధారణ')}</span>
                          <p className="text-sm font-black text-blue-950">{cons.confirmed_diagnosis || cons.provisional_diagnosis || 'Under Clinical Evaluation'}</p>
                        </div>
                      </div>

                      {/* Prescribed Medications */}
                      {meds.length > 0 && (
                        <div className="space-y-2">
                          <span className="text-xs font-extrabold text-slate-700 flex items-center gap-1.5">
                            <Pill className="w-3.5 h-3.5 text-emerald-600" />
                            <span>{t('Prescribed Medications:', 'परामर्शित दवाइयाँ:', 'பரிந்துரைக்கப்பட்ட மருந்துகள்:', 'సూచించిన మందులు:')}</span>
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                            {meds.map((m: any, mIdx: number) => (
                              <div key={mIdx} className="bg-white p-3 rounded-xl border border-blue-200 shadow-xs flex flex-col justify-between">
                                <div>
                                  <h5 className="font-black text-slate-900 text-xs">{m.name}</h5>
                                  <div className="flex items-center gap-1 mt-1 flex-wrap">
                                    {m.dosage && <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">{m.dosage}</span>}
                                    {m.frequency && <span className="text-[10px] font-black text-blue-800 bg-blue-50 px-1.5 py-0.5 rounded">{m.frequency}</span>}
                                    {m.duration && <span className="text-[10px] font-medium text-slate-500">{m.duration}</span>}
                                  </div>
                                </div>
                                {m.instructions && (
                                  <p className="text-[11px] text-slate-500 mt-1 italic">{m.instructions}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Doctor Notes & Advice */}
                      {(cons.doctor_notes || cons.follow_up) && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                          {cons.follow_up && (
                            <div className="bg-emerald-50/60 p-3 rounded-xl border border-emerald-200 text-xs">
                              <span className="text-[10px] uppercase font-black text-emerald-800 block">{t('Follow-up Advice:', 'अनुवर्ती सलाह:', 'அறிவுரை:', 'సలహా:')}</span>
                              <p className="font-bold text-emerald-950 mt-0.5">{cons.follow_up}</p>
                            </div>
                          )}
                          {cons.doctor_notes && (
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                              <span className="text-[10px] uppercase font-black text-slate-500 block">{t('Doctor Notes:', 'डॉक्टर नोट्स:', 'மருத்துவர் குறிப்புகள்:', 'వైద్యుల నోట్స్:')}</span>
                              <p className="font-medium text-slate-800 mt-0.5">{cons.doctor_notes}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                }

                return null
              })}
            </div>
          ) : (
            <div className="text-center py-10 px-4 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50 flex flex-col items-center justify-center gap-3">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                <FileText className="w-6 h-6" />
              </div>
              <div className="max-w-md">
                <h4 className="text-sm font-extrabold text-slate-800">
                  {t('No Digitized Prescriptions on Record', 'कोई डिजिटल पर्चा दर्ज नहीं है', 'மருந்துச்சீட்டு ஏதும் இல்லை', 'డిజిటలైజ్డ్ ప్రిస్క్రిప్షన్‌లు ఏవీ లేవు')}
                </h4>
                <p className="text-xs text-slate-500 mt-1">
                  {t('Capture or upload your doctor prescription slip to extract diagnosis, doctor details, and clinical notes automatically.', 'निदान और डॉक्टर के परामर्श को स्वतः रिकॉर्ड करने के लिए पर्चा स्कैन करें।', 'நோயறிதல் மற்றும் மருத்துவர் விவரங்களை எடுக்க மருந்துச்சீட்டைப் பதிவேற்றவும்.', 'వ్యాధి నిర్ధారణ మరియు డాక్టర్ వివరాలను సేకరించడానికి ప్రిస్క్రిప్షన్‌ను అప్‌లోడ్ చేయండి.')}
                </p>
              </div>
              {onScanNewPrescription && (
                <button
                  onClick={onScanNewPrescription}
                  className="mt-1 px-4 py-2 bg-blue-800 hover:bg-blue-900 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>{t('Scan Prescription', 'पर्चा स्कैन करें', 'மருந்துச்சீட்டு ஸ்கேன்', 'ప్రిస్క్రిప్షన్ స్కాన్')}</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* SECTION 3: LAB & DIAGNOSTIC TESTS */}
      {(activeSubTab === 'all' || activeSubTab === 'reports') && (
        <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-lg sm:shadow-xl border-2 border-slate-100 space-y-3 sm:space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
              <Activity className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600" />
              <span>{t('Diagnostic Laboratory Reports', 'पैथोलॉजी व डायग्नोस्टिक रिपोर्ट', 'ஆய்வக சோதனைகள்', 'ల్యాబ్ డయాగ్నస్టిక్ నివేదికలు')}</span>
            </h3>
            {labReports.length > 0 && (
              <span className="text-xs font-bold text-slate-400">
                {labReports.length} {t('Reports on record', 'रिपोर्ट दर्ज', 'அறிக்கைகள்', 'నివేదికలు రికార్డు')}
              </span>
            )}
          </div>

          {labReports.length > 0 ? (
            <div className="space-y-3">
              {labReports.map((lab) => (
                <div
                  key={lab.id}
                  className="p-4 rounded-2xl border-2 border-slate-100 hover:border-indigo-300 bg-white transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-black text-slate-900">{lab.title}</h4>
                      <span className="bg-emerald-50 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-md border border-emerald-200">
                        {lab.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium">
                      {lab.facility} • <span className="text-slate-400">{lab.date}</span>
                    </p>
                    <p className="text-xs font-mono font-bold text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-100">
                      {lab.summary}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10 px-4 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50 flex flex-col items-center justify-center gap-3">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                <Activity className="w-6 h-6" />
              </div>
              <div className="max-w-md">
                <h4 className="text-sm font-extrabold text-slate-800">
                  {t('No Diagnostic Laboratory Reports on Record', 'कोई लैब रिपोर्ट दर्ज नहीं है', 'ஆய்வக அறிக்கைகள் ஏதும் இல்லை', 'ల్యాబ్ నివేదికలు ఏవీ రికార్డు కాలేదు')}
                </h4>
                <p className="text-xs text-slate-500 mt-1">
                  {t('Pathology tests, point-of-care blood sugar, and diagnostic reports linked through ABDM Health Exchange will appear here.', 'एबीएचए से जुड़े पैथोलॉजी एवं डायग्नोस्टिक टेस्ट रिपोर्ट यहाँ प्रदर्शित होंगे।', 'ABDM மூலம் இணைக்கப்பட்ட பரிசோதனை அறிக்கைகள் இங்கே தோன்றும்.', 'ABDM ద్వారా లింక్ చేయబడిన డయాగ్నస్టిక్ నివేదికలు ఇక్కడ కనిపిస్తాయి.')}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ABDM Security Footer Note */}
      <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between text-xs text-emerald-950 font-medium">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0" />
          <span>{t('Health records are encrypted under ABDM consent framework & DPDP Act 2023.', 'स्वास्थ्य रिकॉर्ड सुरक्षित और एन्क्रिप्टेड हैं।', 'மருத்துவப் பதிவுகள் பாதுகாப்பாக என்க்ரிப்ட் செய்யப்பட்டுள்ளன.', 'ఆరోగ్య రికార్డులు సురక్షితంగా గుప్తీకరించబడ్డాయి.')}</span>
        </div>
        <span className="font-mono text-[10px] text-emerald-800 hidden sm:inline font-bold">ABDM Consent: ACTIVE</span>
      </div>
    </div>
  )
}
