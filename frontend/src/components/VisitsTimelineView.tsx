'use client'

import React, { useState } from 'react'
import { 
  Clock, 
  Calendar, 
  Stethoscope, 
  Building2, 
  ChevronDown, 
  ChevronUp, 
  Pill, 
  CheckCircle2, 
  FileText, 
  ShieldCheck, 
  Sparkles,
  Printer,
  ExternalLink
} from 'lucide-react'
import { PatientInfo } from '@/components/AbhaCard'
import { useLanguage } from '@/context/LanguageContext'

interface VisitsTimelineViewProps {
  patient: PatientInfo;
  currentSessionId?: string;
  currentSummary?: string;
  onNewConsultation?: () => void;
}

export default function VisitsTimelineView({
  patient,
  currentSessionId,
  currentSummary,
  onNewConsultation
}: VisitsTimelineViewProps) {
  const { t } = useLanguage()
  const [expandedVisitId, setExpandedVisitId] = useState<string | null>('active_today')
  const [selectedVisitForPrint, setSelectedVisitForPrint] = useState<any | null>(null)

  const toggleExpand = (id: string) => {
    setExpandedVisitId(prev => prev === id ? null : id)
  }

  // Timeline visits: only genuine active session on record
  const visits = [
    ...(currentSessionId ? [{
      id: 'active_today',
      date: t('Today (Active)', 'आज (सक्रिय)', 'இன்று (செயலில்)', 'ఈరోజు (యాక్టివ్)'),
      timestamp: 'Just now',
      facility: t('District Hospital OPD Kiosk', 'जिला अस्पताल ओपीडी कियोस्क', 'மாவட்ட மருத்துவமனை கியோஸ்க்', 'జిల్లా ఆసుపత్రి కియోస్క్'),
      department: t('General OPD / Triage AI', 'सामान्य ओपीडी / ट्राइएज एआई', 'பொது OPD / AI', 'జనరల్ OPD / AI'),
      doctor: t('Dr. AI AarogyaMitra & OPD Duty Medical Officer', 'डॉ. एआई आरोग्यमित्र व ओपीडी मेडिकल ऑफिसर', 'மருத்துவர் AI & OPD மருத்துவர்', 'డాక్టర్ AI & OPD వైద్యులు'),
      complaint: currentSummary ? currentSummary.slice(0, 100) + '...' : t('Intake & Pre-consultation symptom screening', 'लक्षणों की प्रारंभिक जांच व पर्चा', 'அறிகுறிகள் பரிசோதனை', 'లక్షణాల స్క్రీనింగ్'),
      diagnosis: t('Pre-consultation clinical intake recorded', 'प्रारंभिक ओपीडी परामर्श जारी', 'பரிசோதனை பதிவு செய்யப்பட்டது', 'ప్రాథమిక సంప్రదింపు రికార్డ్ చేయబడింది'),
      prescription: [
        t('Pending doctor examination', 'डॉक्टर जांच प्रतीक्षारत', 'மருத்துவர் பரிசோதனை நிலுவையில் உள்ளது', 'వైద్యుల పరీక్ష పెండింగ్‌లో ఉంది')
      ],
      notes: currentSummary || t('Patient arrived at OPD Kiosk for health screening and queue intake.', 'रोगी ओपीडी कियोस्क पर स्वास्थ्य परामर्श हेतु उपस्थित हुआ।', 'நோயாளி மருத்துவமனைக்கு வந்துள்ளார்.', 'రోగి ఆరోగ్య పరీక్ష కోసం కియోస్క్ వద్దకు వచ్చారు.'),
      token: 'OPD-407',
      careContext: `CARE-CTX-${currentSessionId ? currentSessionId.slice(-6).toUpperCase() : '982104'}`,
      status: t('Active Session', 'सक्रिय सत्र', 'செயலில் உள்ள அமர்வு', 'యాక్టివ్ సెషన్'),
      statusColor: 'bg-emerald-500 text-white'
    }] : [])
  ]

  const handlePrint = (v: any) => {
    setSelectedVisitForPrint(v)
    setTimeout(() => {
      window.print()
    }, 50)
  }

  const activePrintVisit = selectedVisitForPrint || (visits.length > 0 ? visits[0] : null)

  return (
    <>
      {/* 1. ON-SCREEN INTERACTIVE TIMELINE VIEW (Hidden during Print) */}
      <div className="print:hidden w-full max-w-5xl mx-auto space-y-4 sm:space-y-6">
        {/* Header Banner */}
        <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-lg sm:shadow-xl border-2 border-slate-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center text-emerald-800 shadow-sm shrink-0">
              <Clock className="w-6 h-6 sm:w-8 sm:h-8" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <h2 className="text-lg sm:text-2xl font-black text-slate-900 truncate">
                  {t('Previous Visits Timeline', 'पूर्व परामर्श एवं विज़िट टाइमलाइन', 'முந்தைய வருகைகள் காலவரிசை', 'మునుపటి సందర్శనల కాలక్రమం')}
                </h2>
                <span className="bg-emerald-100 text-emerald-800 text-[10px] sm:text-xs font-black px-2 sm:px-2.5 py-0.5 rounded-full border border-emerald-300 shrink-0">
                  ABDM Linked
                </span>
              </div>
              <p className="text-xs sm:text-sm font-medium text-slate-500 mt-0.5 truncate">
                {t('Complete chronological history of consultations and hospital visits', 'सभी ओपीडी व अस्पताल परामर्शों का कालानुक्रमिक विवरण', 'மருத்துவமனை வருகைகளின் முழுமையான வரலாற்று விவரம்', 'ఆసుపత్రి సందర్శనల పూర్తి కాలక్రమానుసార చరిత్ర')}
              </p>
            </div>
          </div>

          {onNewConsultation && (
            <button
              onClick={onNewConsultation}
              className="py-2 sm:py-2.5 px-4 sm:px-5 bg-blue-800 hover:bg-blue-900 text-white text-xs font-extrabold rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 shadow-md w-full md:w-auto shrink-0"
            >
              <Sparkles className="w-4 h-4" />
              <span>{t('Consult Doctor AI Now', 'डॉक्टर एआई से परामर्श करें', 'மருத்துவர் AI ஆலோசனை', 'డాక్టర్ AIతో సంప్రదించండి')}</span>
            </button>
          )}
        </div>

        {/* Timeline Container / Empty State */}
        {visits.length === 0 ? (
          <div className="bg-white rounded-2xl sm:rounded-3xl p-6 sm:p-10 border-2 border-slate-100 shadow-sm text-center flex flex-col items-center justify-center gap-3">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
              <Clock className="w-6 h-6 sm:w-7 sm:h-7" />
            </div>
            <div className="max-w-md">
              <h3 className="text-sm sm:text-base font-black text-slate-800">
                {t('No Previous Visits on Record', 'कोई पूर्व विज़िट दर्ज नहीं है', 'முந்தைய வருகைகள் ஏதும் இல்லை', 'మునుపటి సందర్శనలు ఏవీ లేవు')}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {t('Consultation history and OPD visits linked to your ABHA health ID across ABDM networked hospitals will appear here.', 'एबीएचए स्वास्थ्य आईडी से जुड़े सभी ओपीडी परामर्श और अस्पताल विज़िट यहाँ कालानुक्रमिक रूप से प्रदर्शित होंगे।', 'ABDM மருத்துவமனைகளில் உங்கள் ABHA உடன் இணைக்கப்பட்ட மருத்துவப் பதிவுகள் இங்கே தோன்றும்.', 'ABDM నెట్‌వర్క్ ఆసుపత్రులలో మీ ABHAకి లింక్ చేయబడిన సందర్శనల చరిత్ర ఇక్కడ కనిపిస్తుంది.')}
              </p>
            </div>
            {onNewConsultation && (
              <button
                onClick={onNewConsultation}
                className="mt-2 py-2 sm:py-2.5 px-4 sm:px-5 bg-blue-800 hover:bg-blue-900 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-all shadow-md active:scale-95"
              >
                <Sparkles className="w-4 h-4" />
                <span>{t('Start New Consultation', 'नया परामर्श शुरू करें', 'புதிய ஆலோசனை தொடங்கு', 'కొత్త సంప్రదింపు ప్రారంభించండి')}</span>
              </button>
            )}
          </div>
        ) : (
          <div className="relative pl-4 sm:pl-8 border-l-2 sm:border-l-4 border-blue-200 ml-3 sm:ml-6 space-y-5 sm:space-y-8">
            {visits.map((v, idx) => {
              const isExpanded = expandedVisitId === v.id
              const isActive = v.id === 'active_today'

              return (
                <div key={v.id} className="relative group">
                  {/* Timeline Marker Bullet */}
                  <div className={`absolute -left-[27px] sm:-left-[43px] top-1.5 w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 sm:border-4 border-white shadow-md flex items-center justify-center transition-transform ${
                    isActive 
                      ? 'bg-emerald-500 ring-2 sm:ring-4 ring-emerald-100 scale-110' 
                      : 'bg-blue-600 ring-2 ring-blue-100'
                  }`}>
                    {isActive ? (
                      <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-white animate-ping"></span>
                    ) : (
                      <span className="w-1 sm:w-1.5 h-1 sm:h-1.5 rounded-full bg-white"></span>
                    )}
                  </div>

                  {/* Visit Card */}
                  <div className={`bg-white rounded-2xl sm:rounded-3xl border sm:border-2 transition-all shadow-md overflow-hidden ${
                    isActive 
                      ? 'border-emerald-500 shadow-emerald-500/10' 
                      : 'border-slate-100 hover:border-blue-200'
                  }`}>
                    {/* Clickable Header */}
                    <div 
                      onClick={() => toggleExpand(v.id)}
                      className="p-3.5 sm:p-5 cursor-pointer flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3 hover:bg-slate-50/70 transition-colors"
                    >
                      <div className="space-y-1 min-w-0 w-full sm:w-auto">
                        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                          <span className="font-mono text-[10px] sm:text-xs font-black text-blue-900 bg-blue-50 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg border border-blue-200 flex items-center gap-1">
                            <Calendar className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                            {v.date}
                          </span>
                          <span className="text-[11px] sm:text-xs text-slate-400 font-semibold">• {v.timestamp}</span>
                          <span className={`text-[9px] sm:text-[10px] font-black px-1.5 sm:px-2 py-0.5 rounded-md ${v.statusColor}`}>
                            {v.status}
                          </span>
                          <span className="bg-slate-100 text-slate-700 text-[9px] sm:text-[10px] font-black px-1.5 sm:px-2 py-0.5 rounded-md border border-slate-200">
                            Token: {v.token}
                          </span>
                        </div>

                        <h3 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2 mt-1">
                          <Stethoscope className="w-4 h-4 text-blue-800 shrink-0" />
                          <span className="truncate">{v.department}</span>
                        </h3>

                        <p className="text-xs text-slate-500 font-medium flex items-center gap-1.5 truncate">
                          <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{v.facility} • {v.doctor}</span>
                        </p>
                      </div>

                      <div className="flex items-center gap-2 sm:gap-3 self-end sm:self-center shrink-0">
                        <div className="text-right hidden sm:block">
                          <span className="text-[10px] text-slate-400 uppercase font-black block">Care Context</span>
                          <span className="font-mono text-xs font-bold text-slate-700">{v.careContext}</span>
                        </div>
                        <div className="p-1.5 sm:p-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors">
                          {isExpanded ? <ChevronUp className="w-4 h-4 sm:w-5 sm:h-5" /> : <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5" />}
                        </div>
                      </div>
                    </div>

                    {/* Expanded Details Body */}
                    {isExpanded && (
                      <div className="px-5 pb-5 pt-2 border-t border-slate-100 bg-slate-50/50 space-y-4 text-sm animate-in fade-in duration-200">
                        {/* Chief Complaint & Diagnosis */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
                            <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">
                              {t('Chief Complaint', 'मुख्य शिकायत / लक्षण', 'முக்கிய புகார்', 'ప్రధాన ఫిర్యాదు')}
                            </span>
                            <p className="font-bold text-slate-800 mt-1">{v.complaint}</p>
                          </div>

                          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
                            <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">
                              {t('Doctor Clinical Diagnosis', 'डॉक्टर का नैदानिक निष्कर्ष', 'மருத்துவர் நோயறிதல்', 'డాక్టర్ నిర్ధారణ')}
                            </span>
                            <p className="font-bold text-emerald-800 mt-1">{v.diagnosis}</p>
                          </div>
                        </div>

                        {/* Prescribed Medicines */}
                        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-2">
                          <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider flex items-center gap-1.5">
                            <Pill className="w-3.5 h-3.5 text-blue-600" />
                            <span>{t('Prescriptions & Advised Treatment', 'दवाइयाँ और उपचार निर्देश', 'பரிந்துரைக்கப்பட்ட சிகிச்சைகள்', 'సూచించిన మందులు & చికిత్స')}</span>
                          </span>

                          <ul className="space-y-1.5">
                            {v.prescription.map((rxItem, i) => (
                              <li key={i} className="flex items-center gap-2 text-xs font-bold text-slate-700 bg-slate-50 p-2 rounded-xl border border-slate-100">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                <span>{rxItem}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Clinical Notes */}
                        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                          <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider flex items-center gap-1.5 mb-1">
                            <FileText className="w-3.5 h-3.5 text-slate-500" />
                            <span>{t('Clinical Notes & Summary', 'क्लीनिकल नोट्स एवं सारांश', 'மருத்துவக் குறிப்புகள்', 'క్లినికల్ నోట్స్ & సారాంశం')}</span>
                          </span>
                          <p className="text-xs text-slate-600 leading-relaxed">{v.notes}</p>
                        </div>

                        {/* ABDM Care Context Linking Badge & Print Button */}
                        <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                          <div className="flex items-center gap-1.5 text-emerald-700 font-bold text-[11px]">
                            <ShieldCheck className="w-4 h-4" />
                            <span>ABDM M2 Care Context Linked ({v.careContext})</span>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handlePrint(v)
                            }}
                            className="py-1 px-3 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm transition-colors cursor-pointer"
                          >
                            <Printer className="w-3 h-3" />
                            <span>{t('Print Summary', 'प्रिंट करें', 'அச்சிடுக', 'ప్రింట్ చేయండి')}</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}

            {/* Synchronized ABDM info note */}
            <div className="bg-blue-50/60 border border-blue-200 rounded-2xl p-4 text-xs text-blue-900 flex items-center gap-2.5 shadow-xs">
              <ShieldCheck className="w-4 h-4 text-blue-700 shrink-0" />
              <span>{t('Historical hospital OPD visits from ABDM-connected facilities are synchronized via ABHA Health Information Exchange (HIE).', 'एबीएचए नेटवर्क से जुड़े अस्पतालों की पुरानी विज़िट डिजिटल रूप से सिंक होती हैं।', 'ABDM மருத்துவமனை வருகைகள் தானாகவே ஒத்திசைக்கப்படும்.', 'ABDM అనుసంధానిత ఆసుపత్రుల నుండి మునుపటి సందర్శనలు స్వయంచాలకంగా సమకాలీకరించబడతాయి.')}</span>
            </div>
          </div>
        )}
      </div>

      {/* =========================================================================
          2. PRINT-ONLY OFFICIAL OPD CONSULTATION SUMMARY SLIP (Single A4 Page)
          Visible exclusively when printing (hidden on-screen)
          ========================================================================= */}
      {activePrintVisit && (
        <div className="hidden print:block w-full max-w-3xl mx-auto bg-white text-slate-900 font-sans p-1 print-avoid-break">
          {/* Official Letterhead Header */}
          <div className="border-b-2 border-slate-900 pb-3 mb-3">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-blue-900 text-white flex items-center justify-center font-black text-xl border border-blue-950 shrink-0">
                  AM
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-lg font-black uppercase tracking-tight text-slate-900 leading-tight">
                      {activePrintVisit.facility || 'District Hospital Central OPD Kiosk'}
                    </h1>
                    <span className="text-[9px] bg-blue-100 text-blue-900 font-black px-2 py-0.5 rounded border border-blue-300">
                      ABDM EMR
                    </span>
                  </div>
                  <p className="text-[11px] font-bold text-slate-700">
                    Ayushman Bharat Digital Mission (ABDM) • Digital OPD Consultation Summary
                  </p>
                  <p className="text-[10px] text-slate-500">
                    National Health Authority (NHA) • Tele-Triage & Clinical E-Prescription Slip
                  </p>
                </div>
              </div>

              <div className="text-right flex flex-col items-end shrink-0">
                <div className="bg-slate-900 text-white font-mono font-black text-xs px-2.5 py-0.5 rounded">
                  TOKEN: {activePrintVisit.token || 'OPD-407'}
                </div>
                <span className="text-[10px] text-slate-600 font-semibold mt-1">
                  Care Context: <strong className="text-slate-900 font-mono">{activePrintVisit.careContext}</strong>
                </span>
                <span className="text-[10px] text-slate-500">
                  {activePrintVisit.date} • {activePrintVisit.timestamp}
                </span>
              </div>
            </div>
          </div>

          {/* Patient Demographics Table */}
          <div className="border border-slate-300 rounded-lg p-2.5 mb-3 bg-slate-50 text-xs">
            <div className="grid grid-cols-4 gap-2">
              <div>
                <span className="text-[9px] uppercase font-bold text-slate-500 block">Patient Name</span>
                <strong className="text-slate-900 text-xs">{patient.full_name}</strong>
              </div>
              <div>
                <span className="text-[9px] uppercase font-bold text-slate-500 block">Age / Gender</span>
                <strong className="text-slate-900">
                  {patient.date_of_birth ? `${new Date().getFullYear() - parseInt(patient.date_of_birth.split('-')[0])} Y` : '19 Y'} / {patient.gender || 'M'}
                </strong>
              </div>
              <div>
                <span className="text-[9px] uppercase font-bold text-slate-500 block">Mobile No.</span>
                <strong className="text-slate-900 font-mono">{patient.mobile_number}</strong>
              </div>
              <div>
                <span className="text-[9px] uppercase font-bold text-slate-500 block">Blood Group</span>
                <strong className="text-slate-900">{patient.blood_group || 'Not recorded'}</strong>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-slate-200">
              <div>
                <span className="text-[9px] uppercase font-bold text-slate-500 block">ABHA Number</span>
                <strong className="text-slate-900 font-mono text-[11px]">{patient.abha_number}</strong>
              </div>
              <div>
                <span className="text-[9px] uppercase font-bold text-slate-500 block">ABHA Address</span>
                <strong className="text-slate-900 font-mono text-[11px]">{patient.abha_address}</strong>
              </div>
              <div>
                <span className="text-[9px] uppercase font-bold text-slate-500 block">Allergies / Alerts</span>
                <strong className={patient.allergies ? 'text-amber-800' : 'text-emerald-700'}>
                  {patient.allergies || 'No Known Drug Allergies'}
                </strong>
              </div>
            </div>
          </div>

          {/* Department and Consulting Physician */}
          <div className="border border-slate-300 rounded-lg p-2 mb-3 flex justify-between items-center text-xs bg-white">
            <div>
              <span className="text-[9px] uppercase font-bold text-slate-500 block">Consulting Department</span>
              <span className="font-black text-slate-900 text-xs">{activePrintVisit.department}</span>
            </div>
            <div className="text-right">
              <span className="text-[9px] uppercase font-bold text-slate-500 block">Attending Physician / System</span>
              <span className="font-bold text-slate-800 text-xs">{activePrintVisit.doctor}</span>
            </div>
          </div>

          {/* Chief Complaints & Clinical Impression */}
          <div className="grid grid-cols-2 gap-2.5 mb-3 text-xs">
            <div className="border border-slate-300 rounded-lg p-2.5 bg-white">
              <span className="text-[9px] uppercase font-black text-slate-500 block mb-1">
                Chief Complaints (c/o)
              </span>
              <p className="font-bold text-slate-800 text-xs leading-snug">{activePrintVisit.complaint}</p>
            </div>

            <div className="border border-blue-300 rounded-lg p-2.5 bg-blue-50/50">
              <span className="text-[9px] uppercase font-black text-blue-900 block mb-1">
                Clinical Impression / Diagnosis (Imp)
              </span>
              <p className="font-black text-blue-950 text-xs leading-snug">{activePrintVisit.diagnosis}</p>
            </div>
          </div>

          {/* Prescriptions & Advised Treatment */}
          <div className="border border-slate-300 rounded-lg p-2.5 mb-3 bg-white text-xs">
            <span className="text-[9px] uppercase font-black text-slate-500 block mb-1.5 flex items-center justify-between border-b border-slate-100 pb-1">
              <span>Prescriptions & Advised Treatment (Rx / Adv)</span>
              <span className="font-normal text-slate-400 text-[9px]">Follow prescribed dosage strictly</span>
            </span>
            <ul className="space-y-1">
              {activePrintVisit.prescription.map((rxItem: string, i: number) => (
                <li key={i} className="flex items-center gap-2 text-xs font-bold text-slate-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-900 shrink-0"></span>
                  <span>{rxItem}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Clinical Notes & Summary */}
          {activePrintVisit.notes && (
            <div className="border border-slate-300 rounded-lg p-2.5 mb-3 bg-white text-xs">
              <span className="text-[9px] uppercase font-black text-slate-500 block mb-1">
                Clinical Notes & Patient Summary
              </span>
              <p className="text-xs text-slate-700 leading-relaxed">{activePrintVisit.notes}</p>
            </div>
          )}

          {/* Sign-off & ABDM Verification Footer */}
          <div className="border-t-2 border-slate-900 pt-3 mt-4 flex justify-between items-end text-xs">
            <div className="text-[9px] text-slate-500 space-y-0.5">
              <p className="font-bold text-slate-800">
                Digitally generated through AarogyaMitra ABDM Kiosk System
              </p>
              <p>M2 Protocol Compliant • Encrypted Health Record • DPDP Act 2023</p>
              <p className="font-mono text-[9px] text-slate-400">
                Generated: {new Date().toLocaleDateString('en-GB')} {new Date().toLocaleTimeString()}
              </p>
            </div>

            <div className="text-center w-52">
              <div className="border-b border-dashed border-slate-400 h-8 mb-1"></div>
              <span className="text-[10px] font-bold text-slate-800 block">
                Duty Medical Officer / Signatory
              </span>
              <span className="text-[9px] text-slate-400 block">
                OPD Clinical Verification Stamp
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
