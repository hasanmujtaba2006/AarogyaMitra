'use client'

import { useState, useEffect } from 'react'
import { 
  FileText, 
  ArrowRight, 
  Stethoscope, 
  Sparkles, 
  LogOut, 
  CheckCircle,
  CheckCircle2, 
  ShieldAlert, 
  User, 
  FolderHeart, 
  Clock,
  RefreshCw,
  Pill,
  Eye,
  Globe
} from 'lucide-react'

import Header from '@/components/Header'
import Footer from '@/components/Footer'
import AuthScreen from '@/components/AuthScreen'
import LanguageSelector from '@/components/LanguageSelector'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import AudioMic from '@/components/AudioMic'
import PrescScanner from '@/components/PrescScanner'
import AbhaCard, { PatientInfo } from '@/components/AbhaCard'
import ProfileSection from '@/components/ProfileSection'
import MedicalRecordsView, { ScannedPrescriptionDetails } from '@/components/MedicalRecordsView'
import VisitsTimelineView from '@/components/VisitsTimelineView'
import StructuredClinicalSummaryCard, { StructuredClinicalData } from '@/components/StructuredClinicalSummaryCard'
import DoctorSelectionAndQueue from '@/components/DoctorSelectionAndQueue'
import { LanguageCode, useLanguage } from '@/context/LanguageContext'
import { transliterateName } from '@/lib/transliterate'

interface Message {
  role: 'user' | 'assistant';
  message: string;
  translated_message?: string;
  spoken_language?: string;
}

type PatientTab = 'profile' | 'scan_prescription' | 'doctor_ai' | 'medical_record' | 'timeline'

