'use client'

import React, { useState, useEffect, useRef } from 'react'
import { 
  CreditCard, ShieldCheck, Key, ArrowRight, CheckCircle, 
  AlertCircle, Languages, QrCode, Sparkles, UserCheck, 
  Camera, Upload, Smartphone, RefreshCw, ArrowLeft, Check
} from 'lucide-react'
import AbhaCard, { PatientInfo } from '@/components/AbhaCard'

interface AbhaSectionProps {
  language: string;
  setLanguage: (lang: string) => void;
  onLoginSuccess: (patient: PatientInfo) => void;
}

const LANGUAGES = [
  { code: 'en', native: 'English', greeting: 'Welcome to AarogyaMitra' },
  { code: 'hi', native: 'हिन्दी', greeting: 'आरोग्यमित्र में आपका स्वागत है' },
  { code: 'ta', native: 'தமிழ்', greeting: 'ஆரோக்கியமித்ராவிற்கு உங்களை வரவேற்கிறோம்' },
  { code: 'te', native: 'తెలుగు', greeting: 'ఆరోగ్యమిత్రకు స్వాగతం' },
  { code: 'kn', native: 'ಕನ್ನಡ', greeting: 'ಆರೋಗ್ಯಮಿತ್ರಕ್ಕೆ ಸುಸ್ವಾಗತ' },
  { code: 'ml', native: 'മലയാളം', greeting: 'ആരോഗ്യമിത്രയിലേക്ക് സ്വാഗതം' }
]

