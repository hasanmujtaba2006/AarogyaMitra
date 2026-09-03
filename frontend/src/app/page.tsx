'use client'

import { useState, useEffect } from 'react'
import { FileText, ArrowRight, UserCheck, Stethoscope, Sparkles, LogOut, CheckCircle, ShieldAlert, ShieldCheck } from 'lucide-react'

import Header from '@/components/Header'
import Footer from '@/components/Footer'
import AuthScreen from '@/components/AuthScreen'
import LanguageSelector from '@/components/LanguageSelector'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import AudioMic from '@/components/AudioMic'
import PrescScanner from '@/components/PrescScanner'
import { PatientInfo } from '@/components/AbhaCard'
import { LanguageCode, useLanguage } from '@/context/LanguageContext'

interface Message {
  role: 'user' | 'assistant';
  message: string;
  translated_message?: string;
}

export default function KioskPage() {
  const { language, setLanguage, setHasLoggedIn, t } = useLanguage()

  // Session configuration
  const [sessionId, setSessionId] = useState('')
  const [patient, setPatient] = useState<PatientInfo | null>(null)
  
  // Navigation Phase: 'language_select' | 'login' | 'presc_choice' | 'presc_scan' | 'chat' | 'complete'
  const [phase, setPhase] = useState<'language_select' | 'login' | 'presc_choice' | 'presc_scan' | 'chat' | 'complete'>('language_select')
  
  // Chat state
  const [messages, setMessages] = useState<Message[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [sessionSummary, setSessionSummary] = useState('')
  const [triageAlerted, setTriageAlerted] = useState(false)
  const [ocrText, setOcrText] = useState('')

  useEffect(() => {
    // Generate unique session ID on page load
    setSessionId('session_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now())

    // Once a user logs in using their preferred app language, don't ask repeatedly
    if (typeof window !== 'undefined') {
      const savedLang = localStorage.getItem('aarogya_preferred_language') as LanguageCode | null
      const hasAlreadyLoggedIn = localStorage.getItem('aarogya_has_logged_in') === 'true'
      const savedPatient = localStorage.getItem('aarogya_patient_info')

      if (savedLang && ['en', 'hi', 'ta', 'te'].includes(savedLang)) {
        setLanguage(savedLang)
      }

      if (hasAlreadyLoggedIn && savedLang) {
        // User previously logged in with preferred language, do NOT ask repeatedly!
        if (savedPatient) {
          try {
            setPatient(JSON.parse(savedPatient))
            setPhase('presc_choice')
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

    setPhase('presc_choice')
  }

  const handleScanComplete = (extractedOcr: string) => {
    setOcrText(extractedOcr)
    
    // Save OCR in backend session
    fetch('/api/ocr/save-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, text: extractedOcr })
    }).catch(err => console.error("OCR save error:", err))

    // Automatically trigger initial chat query using OCR data
    const initialPrompt = `Hello, I have scanned my old prescription. Here is the text: ${extractedOcr}. Let's discuss my current issues.`
    submitMessageToChat(initialPrompt, true)
    setPhase('chat')
  }

  const submitMessageToChat = async (text: string, isOcrSystemInit = false) => {
    setIsProcessing(true)
    
    // Optimistically update message history client-side (unless initialized silently via prescription)
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
      setMessages(prev => [...prev, {
        role: 'assistant',
        message: data.response,
        translated_message: data.translated_response
      }])

      // Check if triage was triggered
      if (data.triage_alerted) {
        setTriageAlerted(true)
      }

      // Check if session completed
      if (data.status === 'completed') {
        setSessionSummary(data.summary || '')
        setPhase('complete')
      }

    } catch (err) {
      console.error(err)
      // Fallback Mock dialogue for validation
      setTimeout(() => {
        const mockResponses: Record<string, string> = {
          en: "Thank you for the information. Do you feel any chest pain, breathing difficulty, or radiating discomfort?",
          hi: "जानकारी के लिए धन्यवाद। क्या आपको सीने में दर्द, सांस लेने में तकलीफ या घबराहट महसूस हो रही है?",
          ta: "தகவலுக்கு நன்றி. உங்களுக்கு மார்பு வலி, மூச்சுத் திணறல் அல்லது அசௌகரியம் இருக்கிறதா?",
          te: "సమాచారానికి ధన్యవాదాలు. మీకు ఛాతీ నొప్పి, శ్వాస తీసుకోవడంలో ఇబ్బంది లేదా అసౌకర్యంగా ఉందా?"
        }
        
        const mockResponse = mockResponses[language] || mockResponses['en']
        setMessages(prev => [...prev, {
          role: 'assistant',
          message: mockResponse,
          translated_message: mockResponse
        }])
        
        // Mock triage if chest pain is mentioned
        if (text.toLowerCase().includes('chest pain') || text.includes('दर्द') || text.includes('வலி') || text.includes('నొప్పి')) {
          setTriageAlerted(true)
        }
      }, 1000)
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
        setSessionSummary(data.summary || 'Summary compiled')
        setPhase('complete')
      } else {
        setPhase('complete')
      }
    } catch {
      setSessionSummary('Mock Summary: Patient reports mild chest pain and history of high blood pressure.')
      setPhase('complete')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleRestart = () => {
    setPatient(null)
    setMessages([])
    setSessionSummary('')
    setTriageAlerted(false)
    setOcrText('')
    if (typeof window !== 'undefined') {
      localStorage.removeItem('aarogya_patient_info')
    }
    // After logging in once, stay on login without asking language repeatedly
    setPhase('login')
    setSessionId('session_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now())
  }

  return (
    <div className="min-h-screen flex flex-col justify-between">
      <Header />
      <main className="flex-1 flex flex-col justify-center py-6 px-4">
      {/* Session Progress Header */}
      {patient && (
        <div className="max-w-4xl mx-auto w-full bg-slate-900 text-white rounded-3xl p-5 mb-4 shadow-lg border-2 border-slate-800 flex flex-wrap justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <UserCheck className="w-10 h-10 text-emerald-400" />
              <ShieldCheck className="w-5 h-5 text-emerald-300 absolute -bottom-1 -right-1 bg-slate-900 rounded-full" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('PATIENT REGISTERED', 'पंजीकृत रोगी', 'பதிவுசெய்யப்பட்ட நோயாளி', 'రిజిస్టర్డ్ రోగి')}</span>
                <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-emerald-500/40">
                  ABHA VERIFIED
                </span>
              </div>
              <h3 className="text-2xl font-black">
                {patient.full_name} ({patient.gender === 'M' ? t('Male', 'पुरुष', 'ஆண்', 'పురుషుడు') : t('Female', 'महिला', 'பெண்', 'స్త్రీ')})
              </h3>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {/* Dashboard Option to Switch App Language */}
            <LanguageSwitcher
              variant="dashboard"
              onLanguageChange={handleDashboardLanguageChange}
            />
            <span className="font-mono text-base font-bold bg-slate-800 px-4 py-2 rounded-xl border border-slate-700 text-emerald-300">
              ABHA: {patient.abha_number}
            </span>
            <button
              onClick={handleRestart}
              className="bg-red-700/80 hover:bg-red-700 p-3 rounded-xl transition-all"
              title={t('Logout / End Session', 'लॉग आउट / सत्र समाप्त करें', 'வெளியேறு', 'లాగౌట్')}
            >
              <LogOut className="w-6 h-6" />
            </button>
          </div>
        </div>
      )}

      {/* Emergency Triage Indicator Banner */}
      {triageAlerted && (
        <div className="max-w-4xl mx-auto w-full bg-red-50 border-4 border-red-600 rounded-3xl p-6 mb-6 flex items-start gap-4 shadow-xl">
          <ShieldAlert className="w-12 h-12 text-red-600 shrink-0 animate-bounce" />
          <div>
            <h4 className="text-2xl font-black text-red-800">
              {t('EMERGENCY TRIAGE ALERT TRIGGERED', 'आपातकालीन ट्राइएज चेतावनी जारी', 'அவசர சிகிச்சை எச்சரிக்கை தூண்டப்பட்டது', 'అత్యవసర ట్రయాజ్ అలర్ట్ యాక్టివేట్ చేయబడింది')}
            </h4>
            <p className="text-lg font-bold text-red-700 mt-1">
              {t('Symptoms indicate a high-priority emergency. Kiosk is alerting OPD nurses immediately.', 'लक्षण गंभीर हैं। नर्स को सूचित किया जा रहा है।', 'அறிகுறிகள் அவசரநிலையைக் குறிக்கின்றன. மருத்துவமனைக்குத் தகவல் அனுப்பப்படுகிறது.', 'లక్షణాలు అత్యవసర పరిస్థితిని సూచిస్తున్నాయి. నర్సులకు సమాచారం అందుతోంది.')}
            </p>
          </div>
        </div>
      )}

      {/* PHASE 0: PREFERRED LANGUAGE SELECTION (Asked on website before login) */}
      {phase === 'language_select' && (
        <LanguageSelector onLanguageSelected={handleLanguageSelected} />
      )}

      {/* PHASE 1: LOGIN / REGISTRATION */}
      {phase === 'login' && (
        <div className="w-full max-w-3xl mx-auto my-6">
          <div className="flex justify-end items-center mb-2 px-2">
            <button
              type="button"
              onClick={() => setPhase('language_select')}
              className="text-sm font-black text-blue-700 hover:text-blue-900 underline flex items-center gap-1.5"
            >
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

      {/* PHASE 2: PRESCRIPTION OPTION QUESTION */}
      {phase === 'presc_choice' && (
        <div className="w-full max-w-2xl mx-auto bg-white rounded-3xl border-4 border-blue-900 shadow-2xl p-8 my-6 text-center">
          <FileText className="w-20 h-20 text-blue-900 mx-auto mb-6" />
          <h2 className="text-3xl font-extrabold text-blue-900 mb-4">
            {t('Do you have an old prescription?', 'क्या आपके पास पुराना पर्चा है?', 'உங்களிடம் பழைய மருந்துச்சீட்டு இருக்கிறதா?', 'మీ దగ్గర పాత ప్రిస్క్రిప్షన్ ఉందా?')}
          </h2>
          <p className="text-slate-500 text-lg mb-8">
            {t('If yes, we can scan it to read your previous medicines and diseases.', 'यदि हाँ, तो हम पिछली दवाइयों और बीमारियों को पढ़ने के लिए इसे स्कैन कर सकते हैं।', 'ஆம் எனில், உங்கள் முந்தைய மருந்துகள் மற்றும் நோய்களைப் படிக்க அதை ஸ்கேன் செய்யலாம்.', 'అవునైతే, మీ మునుపటి మందులు మరియు వ్యాధులను చదవడానికి మేము దానిని స్కాన్ చేయవచ్చు.')}
          </p>

          <div className="flex flex-col sm:flex-row gap-6">
            <button
              onClick={() => setPhase('presc_scan')}
              className="flex-1 h-24 bg-blue-800 hover:bg-blue-900 text-white font-extrabold text-2xl rounded-2xl flex justify-center items-center gap-3 active:scale-95 transition-all shadow-lg"
            >
              <span>{t('Yes, Scan Prescription', 'हाँ, पर्चा स्कैन करें', 'ஆம், ஸ்கேன் செய்யவும்', 'అవును, ప్రిస్క్రిప్షన్ స్కాన్ చేయి')}</span>
              <ArrowRight className="w-8 h-8" />
            </button>
            <button
              onClick={() => {
                // Trigger initial dialogue greeting from backend
                submitMessageToChat("Hello, I would like to start the medical history intake.")
                setPhase('chat')
              }}
              className="flex-1 h-24 bg-slate-100 border-4 border-slate-300 hover:bg-slate-200 text-slate-700 font-extrabold text-2xl rounded-2xl active:scale-95 transition-all"
            >
              {t('No, Skip Scan', 'नहीं, परामर्श शुरू करें', 'இல்லை, தவிர்த்துவிடவும்', 'లేదు, అవసరం లేదు')}
            </button>
          </div>
        </div>
      )}

      {/* PHASE 3: SCANNING THE PRESCRIPTION */}
      {phase === 'presc_scan' && (
        <div className="flex flex-col">
          <PrescScanner language={language} onScanComplete={handleScanComplete} />
          <button
            onClick={() => {
              submitMessageToChat("Hello, I would like to start the medical history intake.")
              setPhase('chat')
            }}
            className="mt-4 max-w-xs mx-auto text-lg text-slate-500 hover:text-slate-700 font-bold underline"
          >
            {t('Skip and Go to Chat', 'स्किप करें और बातचीत शुरू करें', 'தவிர்த்துவிட்டு பேச ஆரம்பிக்கவும்', 'స్కిప్ చేసి చాట్ కి వెళ్ళండి')}
          </button>
        </div>
      )}

      {/* PHASE 4: THE DIALOGUE MANAGER CHAT */}
      {phase === 'chat' && (
        <div className="flex flex-col items-center">
          <AudioMic
            language={language}
            messages={messages}
            onSendMessage={submitMessageToChat}
            isProcessing={isProcessing}
          />
          <button
            onClick={triggerManualCompletion}
            className="mt-4 h-16 px-8 bg-amber-600 hover:bg-amber-700 text-white text-xl font-bold rounded-2xl active:scale-95 transition-all shadow-md flex items-center gap-2"
          >
            <Stethoscope className="w-6 h-6" />
            <span>{t('Finish & Generate Summary', 'परामर्श समाप्त करें', 'முடித்து சுருக்கத்தை உருவாக்குங்கள்', 'ముగించి సారాంశాన్ని రూపొందించండి')}</span>
          </button>
        </div>
      )}

      {/* PHASE 5: COMPLETED SESSION SUMMARY */}
      {phase === 'complete' && (
        <div className="w-full max-w-2xl mx-auto bg-white rounded-3xl border-4 border-emerald-600 shadow-2xl p-8 my-6 text-center">
          <CheckCircle className="w-24 h-24 text-emerald-600 mx-auto mb-6" />
          <h2 className="text-4xl font-extrabold text-emerald-800 mb-2">
            {t('Registration Completed!', 'पंजीकरण सफल रहा!', 'பதிவு முடிந்தது!', 'నమోదు పూర్తయింది!')}
          </h2>
          <p className="text-slate-500 text-xl mb-8">
            {t('Your health details have been sent to the doctor. Please take your token.', 'आपकी बीमारी की जानकारी डॉक्टर को भेज दी गई है। कृपया अपना टोकन नंबर लें।', 'உங்கள் உடல்நல விவரங்கள் மருத்துவருக்கு அனுப்பப்பட்டுள்ளன. தயவுசெய்து டோக்கனைப் பெறவும்.', 'మీ ఆరోగ్య వివరాలు వైద్యునికి పంపబడ్డాయి. దయచేసి మీ టోకెన్ తీసుకోండి.')}
          </p>

          <div className="bg-emerald-50 rounded-2xl border border-emerald-200 p-6 text-left mb-8">
            <h3 className="text-2xl font-extrabold text-emerald-950 mb-3 flex items-center gap-2">
              <Sparkles className="w-7 h-7 text-emerald-700" />
              <span>{t('OPD Intake Token', 'ओपीडी पर्ची टोकन', 'OPD டோக்கன்', 'OPD టోకెన్')}</span>
            </h3>
            <div className="flex justify-between items-center border-b pb-4 mb-4">
              <span className="text-lg font-bold text-slate-600">{t('Token Number', 'टोकन संख्या', 'டோக்கன் எண்', 'టోకెన్ సంఖ్య')}</span>
              <span className="text-4xl font-black text-emerald-800">OPD-407</span>
            </div>
            {patient && (
              <div className="grid grid-cols-2 gap-4 text-base font-bold text-slate-700">
                <div>
                  <span className="text-slate-400 block text-xs uppercase">{t('Patient Name', 'रोगी का नाम', 'நோயாளி பெயர்', 'రోగి పేరు')}</span>
                  <span>{patient.full_name}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-xs uppercase">ABHA Address</span>
                  <span>{patient.abha_address}</span>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleRestart}
            className="w-full h-20 bg-blue-800 hover:bg-blue-900 text-white font-extrabold text-2xl rounded-2xl active:scale-95 transition-all shadow-lg"
          >
            {t('Finish & Reset Kiosk', 'अगला रोगी / रीसेट करें', 'அடுத்த நோயாளி / ரீசெட்', 'తదుపరి రోగి / రీసెట్')}
          </button>
        </div>
      )}
      </main>
      <Footer />
    </div>
  )
}