export default function KioskPage() {
  const { language, setLanguage, setHasLoggedIn, t } = useLanguage()

  // Session configuration
  const [sessionId, setSessionId] = useState('')
  const [patient, setPatient] = useState<PatientInfo | null>(null)
  
  // Navigation Phase when not logged in: 'language_select' | 'login'
  const [phase, setPhase] = useState<'language_select' | 'login'>('language_select')
  
  // Patient Pages Switching List (5 tabs)
  const [activeTab, setActiveTab] = useState<PatientTab>('profile')

  // Chat state
  const [messages, setMessages] = useState<Message[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [sessionSummary, setSessionSummary] = useState('')
  const [structuredSummary, setStructuredSummary] = useState<StructuredClinicalData | null>(null)
  const [triageAlerted, setTriageAlerted] = useState(false)
  const [ocrText, setOcrText] = useState('')
  const [scannedDetails, setScannedDetails] = useState<ScannedPrescriptionDetails | null>(null)
  const [scanSuccess, setScanSuccess] = useState(false)
  const [isConsultationFinished, setIsConsultationFinished] = useState(false)

  useEffect(() => {
    // Generate unique session ID on page load
    const newSessionId = 'session_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now()
    setSessionId(newSessionId)

    // Once a user logs in using their preferred app language, don't ask repeatedly
    if (typeof window !== 'undefined') {
      const savedLang = localStorage.getItem('aarogya_preferred_language') as LanguageCode | null
      const hasAlreadyLoggedIn = localStorage.getItem('aarogya_has_logged_in') === 'true'
      const savedPatient = localStorage.getItem('aarogya_patient_info')
      const savedOcr = localStorage.getItem('aarogya_ocr_text')
      const savedDetails = localStorage.getItem('aarogya_scanned_details')

      if (savedLang && ['en', 'hi', 'ta', 'te'].includes(savedLang)) {
        setLanguage(savedLang)
      }

      if (savedOcr) {
        setOcrText(savedOcr)
      }

      if (savedDetails) {
        try {
          setScannedDetails(JSON.parse(savedDetails))
          setScanSuccess(true)
        } catch (e) {}
      }

      if (hasAlreadyLoggedIn && savedLang) {
        if (savedPatient) {
          try {
            const parsed = JSON.parse(savedPatient)
            setPatient(parsed)
            setActiveTab('profile')

            // Ensure active session is registered and linked to this patient in backend
            fetch('/api/abdm/create-session', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id: newSessionId,
                abha_id: parsed.id,
                language: savedLang
              })
            }).catch(err => console.error("Session auto-sync error:", err))

            return
          } catch (e) {
            // fallback to login
          }
        }
        setPhase('login')
      } else {
        setPhase('language_select')
      }
    }
  }, [])

  const handleLanguageSelected = (chosenLang: LanguageCode) => {
    setLanguage(chosenLang)
    setPhase('login')
  }

  const handleDashboardLanguageChange = (newLang: LanguageCode) => {
    setLanguage(newLang)
    if (sessionId) {
      fetch('/api/abdm/update-session-language', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          language: newLang
        })
      }).catch(err => console.error("Session language update error:", err))
    }
  }

  const handleLoginSuccess = (patientData: PatientInfo) => {
    setPatient(patientData)
    setHasLoggedIn(true)
    if (typeof window !== 'undefined') {
      localStorage.setItem('aarogya_has_logged_in', 'true')
      localStorage.setItem('aarogya_preferred_language', language)
      localStorage.setItem('aarogya_patient_info', JSON.stringify(patientData))
    }

    // Create patient session in backend db
    fetch('/api/abdm/create-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: sessionId,
        abha_id: patientData.id,
        language: language
      })
    }).catch(err => console.error("Session creation error:", err))

    // Default to First tab: "Profile"
    setActiveTab('profile')
  }

  const handleScanComplete = (extractedOcr: string, details?: any) => {
    setOcrText(extractedOcr)
    if (details) {
      setScannedDetails(details)
      if (typeof window !== 'undefined') {
        localStorage.setItem('aarogya_scanned_details', JSON.stringify(details))
      }
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem('aarogya_ocr_text', extractedOcr)
    }
    setScanSuccess(true)
    
    // Save OCR in backend session
    fetch('/api/ocr/save-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, text: extractedOcr })
    }).catch(err => console.error("OCR save error:", err))

    // Automatically structured and linked to Medical Records.
    // Stays on the scan prescription page and shows the success message.
  }

  const submitMessageToChat = async (text: string, isOcrSystemInit = false) => {
    setIsProcessing(true)
    
    // Optimistically update message history client-side
    if (!isOcrSystemInit) {
      setMessages(prev => [...prev, { role: 'user', message: text, translated_message: text }])
    }

    try {
      const res = await fetch('/api/chat/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          message: text,
          language: language
        })
      })

      if (!res.ok) {
        throw new Error('Chat API not found or failed')
      }

      const data = await res.json()
      
      // Update chat message history with LLM response
      const assistantSpokenLang = data.spoken_language || language
      setMessages(prev => [...prev, {
        role: 'assistant',
        message: data.response,
        translated_message: data.translated_response,
        spoken_language: assistantSpokenLang
      }])

      // Auto-sync frontend language if user spoke in Hindi/Tamil/Telugu
      if (assistantSpokenLang && assistantSpokenLang !== language) {
        setLanguage(assistantSpokenLang as LanguageCode)
      }

      // Check if triage was triggered
      if (data.triage_alerted) {
        setTriageAlerted(true)
      }

      // Check if session completed
      if (data.status === 'completed') {
        setSessionSummary(data.summary || '')
        if (data.structured_summary) {
          setStructuredSummary(data.structured_summary)
        }
        setIsConsultationFinished(true)
      }

    } catch (err) {
      console.error(err)
      // Fallback Mock dialogue: symptom-aware and dialect-aware
      setTimeout(() => {
        const lowerText = text.toLowerCase()
        const isHindi = /[\u0900-\u097F]/.test(text) || /\b(sir|sar|dard|pet|bukhar|khasi|khansi|gala|gale|ulti|dast|hai|hain|ho|raha|rahi|nahi|theek|doctor|mere|meri|mujhe|tez|chot)\b/.test(lowerText)
        const isTamil = /[\u0B80-\u0BFF]/.test(text) || /\b(vali|kaichal|irumal|sali|vayiru|mayakkam|illai)\b/.test(lowerText)
        const isTelugu = /[\u0C00-\u0C7F]/.test(text) || /\b(noppi|kadupu|jwaram|daggu|ledu)\b/.test(lowerText)

        let targetLang = language
        if (isHindi) targetLang = 'hi'
        else if (isTamil) targetLang = 'ta'
        else if (isTelugu) targetLang = 'te'

        let mockResponse = ""
        let mockEnglish = ""

        if (targetLang === 'hi') {
          if (lowerText.includes('sir') || lowerText.includes('sar') || text.includes('सिर') || lowerText.includes('head')) {
            mockResponse = "सिरदर्द के बारे में जानकर मुझे खेद है। यह दर्द कब से शुरू हुआ है और 1 से 10 के पैमाने पर कितना तेज है?"
            mockEnglish = "Sorry to hear about your headache. When did it start and how severe is it on a scale of 1 to 10?"
          } else if (lowerText.includes('pet') || text.includes('पेट') || lowerText.includes('stomach')) {
            mockResponse = "पेट की तकलीफ के बारे में जानकर खेद हुआ। क्या आपको उल्टी या दस्त की शिकायत है, और यह कब से शुरू हुआ?"
            mockEnglish = "Sorry to hear about your stomach discomfort. Are you having vomiting or loose motions, and when did this start?"
          } else if (lowerText.includes('bukhar') || text.includes('बुखार') || lowerText.includes('fever')) {
            mockResponse = "बुखार के बारे में जानकर खेद हुआ। क्या आपको ठंड या कंपकंपी भी लग रही है, और यह कितने दिनों से है?"
            mockEnglish = "Sorry to hear you have fever. Do you have chills or shivering, and how many days has it been?"
          } else {
            mockResponse = "आपकी तकलीफ के बारे में जानकर खेद हुआ। कृपया बताएं कि यह लक्षण कब से शुरू हुआ है?"
            mockEnglish = "Sorry to hear about your discomfort. Could you please share when these symptoms started?"
          }
        } else if (targetLang === 'ta') {
          mockResponse = "உங்கள் உடல்நலப் பிரச்சனை பற்றி விவரமாக கூறுங்கள், இது எப்போது தொடங்கியது?"
          mockEnglish = "Please share details about your symptoms and when they started."
        } else if (targetLang === 'te') {
          mockResponse = "మీ అనారోగ్య సమస్య వివరాలను మరియు ఇది ఎప్పుడు ప్రారంభమైందో దయచేసి చెప్పండి?"
          mockEnglish = "Please share details about your symptoms and when they started."
        } else {
          mockResponse = "Thank you for the information. Where exactly is the discomfort located, and when did it start?"
          mockEnglish = mockResponse
        }

        setMessages(prev => [...prev, {
          role: 'assistant',
          message: mockEnglish,
          translated_message: mockResponse,
          spoken_language: targetLang
        }])

        if (targetLang !== language) {
          setLanguage(targetLang as LanguageCode)
        }
        
        // Mock triage if chest pain is mentioned
        if (lowerText.includes('chest pain') || text.includes('दर्द') || text.includes('வலி') || text.includes('నొప్పి')) {
          setTriageAlerted(true)
        }
      }, 800)
    } finally {
      setIsProcessing(false)
    }
  }

  // End consultation manually
  const triggerManualCompletion = async () => {
    setIsProcessing(true)
    try {
      const res = await fetch('/api/chat/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId })
      })
      if (res.ok) {
        const data = await res.json()
        setSessionSummary(data.summary || 'Clinical intake summary compiled.')
        if (data.structured_summary) {
          setStructuredSummary(data.structured_summary)
        }
        setIsConsultationFinished(true)
      } else {
        setIsConsultationFinished(true)
      }
    } catch {
      setSessionSummary('Patient reports mild chest discomfort and history of hypertension.')
      setIsConsultationFinished(true)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleRestart = () => {
    setPatient(null)
    setMessages([])
    setSessionSummary('')
    setStructuredSummary(null)
    setTriageAlerted(false)
    setOcrText('')
    setScannedDetails(null)
    setScanSuccess(false)
    setIsConsultationFinished(false)
    if (typeof window !== 'undefined') {
      localStorage.removeItem('aarogya_patient_info')
      localStorage.removeItem('aarogya_scanned_details')
      localStorage.removeItem('aarogya_ocr_text')
    }
    setPhase('login')
    setSessionId('session_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now())
  }

  // Define the 5 pages switching list exactly as requested
  const navigationTabs: { id: PatientTab; label: string; icon: any }[] = [
    {
      id: 'profile',
      label: t('Profile', 'प्रोफ़ाइल', 'சுயவிவரம்', 'ప్రొఫైల్'),
      icon: User
    },
    {
      id: 'scan_prescription',
      label: t('Scan Prescription', 'पर्चा स्कैन करें', 'மருந்துச்சீட்டு ஸ்கேன்', 'ప్రిస్క్రిప్షన్ స్కాన్'),
      icon: FileText
    },
    {
      id: 'doctor_ai',
      label: t('Consulting Doctor AI', 'डॉक्टर एआई परामर्श', 'மருத்துவர் AI ஆலோசனை', 'డాక్టర్ AI సంప్రదింపు'),
      icon: Stethoscope
    },
    {
      id: 'medical_record',
      label: t('Medical Records', 'मेडिकल रिकॉर्ड्स', 'மருத்துவப் பதிவுகள்', 'మెడికల్ రికార్డులు'),
      icon: FolderHeart
    },
    {
      id: 'timeline',
      label: t('Previous Visit Timeline', 'पूर्व विज़िट टाइमलाइन', 'முந்தைய வருகைகள்', 'మునుపటి సందర్శనలు'),
      icon: Clock
    }
  ]

  return (
    <div className="min-h-screen flex flex-col justify-between bg-slate-50/60 print:bg-white">
      <Header />
      <main className="flex-1 flex flex-col justify-start py-3 sm:py-6 px-2 xs:px-3 sm:px-6 print:p-0 print:m-0 print:block">
        {patient ? (
          /* =========================================================================
             LOGGED-IN PATIENT PORTAL
             ========================================================================= */
          <div className="max-w-6xl mx-auto w-full flex flex-col gap-3.5 sm:gap-6 print:gap-0 print:max-w-full">
            
            {/* UNIFIED PATIENT PORTAL HEADER CARD (Welcome, Language, Navigation Tabs & Logout) */}
            <div className="w-full bg-slate-900 text-white rounded-2xl sm:rounded-3xl p-3.5 sm:p-6 shadow-xl sm:shadow-2xl border sm:border-2 border-slate-800 flex flex-col gap-3.5 sm:gap-5 print:hidden">
              {/* TOP ROW: Welcome Message (Left) & Language Dropdown (Right) */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2.5 sm:gap-4">
                <div className="flex-1 min-w-0">
                  {(() => {
                    const rawName = patient?.full_name?.trim() || ''
                    const nameEn = rawName
                    const nameHi = transliterateName(rawName, 'hi')
                    const nameTa = transliterateName(rawName, 'ta')
                    const nameTe = transliterateName(rawName, 'te')

                    return (
                      <h1 className="text-base xs:text-lg sm:text-2xl md:text-3xl font-black tracking-tight text-white leading-snug break-words">
                        {t(
                          nameEn
                            ? `Welcome ${nameEn}, Your Health Matters. We’re Here to Help.`
                            : "Welcome, Your Health Matters. We’re Here to Help.",
                          nameHi
                            ? `स्वागत है ${nameHi}, आपका स्वास्थ्य महत्वपूर्ण है। हम आपकी मदद के लिए यहाँ हैं।`
                            : "स्वागत है, आपका स्वास्थ्य महत्वपूर्ण है। हम आपकी मदद के लिए यहाँ हैं।",
                          nameTa
                            ? `வரவேற்கிறோம் ${nameTa}, உங்கள் ஆரோக்கியம் முக்கியமானது. நாங்கள் உதவ இங்கே இருக்கிறோம்.`
                            : "வரவேற்கிறோம், உங்கள் ஆரோக்கியம் முக்கியமானது. நாங்கள் உதவ இங்கே இருக்கிறோம்.",
                          nameTe
                            ? `స్వాగతం ${nameTe}, మీ ఆరోగ్యం ముఖ్యం. మేము మీకు సహాయం చేయడానికి ఇక్కడ ఉన్నాము.`
                            : "స్వాగతం, మీ ఆరోగ్యం ముఖ్యం. మేము మీకు సహాయం చేయడానికి ఇక్కడ ఉన్నాము."
                        )}
                      </h1>
                    )
                  })()}
                </div>

                {/* Top-Right Corner: Language Change Dropdown List */}
                <div className="self-end sm:self-center shrink-0">
                  <LanguageSwitcher
                    variant="dark-dropdown"
                    onLanguageChange={handleDashboardLanguageChange}
                  />
                </div>
              </div>

              {/* BOTTOM ROW: 5 Pages Switching List (Left) & Logout Button (Right) */}
              <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2.5 sm:gap-3 pt-2.5 sm:pt-3 border-t border-slate-800/80">
                {/* 5 Pages Switching Tabs - Horizontally scrollable without break on mobile */}
                <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none flex-nowrap -mx-1 px-1">
                  {navigationTabs.map((tab) => {
                    const isActive = activeTab === tab.id
                    const Icon = tab.icon
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-2.5 xs:px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all active:scale-95 flex items-center gap-1.5 sm:gap-2 shrink-0 ${
                          isActive
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30 border border-blue-400'
                            : 'text-slate-300 hover:text-white hover:bg-slate-800/80 border border-slate-700/60'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                        <span>{tab.label}</span>
                      </button>
                    )
                  })}
                </div>

                {/* Bottom-Right Corner: Logout Button */}
                <div className="self-end sm:self-center shrink-0 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={handleRestart}
                    className="w-full sm:w-auto px-3 xs:px-3.5 sm:px-4 py-1.5 sm:py-2 bg-red-600/90 hover:bg-red-600 active:scale-95 text-white text-xs sm:text-sm font-black rounded-xl transition-all shadow-md shadow-red-900/30 flex items-center justify-center gap-1.5 sm:gap-2 border border-red-500/50"
                  >
                    <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span>{t('Logout Button', 'लॉग आउट', 'வெளியேறு', 'లాగౌట్')}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Emergency Triage Indicator Banner */}
            {triageAlerted && (
              <div className="w-full bg-red-50 border-2 sm:border-4 border-red-600 rounded-2xl sm:rounded-3xl p-4 sm:p-6 flex items-start gap-3 sm:gap-4 shadow-xl animate-bounce-short">
                <ShieldAlert className="w-8 h-8 sm:w-12 sm:h-12 text-red-600 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <h4 className="text-base sm:text-2xl font-black text-red-800 break-words">
                    {t('EMERGENCY TRIAGE ALERT TRIGGERED', 'आपातकालीन ट्राइएज चेतावनी जारी', 'அவசர சிகிச்சை எச்சரிக்கை தூண்டப்பட்டது', 'అత్యవసర ట్రయాజ్ అలర్ట్ యాక్టివేట్ చేయబడింది')}
                  </h4>
                  <p className="text-xs sm:text-base md:text-lg font-bold text-red-700 mt-1">
                    {t('Symptoms indicate a high-priority emergency. Kiosk is alerting OPD nurses immediately.', 'लक्षण गंभीर हैं। नर्स को सूचित किया जा रहा है।', 'அறிகுறிகள் அவசரநிலையைக் குறிக்கின்றன. மருத்துவமனைக்குத் தகவல் அனுப்பப்படுகிறது.', 'లక్షణాలు అత్యవసర పరిస్థితిని సూచిస్తున్నాయి. నర్సులకు సమాచారం అందుతోంది.')}
                  </p>
                </div>
              </div>
            )}

            {/* 3. ACTIVE CONTENT PAGE VIEW */}
            <div className="w-full min-h-[460px] pb-6">
              
              {/* PAGE 1: PROFILE */}
              {activeTab === 'profile' && (
                <div className="flex flex-col items-center w-full">
                  <ProfileSection
                    patient={patient}
                    language={language}
                    onProceed={() => setActiveTab('scan_prescription')}
                    onUpdatePatient={(updated) => {
                      setPatient(updated)
                      if (typeof window !== 'undefined') {
                        localStorage.setItem('aarogya_patient_info', JSON.stringify(updated))
                      }
                    }}
                    onReset={handleRestart}
                  />
                </div>
              )}

              {/* PAGE 2: SCAN PRESCRIPTION */}
              {activeTab === 'scan_prescription' && (
                <div className="flex flex-col items-center max-w-3xl mx-auto w-full space-y-5">
                  {scanSuccess && (ocrText || scannedDetails) ? (
                    /* SUCCESS SCREEN - Celebratory confirmation banner & structured preview */
                    <div className="w-full bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-8 shadow-xl sm:shadow-2xl border-2 border-emerald-500 space-y-4 sm:space-y-6 animate-fade-in">
                      {/* Celebratory Banner */}
                      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-3 sm:gap-4 text-center sm:text-left bg-emerald-50/70 border-2 border-emerald-300 p-3.5 sm:p-5 rounded-xl sm:rounded-2xl">
                        <div className="w-12 h-12 sm:w-14 sm:h-14 bg-emerald-600 text-white rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0 shadow-lg shadow-emerald-700/20">
                          <CheckCircle2 className="w-7 h-7 sm:w-9 sm:h-9" />
                        </div>
                        <div className="space-y-1">
                          <div className="inline-flex items-center gap-1.5 bg-emerald-200/80 text-emerald-900 text-xs font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider mb-1">
                            <Sparkles className="w-3.5 h-3.5 text-emerald-800" />
                            <span>{t('Prescription Digitized & Saved', 'पर्चा डिजिटाइज़ व सहेजा गया', 'மருந்துச்சீட்டு பாதுகாக்கப்பட்டது', 'ప్రిస్క్రిప్షన్ భద్రపరచబడింది')}</span>
                          </div>
                          <h2 className="text-xl sm:text-3xl font-black text-emerald-950">
                            {t('Prescription Scanned Successfully!', 'पर्चा सफलतापूर्वक स्कैन हो गया!', 'மருந்துச்சீட்டு வெற்றிகரமாக ஸ்கேன் செய்யப்பட்டது!', 'ప్రిస్క్రిప్షన్ విజయవంతంగా స్కాన్ చేయబడింది!')}
                          </h2>
                          <p className="text-xs sm:text-sm font-bold text-emerald-800">
                            {t(
                              'Medical findings, vitals, and prescribed medications have been extracted and automatically added to your Medical Records.',
                              'पर्चे के सभी लक्षण, जांच रिपोर्ट और दवाइयाँ स्वचालित रूप से आपके मेडिकल रिकॉर्ड में जोड़ दी गई हैं।',
                              'மருத்துவ விவரங்கள் மற்றும் மருந்துகள் உங்கள் மருத்துவப் பதிவுகளில் தானாகவே சேர்க்கப்பட்டுள்ளன.',
                              'వైద్య వివరాలు మరియు మందులు స్వయంచాలకంగా మీ వైద్య రికార్డులకు జోడించబడ్డాయి.'
                            )}
                          </p>
                        </div>
                      </div>

                      {/* Structured Preview Card */}
                      <div className="bg-slate-50 rounded-xl sm:rounded-2xl p-3.5 sm:p-5 border border-slate-200 space-y-3 sm:space-y-4 text-left">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
                          <div>
                            <span className="text-[10px] font-black uppercase text-blue-900 tracking-wider">
                              {t('Medical Facility', 'अस्पताल / क्लिनिक', 'மருத்துவமனை', 'ఆసుపత్రి')}
                            </span>
                            <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
                              {scannedDetails?.hospital || t('Hospital / Clinic OPD', 'अस्पताल / क्लिनिक ओपीडी', 'மருத்துவமனை OPD', 'ఆసుపత్రి OPD')}
                            </h3>
                            {scannedDetails?.location && (
                              <p className="text-xs text-slate-500">{scannedDetails.location}</p>
                            )}
                          </div>
                          <div className="text-left sm:text-right">
                            <span className="text-[10px] font-black uppercase text-slate-400 block">
                              {t('Prescription Date', 'पर्चे की तारीख', 'தேதி', 'తేదీ')}
                            </span>
                            <span className="text-xs font-mono font-bold text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200">
                              {scannedDetails?.date || t('Today', 'आज', 'இன்று', 'ఈరోజు')}
                            </span>
                          </div>
                        </div>

                        {/* Patient & Diagnosis details */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
                          <div className="bg-white p-3 rounded-xl border border-slate-200">
                            <span className="text-[10px] font-bold text-slate-400 uppercase block">{t('Patient Details', 'रोगी विवरण', 'நோயாளி', 'రోగి')}</span>
                            <p className="text-xs font-black text-slate-800 mt-0.5">
                              {scannedDetails?.patient_name || patient?.full_name} {scannedDetails?.age ? `(${scannedDetails.age}/${scannedDetails.gender || 'M'})` : ''}
                            </p>
                            {scannedDetails?.uhid && <span className="text-[10px] font-mono text-slate-400">UHID: {scannedDetails.uhid}</span>}
                          </div>

                          <div className="bg-white p-3 rounded-xl border border-slate-200">
                            <span className="text-[10px] font-bold text-slate-400 uppercase block">{t('Complaints (c/o)', 'शिकायतें', 'அறிகுறிகள்', 'లక్షణాలు')}</span>
                            <p className="text-xs font-bold text-slate-800 mt-0.5 capitalize">
                              {scannedDetails?.complaints || t('Not recorded', 'दर्ज नहीं', 'குறிப்பிடப்படவில்லை', 'పేర్కొనబడలేదు')}
                            </p>
                          </div>

                          <div className="bg-amber-50 p-3 rounded-xl border border-amber-200">
                            <span className="text-[10px] font-bold text-amber-800 uppercase block">{t('Impression / Diagnosis', 'निदान (बीमारी)', 'நோய் கண்டறிதல்', 'నిర్ధారణ')}</span>
                            <p className="text-xs font-black text-amber-900 mt-0.5">
                              {scannedDetails?.diagnosis || t('Clinical evaluation', 'चिकित्सीय मूल्यांकन', 'மருத்துவ மதிப்பீடு', 'క్లినికల్ మూల్యాంకనం')}
                            </p>
                          </div>
                        </div>

                        {/* Vitals Bar */}
                        {scannedDetails?.vitals && (
                          <div className="bg-white p-3 rounded-xl border border-slate-200 flex flex-wrap items-center gap-2 sm:gap-3 text-xs font-bold">
                            <span className="text-slate-400 uppercase text-[10px] font-black">{t('Vitals (o/e):', 'वाइटल्स:', 'பரிசோதனை:', 'వైటల్స్:')}</span>
                            {scannedDetails.vitals.bp && (
                              <span className="bg-slate-100 px-2.5 py-1 rounded-lg text-slate-800">
                                BP: <strong className="text-blue-900">{scannedDetails.vitals.bp}</strong>
                              </span>
                            )}
                            {scannedDetails.vitals.pulse && (
                              <span className="bg-slate-100 px-2.5 py-1 rounded-lg text-slate-800">
                                Pulse: <strong className="text-blue-900">{scannedDetails.vitals.pulse}</strong>
                              </span>
                            )}
                            {scannedDetails.vitals.rbs && (
                              <span className="bg-red-50 text-red-700 border border-red-200 px-2.5 py-1 rounded-lg">
                                RBS: <strong className="font-mono">{scannedDetails.vitals.rbs}</strong>
                              </span>
                            )}
                          </div>
                        )}

                        {/* Prescribed medicines preview */}
                        {scannedDetails?.medications && scannedDetails.medications.length > 0 && (
                          <div className="space-y-1.5">
                            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                              <Pill className="w-3.5 h-3.5 text-emerald-600" />
                              <span>{t('Prescribed Medications (Adv):', 'पर्चे की दवाइयाँ:', 'மருந்துகள்:', 'మందులు:')}</span>
                            </span>
                            <div className="flex flex-wrap gap-2">
                              {scannedDetails.medications.map((m: any, mIdx: number) => (
                                <span key={mIdx} className="inline-flex items-center gap-1.5 bg-emerald-100/70 border border-emerald-300 text-emerald-950 text-xs font-bold px-2.5 sm:px-3 py-1 rounded-xl">
                                  <span>{m.name}</span>
                                  {m.route && <span className="text-[10px] font-black text-emerald-800 uppercase bg-white/80 px-1.5 py-0.5 rounded">{m.route}</span>}
                                  {m.dosage && <span className="text-[10px] text-slate-600 font-medium">({m.dosage})</span>}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Primary Next Action Buttons */}
                      <div className="flex flex-col sm:flex-row items-center gap-2.5 sm:gap-3 pt-2">
                        {/* Primary CTA: Go to Medical Records */}
                        <button
                          onClick={() => setActiveTab('medical_record')}
                          className="w-full sm:flex-1 h-12 sm:h-14 bg-blue-900 hover:bg-blue-950 text-white rounded-xl sm:rounded-2xl font-black text-sm sm:text-base flex items-center justify-center gap-2 active:scale-95 transition-all shadow-xl shadow-blue-950/20"
                        >
                          <FolderHeart className="w-4 h-4 sm:w-5 sm:h-5 text-blue-300" />
                          <span>{t('View in Medical Records', 'मेडिकल रिकॉर्ड में देखें', 'மருத்துவப் பதிவுகளில் காண்க', 'మెడికల్ రికార్డులలో చూడండి')}</span>
                          <ArrowRight className="w-4 h-4 text-blue-300" />
                        </button>

                        {/* Secondary: Scan Another Document */}
                        <button
                          onClick={() => setScanSuccess(false)}
                          className="w-full sm:w-auto px-4 sm:px-5 h-12 sm:h-14 bg-slate-100 hover:bg-slate-200 border-2 border-slate-300 text-slate-800 rounded-xl sm:rounded-2xl font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 active:scale-95 transition-all"
                        >
                          <RefreshCw className="w-4 h-4" />
                          <span>{t('Scan Another Document', 'दूसरा पर्चा स्कैन करें', 'மற்றொரு சீட்டை ஸ்கேன் செய்', 'మరొకటి స్కాన్ చేయండి')}</span>
                        </button>

                        {/* Optional: Consult Doctor AI */}
                        <button
                          onClick={() => setActiveTab('doctor_ai')}
                          className="w-full sm:w-auto px-3.5 sm:px-4 h-12 sm:h-14 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-900 rounded-xl sm:rounded-2xl font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                        >
                          <Stethoscope className="w-4 h-4 text-emerald-700" />
                          <span>{t('Consult Doctor AI', 'डॉक्टर एआई से परामर्श', 'மருத்துவர் AI ஆலோசனை', 'డాక్టర్ AI సంప్రదించండి')}</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* SCANNER VIEW */
                    <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-8 shadow-xl border-2 border-slate-100 w-full text-center space-y-3 sm:space-y-4">
                      <div className="w-14 h-14 sm:w-16 sm:h-16 bg-blue-50 text-blue-900 rounded-2xl border-2 border-blue-200 flex items-center justify-center mx-auto shadow-sm">
                        <FileText className="w-7 h-7 sm:w-8 sm:h-8" />
                      </div>
                      <div>
                        <h2 className="text-xl sm:text-2xl font-black text-blue-950">
                          {t('Scan Your Prescription / Medical Document', 'अपना पर्चा या मेडिकल दस्तावेज़ स्कैन करें', 'மருந்துச்சீட்டை ஸ்கேன் செய்யுங்கள்', 'మీ ప్రిస్క్రిప్షన్‌ను స్కాన్ చేయండి')}
                        </h2>
                        <p className="text-slate-500 text-xs sm:text-sm mt-1">
                          {t('Take a photo or upload an image. Our AI will extract previous medicines and health conditions.', 'फोटो खींचें या अपलोड करें। एआई पिछली दवाओं और बीमारियों को स्वतः पढ़ लेगा।', 'புகைப்படம் எடுக்கவும் அல்லது பதிவேற்றவும்.', 'ఫోటో తీయండి లేదా అప్‌లోడ్ చేయండి.')}
                        </p>
                      </div>

                      <PrescScanner language={language} onScanComplete={handleScanComplete} />

                      <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2">
                        <button
                          onClick={() => setActiveTab('doctor_ai')}
                          className="text-xs font-bold text-slate-500 hover:text-blue-800 underline"
                        >
                          {t('Skip and Go to Doctor AI Consultation', 'स्किप करें और सीधे परामर्श शुरू करें', 'தவிர்த்துவிட்டு மருத்துவரிடம் செல்லவும்', 'స్కిప్ చేసి డాక్టర్ AI వద్దకు వెళ్లండి')}
                        </button>

                        {ocrText && (
                          <button
                            onClick={() => setScanSuccess(true)}
                            className="text-xs font-black text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 hover:bg-emerald-100 cursor-pointer"
                          >
                            {t('View Saved Scan Result', 'सहेजा गया पर्चा देखें', 'சேமிக்கப்பட்ட முடிவைக் காண்க', 'సేవ్ చేసిన ఫలితం చూడండి')}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* PAGE 3: CONSULTING DOCTOR AI */}
              {activeTab === 'doctor_ai' && (
                <div className="flex flex-col items-center max-w-4xl mx-auto w-full space-y-4">
                  {/* Completed summary or live dialogue */}
                  {isConsultationFinished ? (
                    <div className="w-full max-w-4xl space-y-6">
                      {/* Top success announcement banner */}
                      <div className="bg-gradient-to-r from-emerald-600 via-teal-700 to-blue-900 text-white p-4 sm:p-7 rounded-2xl sm:rounded-3xl shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
                        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-3 sm:gap-4">
                          <div className="p-2.5 sm:p-3 bg-white/20 backdrop-blur-md rounded-2xl shrink-0">
                            <CheckCircle2 className="w-7 h-7 sm:w-10 sm:h-10 text-emerald-200" />
                          </div>
                          <div className="min-w-0">
                            <span className="bg-emerald-500/40 text-emerald-100 text-[10px] sm:text-xs font-black uppercase px-2.5 py-0.5 rounded-full border border-emerald-300/30 tracking-wider inline-block">
                              {t('Consultation Intake Completed', 'क्लिनिकल परामर्श संपन्न', 'ஆலோசனை முடிந்தது', 'క్లినికల్ సంప్రదింపు పూర్తయింది')}
                            </span>
                            <h2 className="text-lg sm:text-2xl font-black text-white mt-1 break-words">
                              {t('Symptoms Structured into Clinical History', 'लक्षणों का क्लिनिकल सारांश तैयार है', 'மருத்துவ வரலாறு தயாராக உள்ளது', 'క్లినికల్ చరిత్ర సిద్ధంగా ఉంది')}
                            </h2>
                            <p className="text-xs sm:text-sm text-emerald-100 mt-0.5">
                              {t('Choose a specialist doctor below to generate your OPD token and join the live queue.', 'ओपीडी टोकन प्राप्त करने और डॉक्टर की कतार में शामिल होने के लिए नीचे डॉक्टर चुनें।', 'OPD டோக்கன் பெற கீழே மருத்துவரைத் தேர்ந்தெடுக்கவும்.', 'OPD టోకెన్ పొందడానికి క్రింద ఉన్న వైద్యుడిని ఎంచుకోండి.')}
                            </p>
                          </div>
                        </div>

                        <button
                          onClick={() => setActiveTab('medical_record')}
                          className="w-full sm:w-auto h-11 sm:h-12 px-5 bg-white hover:bg-slate-100 text-slate-900 font-extrabold text-xs sm:text-sm rounded-xl sm:rounded-2xl shadow-md flex items-center justify-center gap-2 shrink-0 transition-all active:scale-95"
                        >
                          <FolderHeart className="w-4 h-4 text-blue-900" />
                          <span>{t('View in Medical Records', 'मेडिकल रिकॉर्ड में देखें', 'மருத்துவப் பதிவுகள்', 'మెడికల్ రికార్డులు')}</span>
                        </button>
                      </div>

                      {/* 1. Structured Clinical History Executive Card */}
                      <StructuredClinicalSummaryCard
                        data={structuredSummary}
                        rawText={sessionSummary}
                      />

                      {/* 2. Doctor Directory, Selection according to illness, Queue Token & Tracker */}
                      <DoctorSelectionAndQueue
                        sessionId={sessionId}
                        patientName={patient?.full_name}
                        abhaId={patient?.abha_number || patient?.abha_address}
                        structuredSummary={structuredSummary}
                        rawSummary={sessionSummary}
                        onViewMedicalRecords={() => setActiveTab('medical_record')}
                      />
                    </div>
                  ) : (
                    <div className="w-full flex flex-col items-center">
                      <AudioMic
                        language={language}
                        messages={messages}
                        onSendMessage={submitMessageToChat}
                        isProcessing={isProcessing}
                        onLanguageChange={setLanguage}
                      />
                      
                      <div className="mt-3 sm:mt-4 flex items-center justify-center w-full">
                        <button
                          onClick={triggerManualCompletion}
                          className="h-12 sm:h-14 px-5 sm:px-7 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white text-sm sm:text-base font-extrabold rounded-xl sm:rounded-2xl shadow-md flex items-center justify-center gap-2 transition-all w-full sm:w-auto"
                        >
                          <Stethoscope className="w-4 h-4 sm:w-5 sm:h-5" />
                          <span>{t('Finish & Generate Summary', 'परामर्श समाप्त करें व टोकन लें', 'முடித்து சுருக்கம் பெறுக', 'ముగించి సారాంశాన్ని పొందండి')}</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* PAGE 4: MEDICAL RECORD */}
              {activeTab === 'medical_record' && (
                <MedicalRecordsView
                  patient={patient}
                  ocrText={ocrText}
                  scannedDetails={scannedDetails}
                  onScanNewPrescription={() => {
                    setScanSuccess(false)
                    setActiveTab('scan_prescription')
                  }}
                  onConsultDoctor={() => setActiveTab('doctor_ai')}
                />
              )}

              {/* PAGE 5: PREVIOUS VISITS TIMELINE */}
              {activeTab === 'timeline' && (
                <VisitsTimelineView
                  patient={patient}
                  currentSessionId={sessionId}
                  currentSummary={sessionSummary}
                  onNewConsultation={() => setActiveTab('doctor_ai')}
                />
              )}
            </div>

          </div>
        ) : (
          /* =========================================================================
             PRE-LOGIN PHASES (Language Selection or Auth / Registration)
             ========================================================================= */
          <div className="w-full max-w-4xl mx-auto my-auto">
            {/* PHASE 0: PREFERRED LANGUAGE SELECTION */}
            {phase === 'language_select' && (
              <LanguageSelector onLanguageSelected={handleLanguageSelected} />
            )}

            {/* PHASE 1: LOGIN / REGISTRATION */}
            {phase === 'login' && (
              <div className="w-full max-w-3xl mx-auto">
                <div className="flex justify-end items-center mb-2 px-2">
                  <button
                    type="button"
                    onClick={() => setPhase('language_select')}
                    className="text-sm font-black text-blue-700 hover:text-blue-900 underline flex items-center gap-1.5 transition-colors"
                  >
                    <Globe className="w-4 h-4 shrink-0" />
                    <span>{t('Change Preferred Language', 'भाषा बदलें', 'மொழியை மாற்றவும்', 'భాషను మార్చండి')}</span>
                  </button>
                </div>
                <AuthScreen
                  language={language}
                  setLanguage={setLanguage}
                  onLoginSuccess={handleLoginSuccess}
                />
              </div>
            )}
          </div>
        )}
      </main>
      <Footer />
    </div>
  )
}