export default function AbhaSection({ language, setLanguage, onLoginSuccess }: AbhaSectionProps) {
  // Steps: 'lang' | 'verify' | 'otp' | 'success'
  const [step, setStep] = useState<'lang' | 'verify' | 'otp' | 'success'>('lang')
  
  // Verification Tabs: 'number' | 'qr' | 'demo'
  const [activeTab, setActiveTab] = useState<'number' | 'qr' | 'demo'>('number')

  // Form State
  const [abhaInput, setAbhaInput] = useState('')
  const [authMode, setAuthMode] = useState<'aadhaar_otp' | 'mobile_otp'>('aadhaar_otp')
  const [otp, setOtp] = useState('')
  const [txnId, setTxnId] = useState('')
  const [maskedMobile, setMaskedMobile] = useState('')
  const [qrRawText, setQrRawText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [patientInfo, setPatientInfo] = useState<PatientInfo | null>(null)
  
  // OTP Countdown Timer
  const [resendTimer, setResendTimer] = useState(60)

  // Camera & QR Scanner State
  const [cameraActive, setCameraActive] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)

  // Demo Profiles fetched from backend
  const [demoProfiles, setDemoProfiles] = useState<any[]>([])

  useEffect(() => {
    // Pre-fetch demo personas for rapid testing
    fetch('/api/abdm/demo-profiles')
      .then(res => res.json())
      .then(data => {
        if (data?.profiles) setDemoProfiles(data.profiles)
      })
      .catch(err => console.error("Error fetching ABDM demo profiles:", err))
  }, [])

  useEffect(() => {
    let interval: any
    if (step === 'otp' && resendTimer > 0) {
      interval = setInterval(() => setResendTimer(prev => prev - 1), 1000)
    }
    return () => clearInterval(interval)
  }, [step, resendTimer])

  // Multi-lingual Helper
  const t = (en: string, hi: string, ta?: string, te?: string) => {
    if (language === 'hi') return hi
    if (language === 'ta' && ta) return ta
    if (language === 'te' && te) return te
    return en
  }

  // Auto-format 14-digit ABHA input as XX-XXXX-XXXX-XXXX
  const handleAbhaInputChange = (val: string) => {
    if (val.includes('@')) {
      setAbhaInput(val.trim().toLowerCase())
      return
    }
    const cleanDigits = val.replace(/\D/g, '').slice(0, 14)
    let formatted = cleanDigits
    if (cleanDigits.length > 10) {
      formatted = `${cleanDigits.slice(0, 2)}-${cleanDigits.slice(2, 6)}-${cleanDigits.slice(6, 10)}-${cleanDigits.slice(10)}`
    } else if (cleanDigits.length > 6) {
      formatted = `${cleanDigits.slice(0, 2)}-${cleanDigits.slice(2, 6)}-${cleanDigits.slice(6)}`
    } else if (cleanDigits.length > 2) {
      formatted = `${cleanDigits.slice(0, 2)}-${cleanDigits.slice(2)}`
    }
    setAbhaInput(formatted)
  }

  // 1. Send OTP Request
  const handleSendOTP = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!abhaInput) {
      setError(t('Please enter your 14-digit ABHA Number or ABHA Address', 'कृपया अपना 14 अंकों का एबीएचए नंबर या एबीएचए पता दर्ज करें'))
      return
    }
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/abdm/init-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          abha_id: abhaInput,
          auth_mode: authMode
        })
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to initialize ABHA authentication')
      }

      setTxnId(data.txn_id)
      setMaskedMobile(data.masked_mobile || '+91 ******3210')
      setResendTimer(60)
      setStep('otp')
    } catch (err: any) {
      setError(err.message || 'Something went wrong while connecting to ABDM')
    } finally {
      setLoading(false)
    }
  }

  // 2. Verify OTP Request
  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!otp || otp.length !== 6) {
      setError(t('Please enter a valid 6-digit OTP', 'कृपया 6 अंकों का सही ओटीपी दर्ज करें'))
      return
    }
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/abdm/confirm-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          abha_id: abhaInput,
          otp: otp,
          txn_id: txnId
        })
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.detail || 'Invalid OTP. Please check and try again.')
      }

      setPatientInfo(data.patient)
      setStep('success')
    } catch (err: any) {
      setError(err.message || 'Verification failed. Try using demo OTP 123456')
    } finally {
      setLoading(false)
    }
  }

  // 3. Scan & Verify ABDM QR Code
  const handleVerifyQR = async (qrString: string) => {
    if (!qrString.trim()) {
      setError(t('QR data is empty', 'क्यूआर कोड डेटा खाली है'))
      return
    }
    setError('')
    setLoading(true)
    stopCamera()

    try {
      const res = await fetch('/api/abdm/verify-qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qr_data: qrString })
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to parse ABDM QR code')
      }

      setPatientInfo(data.patient)
      setStep('success')
    } catch (err: any) {
      setError(err.message || 'Invalid ABDM QR format. Try clicking one of the sample presets.')
    } finally {
      setLoading(false)
    }
  }

  // Quick Demo Login
  const handleQuickDemoSelect = (persona: any) => {
    setAbhaInput(persona.abha_number)
    if (persona.sample_qr) {
      handleVerifyQR(persona.sample_qr)
    } else {
      handleSendOTP()
    }
  }

  // Camera Management for QR Scanner
  const startCamera = async () => {
    setError('')
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      })
      setStream(mediaStream)
      setCameraActive(true)
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
        videoRef.current.play()
      }
    } catch (err) {
      console.error(err)
      setError(t('Camera access denied or unavailable. Please use file upload or sample presets.', 'कैमरा एक्सेस नहीं मिला। कृपया नमूना क्यूआर या फाइल अपलोड का उपयोग करें।'))
      setCameraActive(false)
    }
  }

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop())
      setStream(null)
    }
    setCameraActive(false)
  }

  const capturePhotoForQR = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current
      const canvas = canvasRef.current
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        stopCamera()
        // Simulate scanning Sunita Devi or Ramesh Kumar from captured frame
        const samplePreset = demoProfiles[1]?.sample_qr || '{"hidn":"91-7812-3490-5621","hid":"sunita.devi@abdm","name":"Sunita Devi","gender":"F","dob":"1986-09-24"}'
        handleVerifyQR(samplePreset)
      }
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const samplePreset = demoProfiles[0]?.sample_qr || '{"hidn":"91-4521-8932-1049","hid":"rajesh.kumar@abdm","name":"Rajesh Kumar","gender":"M","dob":"1979-04-12"}'
      handleVerifyQR(samplePreset)
    }
  }

  const handleLogout = () => {
    setPatientInfo(null)
    setAbhaInput('')
    setOtp('')
    setTxnId('')
    setStep('verify')
    stopCamera()
  }

  const getGreeting = () => {
    const langObj = LANGUAGES.find(l => l.code === language)
    return langObj ? langObj.greeting : 'Welcome to AarogyaMitra'
  }

  return (
    <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-xl border-2 border-slate-100 flex flex-col justify-between max-w-2xl mx-auto w-full transition-all">
      <div>
        {/* Header with Language switcher */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-5 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 shadow-sm">
              <CreditCard className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-extrabold text-slate-900 text-xl tracking-tight">
                {t('ABHA Identification & Verification', 'एबीएचए पहचान एवं सत्यापन')}
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                {t('Ayushman Bharat Digital Mission (ABDM) M1 Compliant', 'आयुष्मान भारत डिजिटल मिशन (राष्ट्रीय स्वास्थ्य प्राधिकरण)')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setStep(step === 'lang' ? 'verify' : 'lang')}
            className="text-xs text-emerald-700 hover:text-emerald-800 font-bold bg-emerald-50 hover:bg-emerald-100/70 border border-emerald-200 px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 shadow-sm"
          >
            <Languages className="w-4 h-4" />
            <span>{t('Change Language', 'भाषा बदलें')}</span>
          </button>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="mb-5 p-3.5 bg-red-50 text-red-800 rounded-2xl flex items-start gap-2.5 text-sm border border-red-200 animate-shake">
            <AlertCircle className="w-5 h-5 mt-0.5 shrink-0 text-red-600" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        {/* STEP 1: LANGUAGE SELECTION */}
        {step === 'lang' && (
          <div className="space-y-4 py-2">
            <p className="text-sm text-slate-600 font-bold">
              Please select your preferred language / कृपया अपनी भाषा चुनें:
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {LANGUAGES.map(lang => (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => {
                    setLanguage(lang.code)
                    setStep('verify')
                  }}
                  className={`p-4 border-2 rounded-2xl text-left transition-all flex flex-col justify-between ${
                    language === lang.code 
                      ? 'border-emerald-600 bg-emerald-50/50 shadow-sm' 
                      : 'border-slate-200 hover:border-emerald-400 hover:bg-slate-50'
                  }`}
                >
                  <span className="text-base font-extrabold text-slate-900">{lang.native}</span>
                  <span className="text-xs text-slate-500 font-medium mt-1">{lang.code.toUpperCase()}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* STEP 2: MAIN VERIFICATION HUBS (NUMBER / QR / DEMO) */}
        {step === 'verify' && (
          <div>
            {/* Welcome banner */}
            <div className="p-3 bg-emerald-50 text-emerald-900 rounded-2xl flex items-center gap-2.5 text-xs font-semibold border border-emerald-200 mb-5">
              <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{getGreeting()}</span>
            </div>

            {/* Verification Mode Selector Tabs */}
            <div className="grid grid-cols-3 gap-2 bg-slate-100 p-1.5 rounded-2xl mb-6 text-xs font-bold">
              <button
                type="button"
                onClick={() => { setActiveTab('number'); stopCamera(); setError(''); }}
                className={`py-2.5 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === 'number'
                    ? 'bg-white text-emerald-800 shadow-md border border-slate-200/60'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Smartphone className="w-4 h-4" />
                <span>{t('ABHA / OTP', 'नंबर / ओटीपी')}</span>
              </button>

              <button
                type="button"
                onClick={() => { setActiveTab('qr'); setError(''); }}
                className={`py-2.5 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === 'qr'
                    ? 'bg-white text-emerald-800 shadow-md border border-slate-200/60'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <QrCode className="w-4 h-4" />
                <span>{t('Scan & Share', 'क्यूआर स्कैन')}</span>
              </button>

              <button
                type="button"
                onClick={() => { setActiveTab('demo'); stopCamera(); setError(''); }}
                className={`py-2.5 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === 'demo'
                    ? 'bg-white text-emerald-800 shadow-md border border-slate-200/60'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <UserCheck className="w-4 h-4" />
                <span>{t('Demo Profiles', 'त्वरित डेमो')}</span>
              </button>
            </div>

            {/* TAB 1: 14-DIGIT ABHA NUMBER OR PHR ADDRESS + OTP */}
            {activeTab === 'number' && (
              <form onSubmit={handleSendOTP} className="space-y-5">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">
                    {t('Enter 14-Digit ABHA Number or ABHA Address', '14 अंकों का एबीएचए नंबर या एबीएचए पता दर्ज करें')}
                  </label>
                  <input
                    type="text"
                    value={abhaInput}
                    onChange={(e) => handleAbhaInputChange(e.target.value)}
                    placeholder="e.g. 91-4521-8932-1049 or name@abdm"
                    className="w-full px-4 py-3.5 border-2 border-slate-200 rounded-2xl focus:outline-none focus:border-emerald-600 font-mono text-base text-slate-800 font-bold placeholder:text-slate-400 placeholder:font-normal"
                    required
                  />
                  <p className="text-[11px] text-slate-500 mt-1 font-medium">
                    {t('Supports 14-digit Ayushman health number or @abdm PHR address.', '14 अंकों का एबीएचए नंबर या @abdm पता स्वीकार्य है।')}
                  </p>
                </div>

                {/* Authentication Mode Selection */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                    {t('Choose Verification Method', 'सत्यापन का माध्यम चुनें')}
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setAuthMode('aadhaar_otp')}
                      className={`p-3 rounded-xl border-2 text-left transition-all ${
                        authMode === 'aadhaar_otp'
                          ? 'border-emerald-600 bg-emerald-50/60 text-emerald-950 font-bold shadow-sm'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <span className="text-xs block font-extrabold">{t('Aadhaar OTP', 'आधार ओटीपी')}</span>
                      <span className="text-[11px] text-slate-500 font-normal">{t('Linked to Aadhaar', 'आधार से लिंक मोबाइल पर')}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setAuthMode('mobile_otp')}
                      className={`p-3 rounded-xl border-2 text-left transition-all ${
                        authMode === 'mobile_otp'
                          ? 'border-emerald-600 bg-emerald-50/60 text-emerald-950 font-bold shadow-sm'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <span className="text-xs block font-extrabold">{t('Mobile OTP', 'मोबाइल ओटीपी')}</span>
                      <span className="text-[11px] text-slate-500 font-normal">{t('Linked to ABHA', 'एबीएचए पंजीकृत नंबर पर')}</span>
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-base rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-700/20 active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  {loading ? (
                    <span>{t('Requesting OTP from ABDM...', 'ओटीपी अनुरोध किया जा रहा है...')}</span>
                  ) : (
                    <>
                      <span>{t('Send Verification OTP', 'ओटीपी भेजें')}</span>
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* TAB 2: SCAN & SHARE / ABDM QR CODE */}
            {activeTab === 'qr' && (
              <div className="space-y-4">
                <div className="p-3.5 bg-blue-50 text-blue-900 rounded-2xl border border-blue-200 text-xs">
                  <p className="font-bold mb-1">
                    {t('National Health Authority (NHA) Scan & Share Kiosk', 'राष्ट्रीय स्वास्थ्य प्राधिकरण - स्कैन और शेयर')}
                  </p>
                  <p className="text-blue-700">
                    {t('Show your ABHA Digital Card, Ayushman Card or ABHA App QR code to verify instantly without typing.', 'अपना एबीएचए कार्ड या ऐप का क्यूआर कोड दिखाएं और बिना टाइप किए तुरंत सत्यापित करें।')}
                  </p>
                </div>

                {/* Live Camera View */}
                {cameraActive ? (
                  <div className="relative rounded-2xl overflow-hidden border-2 border-emerald-500 bg-black aspect-video flex flex-col items-center justify-center">
                    <video ref={videoRef} className="w-full h-full object-cover" playsInline />
                    <canvas ref={canvasRef} className="hidden" />
                    
                    {/* Scanner Guide Box */}
                    <div className="absolute inset-0 border-2 border-dashed border-white/60 m-8 rounded-xl pointer-events-none flex items-center justify-center">
                      <span className="bg-black/60 text-white text-[11px] px-3 py-1 rounded-full font-bold">
                        {t('Align QR inside frame', 'क्यूआर कोड को फ्रेम में रखें')}
                      </span>
                    </div>

                    <div className="absolute bottom-3 flex gap-2">
                      <button
                        type="button"
                        onClick={capturePhotoForQR}
                        className="py-2 px-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-lg"
                      >
                        {t('Scan Frame', 'स्कैन करें')}
                      </button>
                      <button
                        type="button"
                        onClick={stopCamera}
                        className="py-2 px-4 bg-slate-800/80 hover:bg-slate-800 text-white rounded-xl text-xs font-bold"
                      >
                        {t('Cancel', 'रद्द करें')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={startCamera}
                      className="h-28 border-2 border-dashed border-emerald-400 bg-emerald-50/30 hover:bg-emerald-50 rounded-2xl flex flex-col items-center justify-center gap-2 text-emerald-800 font-bold transition-all text-xs"
                    >
                      <Camera className="w-6 h-6 text-emerald-600" />
                      <span>{t('Open Kiosk Camera', 'कैमरा शुरू करें')}</span>
                    </button>

                    <label className="h-28 border-2 border-dashed border-slate-300 hover:border-emerald-400 bg-slate-50 hover:bg-emerald-50/20 rounded-2xl flex flex-col items-center justify-center gap-2 text-slate-700 font-bold transition-all text-xs cursor-pointer">
                      <Upload className="w-6 h-6 text-slate-500" />
                      <span>{t('Upload Card / QR Image', 'क्यूआर फोटो अपलोड करें')}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                )}

                {/* Instant Sample Test Presets */}
                <div className="pt-3 border-t border-slate-100">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
                    {t('One-Click Sample ABDM QR Presets (Instant Test):', 'त्वरित परीक्षण के लिए नमूना एबीएचए क्यूआर:')}
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {demoProfiles.slice(0, 4).map((p, idx) => (
                      <button
                        key={p.id || idx}
                        type="button"
                        onClick={() => handleVerifyQR(p.sample_qr)}
                        disabled={loading}
                        className="p-2.5 bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 rounded-xl text-left transition-all"
                      >
                        <span className="text-xs font-extrabold text-slate-800 block truncate">{p.name}</span>
                        <span className="text-[10px] text-slate-500 block truncate">{p.district}, {p.state}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: DEMO PERSONAS FOR EVALUATION */}
            {activeTab === 'demo' && (
              <div className="space-y-3">
                <p className="text-xs text-slate-500 font-medium">
                  {t('Select any pre-configured Indian patient persona to evaluate kiosk verification immediately:', 'त्वरित परीक्षण के लिए किसी भी रोगी प्रोफ़ाइल का चयन करें:')}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {demoProfiles.map((p) => (
                    <div
                      key={p.id}
                      className="p-4 rounded-2xl border-2 border-slate-200 hover:border-emerald-500 bg-white hover:bg-emerald-50/20 transition-all flex flex-col justify-between space-y-3 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="text-sm font-black text-slate-900">{p.name}</h4>
                          <span className="text-[11px] text-slate-500 font-medium block">
                            {p.gender === 'M' ? 'Male' : 'Female'}, {p.age} Yrs • {p.district}, {p.state}
                          </span>
                        </div>
                        <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
                          {p.id.toUpperCase()}
                        </span>
                      </div>

                      <div className="bg-slate-50 p-2 rounded-xl border border-slate-100 font-mono text-xs font-bold text-blue-900">
                        {p.abha_number}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleQuickDemoSelect(p)}
                        disabled={loading}
                        className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                      >
                        <span>{t('Verify as this Patient', 'सत्यापित करें')}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 3: OTP VERIFICATION */}
        {step === 'otp' && (
          <form onSubmit={handleVerifyOTP} className="space-y-5">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setStep('verify')}
                className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  {t('Enter 6-Digit OTP', '6 अंकों का ओटीपी दर्ज करें')}
                </h3>
                <p className="text-xs text-slate-500">
                  {t('Sent to registered mobile', 'पंजीकृत मोबाइल पर भेजा गया')}: <span className="font-bold text-slate-800">{maskedMobile}</span>
                </p>
              </div>
            </div>

            {/* Test OTP Hint Pill */}
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-amber-900 font-medium">
                <Key className="w-4 h-4 text-amber-600 shrink-0" />
                <span>{t('Simulation Demo OTP:', 'परीक्षण डेमो ओटीपी:')} <strong className="font-mono text-sm">123456</strong></span>
              </div>
              <button
                type="button"
                onClick={() => setOtp('123456')}
                className="bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold px-2.5 py-1 rounded-lg transition-colors"
              >
                {t('Auto Fill', 'स्वतः भरें')}
              </button>
            </div>

            {/* OTP Input Field */}
            <div>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="------"
                maxLength={6}
                autoFocus
                className="w-full py-3.5 px-4 border-2 border-slate-200 rounded-2xl focus:outline-none focus:border-emerald-600 text-center font-mono text-3xl font-black tracking-[0.5em] text-slate-900 placeholder:text-slate-300"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading || otp.length !== 6}
              className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-base rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-700/20 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {loading ? (
                <span>{t('Verifying OTP...', 'सत्यापित किया जा रहा है...')}</span>
              ) : (
                <>
                  <ShieldCheck className="w-5 h-5" />
                  <span>{t('Verify & Fetch ABHA Profile', 'सत्यापित करें और आगे बढ़ें')}</span>
                </>
              )}
            </button>

            {/* Resend OTP */}
            <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setStep('verify')}
                className="hover:text-slate-800 font-bold underline"
              >
                {t('Change ABHA ID', 'एबीएचए नंबर बदलें')}
              </button>

              {resendTimer > 0 ? (
                <span className="font-medium">
                  {t('Resend OTP in', 'पुनः भेजें')}: {resendTimer}s
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => handleSendOTP()}
                  className="text-emerald-700 hover:text-emerald-800 font-bold flex items-center gap-1"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>{t('Resend OTP', 'ओटीपी पुनः भेजें')}</span>
                </button>
              )}
            </div>
          </form>
        )}

        {/* STEP 4: VERIFICATION SUCCESS - DIGITAL ABHA HEALTH CARD */}
        {step === 'success' && patientInfo && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-black uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span>{t('ABHA ID Successfully Authenticated', 'एबीएचए आईडी सफलतापूर्वक सत्यापित')}</span>
              </span>
            </div>

            <AbhaCard
              patient={patientInfo}
              language={language}
              onProceed={() => onLoginSuccess(patientInfo)}
              onReset={handleLogout}
            />
          </div>
        )}
      </div>
    </div>
  )
}

