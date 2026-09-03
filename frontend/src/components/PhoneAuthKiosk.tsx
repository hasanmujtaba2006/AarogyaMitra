'use client'

import React, { useState, useEffect, useRef } from 'react'
import { 
  RecaptchaVerifier, 
  signInWithPhoneNumber, 
  ConfirmationResult 
} from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { 
  Phone, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  ArrowLeft, 
  RefreshCw, 
  Sparkles, 
  KeyRound
} from 'lucide-react'
import { PatientInfo } from '@/components/AbhaCard'

interface PhoneAuthKioskProps {
  onSuccess: (patient: PatientInfo) => void;
  onRegisterRequired?: (phone: string, uhid: string) => void;
  language?: string;
}

export default function PhoneAuthKiosk({
  onSuccess,
  onRegisterRequired,
  language = 'en'
}: PhoneAuthKioskProps) {
  // Step: 'phone' (View 1) or 'otp' (View 2)
  const [step, setStep] = useState<'phone' | 'otp'>('phone')

  // Input states
  const [mobileNumber, setMobileNumber] = useState('')
  const [otp, setOtp] = useState('')

  // Loading & Async states
  const [isSendingOtp, setIsSendingOtp] = useState(false)
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false)
  const [resendTimer, setResendTimer] = useState(30)

  // Feedback states
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  // Firebase ConfirmationResult ref
  const confirmationResultRef = useRef<ConfirmationResult | null>(null)
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null)

  const t = (en: string, hi: string) => (language === 'hi' ? hi : en)

  // =========================================================================
  // Initialize and Cleanup Invisible RecaptchaVerifier Safely
  // =========================================================================
  useEffect(() => {
    let isMounted = true

    const initRecaptcha = () => {
      if (typeof window === 'undefined' || !auth) return

      try {
        // Clean up any stale verifier instance attached to window
        if ((window as any).recaptchaVerifier) {
          try {
            (window as any).recaptchaVerifier.clear()
          } catch (e) {
            // ignore
          }
          ;(window as any).recaptchaVerifier = null
        }

        const verifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
          size: 'invisible',
          callback: () => {
            // reCAPTCHA solved automatically by invisible trigger
          },
          'expired-callback': () => {
            if (isMounted) {
              setErrorMessage(
                t('Security check expired. Please send OTP again.', 'सुरक्षा जांच समाप्त हो गई। कृपया पुनः प्रयास करें।')
              )
            }
          }
        })

        recaptchaVerifierRef.current = verifier
        ;(window as any).recaptchaVerifier = verifier
      } catch (err: any) {
        console.error('Firebase RecaptchaVerifier setup error:', err)
      }
    }

    initRecaptcha()

    return () => {
      isMounted = false
      if (recaptchaVerifierRef.current) {
        try {
          recaptchaVerifierRef.current.clear()
        } catch (e) {
          // ignore
        }
        recaptchaVerifierRef.current = null
        if (typeof window !== 'undefined') {
          ;(window as any).recaptchaVerifier = null
        }
      }
    }
  }, [language])

  // OTP Countdown Timer (30s)
  useEffect(() => {
    let interval: NodeJS.Timeout
    if (step === 'otp' && resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1)
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [step, resendTimer])

  // =========================================================================
  // Human-Friendly Firebase Error Translator
  // =========================================================================
  const translateFirebaseError = (error: any): string => {
    const code = error?.code || ''
    const msg = error?.message || ''

    switch (code) {
      case 'auth/invalid-phone-number':
        return t(
          'Please enter a valid 10-digit Indian mobile number.',
          'कृपया 10 अंकों का मान्य भारतीय मोबाइल नंबर दर्ज करें।'
        )
      case 'auth/too-many-requests':
        return t(
          'Too many OTP attempts from this kiosk. Please wait 2 minutes.',
          'बहुत अधिक प्रयास। कृपया 2 मिनट प्रतीक्षा करें।'
        )
      case 'auth/code-expired':
        return t(
          'The SMS OTP has expired. Please tap "Resend OTP".',
          'एसएमएस ओटीपी की समय सीमा समाप्त हो गई है। कृपया "ओटीपी पुनः भेजें" दबाएं।'
        )
      case 'auth/invalid-verification-code':
        return t(
          'Incorrect 6-digit OTP. Please check the SMS on your phone and re-enter.',
          'गलत ओटीपी। कृपया अपने फोन पर आया सही 6 अंकों का कोड दर्ज करें।'
        )
      case 'auth/quota-exceeded':
        return t(
          'SMS daily quota reached for this testing project. Please contact system admin.',
          'दैनिक एसएमएस सीमा समाप्त हो गई है। कृपया व्यवस्थापक से संपर्क करें।'
        )
      case 'auth/network-request-failed':
        return t(
          'Kiosk network error. Please check your internet connection.',
          'नेटवर्क त्रुटि। कृपया इंटरनेट कनेक्शन की जांच करें।'
        )
      default:
        return msg || t('Authentication failed. Please try again.', 'सत्यापन विफल रहा। पुनः प्रयास करें।')
    }
  }

  // Helper to format masked phone: +91 98XXXXXX10
  const getMaskedPhone = (num: string): string => {
    const clean = num.replace(/\D/g, '')
    if (clean.length === 10) {
      return `+91 ${clean.slice(0, 2)}XXXXXX${clean.slice(-2)}`
    }
    return `+91 ${num}`
  }

  // =========================================================================
  // VIEW 1: Send OTP with Firebase Phone Auth
  // =========================================================================
  const handleSendOtp = async () => {
    setErrorMessage('')
    setSuccessMessage('')

    const clean = mobileNumber.replace(/\D/g, '')
    if (clean.length !== 10) {
      setErrorMessage(
        t('Please enter exactly 10 digits for your mobile number.', 'कृपया 10 अंकों का मोबाइल नंबर दर्ज करें।')
      )
      return
    }

    if (!recaptchaVerifierRef.current) {
      setErrorMessage(
        t('Security verifier initializing, please retry in 2 seconds.', 'सुरक्षा सत्यापन प्रारंभ हो रहा है, कृपया 2 सेकंड में पुनः प्रयास करें।')
      )
      return
    }

    setIsSendingOtp(true)
    try {
      const fullPhone = `+91${clean}`
      const confirmation = await signInWithPhoneNumber(
        auth,
        fullPhone,
        recaptchaVerifierRef.current
      )

      confirmationResultRef.current = confirmation
      setStep('otp')
      setResendTimer(30)
      setSuccessMessage(
        t(
          `OTP successfully dispatched via SMS to ${getMaskedPhone(clean)}`,
          `ओटीपी सफलतापूर्वक ${getMaskedPhone(clean)} पर भेजा गया`
        )
      )
    } catch (err: any) {
      console.error('Firebase signInWithPhoneNumber error:', err)
      setErrorMessage(translateFirebaseError(err))
    } finally {
      setIsSendingOtp(false)
    }
  }

  // =========================================================================
  // VIEW 2: Verify OTP & Validate ID Token with FastAPI Backend
  // =========================================================================
  const handleVerifyOtp = async () => {
    setErrorMessage('')
    setSuccessMessage('')

    const cleanOtp = otp.replace(/\D/g, '')
    if (cleanOtp.length !== 6) {
      setErrorMessage(
        t('Please enter the complete 6-digit OTP code.', 'कृपया पूरा 6 अंकों का ओटीपी कोड दर्ज करें।')
      )
      return
    }

    if (!confirmationResultRef.current) {
      setErrorMessage(
        t('Session expired. Please request a new OTP.', 'सत्र समाप्त। कृपया पुनः ओटीपी मंगाएं।')
      )
      setStep('phone')
      return
    }

    setIsVerifyingOtp(true)
    try {
      // 1. Confirm OTP with Firebase client
      const userCredential = await confirmationResultRef.current.confirm(cleanOtp)
      const user = userCredential.user

      // 2. Extract Firebase ID Token (JWT)
      const idToken = await user.getIdToken()

      // 3. Send ID Token to FastAPI backend for verification and patient lookup
      let res: Response
      try {
        res = await fetch('/api/auth/firebase-verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id_token: idToken })
        })
      } catch (netErr: any) {
        throw new Error(
          t(
            'Cannot connect to backend server. Please ensure FastAPI is running on http://127.0.0.1:8000',
            'बैकएंड सर्वर से संपर्क नहीं हो सका। कृपया सुनिश्चित करें कि बैकएंड चालू है।'
          )
        )
      }

      const contentType = res.headers.get('content-type') || ''
      if (!contentType.includes('application/json')) {
        const text = await res.text()
        if (res.status >= 500) {
          throw new Error(
            t(
              'Backend server unreachable or returned 500. Please ensure FastAPI is running: uvicorn main:app --port 8000',
              'बैकएंड सर्वर से संपर्क नहीं हो सका। कृपया सुनिश्चित करें कि बैकएंड सर्वर पोर्ट 8000 पर चल रहा है।'
            )
          )
        }
        throw new Error(text || `Server returned status ${res.status}`)
      }

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.detail || data.message || 'Backend verification failed')
      }

      // 4. Store token in browser storage
      if (idToken) {
        localStorage.setItem('aarogya_token', idToken)
      }

      // 5. Handle response status
      if (data.status === 'AUTHENTICATED' && data.patient) {
        const p = data.patient
        const patientData: PatientInfo = {
          id: p.id || user.uid,
          abha_number: p.uhid || p.abha_number || `AM-${mobileNumber}`,
          abha_address: p.abha_address || `${mobileNumber}@aarogya`,
          full_name: p.full_name || `Patient ${mobileNumber.slice(-4)}`,
          gender: p.gender || 'M',
          date_of_birth: p.date_of_birth || '1990-01-01',
          mobile_number: p.mobile_number || `+91${mobileNumber}`,
          district: p.district || '',
          state: p.state || '',
          pincode: p.pincode || '',
          auth_method: 'FIREBASE_PHONE',
          verification_status: 'VERIFIED'
        }
        onSuccess(patientData)
      } else if (data.status === 'REGISTER_REQUIRED') {
        if (onRegisterRequired) {
          onRegisterRequired(data.phone || `+91${mobileNumber}`, data.uhid || '')
        } else {
          // Default fallback patient onboarding
          const fallbackPatient: PatientInfo = {
            id: user.uid,
            abha_number: data.uhid || `AM-${mobileNumber}`,
            abha_address: `${mobileNumber}@aarogya`,
            full_name: `New Patient (${mobileNumber.slice(-4)})`,
            gender: 'O',
            date_of_birth: '1990-01-01',
            mobile_number: data.phone || `+91${mobileNumber}`,
            district: '',
            state: '',
            pincode: '',
            auth_method: 'FIREBASE_PHONE',
            verification_status: 'VERIFIED'
          }
          onSuccess(fallbackPatient)
        }
      }
    } catch (err: any) {
      console.error('Firebase OTP confirmation error:', err)
      setErrorMessage(translateFirebaseError(err))
    } finally {
      setIsVerifyingOtp(false)
    }
  }

  return (
    <div className="w-full max-w-3xl mx-auto bg-white rounded-3xl border-4 border-slate-900 shadow-2xl p-6 sm:p-10 my-4 text-slate-900">
      {/* Invisible reCAPTCHA container required by Firebase Phone Auth */}
      <div id="recaptcha-container"></div>

      {/* Header Banner */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-emerald-100 border-2 border-emerald-500 text-emerald-800 text-base font-extrabold tracking-wide mb-3">
          <ShieldCheck className="w-6 h-6 text-emerald-600" />
          <span>{t('FIREBASE SECURE KIOSK AUTH', 'फ़ायरबेस सुरक्षित कियोस्क प्रमाणीकरण')}</span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight">
          {step === 'phone' 
            ? t('Patient Phone Login', 'रोगी मोबाइल लॉग इन') 
            : t('Verify SMS OTP', 'एसएमएस ओटीपी सत्यापित करें')}
        </h1>
        <p className="text-xl sm:text-2xl text-slate-600 font-bold mt-2">
          {t('AarogyaMitra Touch-Screen OPD Kiosk', 'आरोग्यमित्र टच-स्क्रीन ओपीडी कियोस्क')}
        </p>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="mb-6 p-6 bg-red-50 border-4 border-red-500 rounded-2xl flex items-start gap-4 shadow-md animate-shake">
          <AlertCircle className="w-8 h-8 text-red-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-xl font-black text-red-900">{t('Attention Needed', 'कृपया ध्यान दें')}</h4>
            <p className="text-xl font-bold text-red-700 mt-1">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Success Banner */}
      {successMessage && (
        <div className="mb-6 p-6 bg-emerald-50 border-4 border-emerald-500 rounded-2xl flex items-start gap-4 shadow-md">
          <CheckCircle2 className="w-8 h-8 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-xl font-black text-emerald-900">{t('Status', 'स्थिति')}</h4>
            <p className="text-xl font-bold text-emerald-700 mt-1">{successMessage}</p>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* VIEW 1: Mobile Number Input                                         */}
      {/* =================================================================== */}
      {step === 'phone' && (
        <div className="space-y-6">
          <div>
            <label className="block text-2xl font-extrabold text-slate-800 mb-3">
              {t('Enter 10-Digit Mobile Number', '10 अंकों का मोबाइल नंबर दर्ज करें')}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none text-3xl font-black text-slate-600">
                +91
              </div>
              <input
                type="tel"
                inputMode="numeric"
                maxLength={10}
                value={mobileNumber}
                onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="9876543210"
                className="w-full pl-28 pr-6 py-6 text-3xl font-black tracking-wider text-slate-900 bg-white border-4 border-slate-400 rounded-2xl focus:border-emerald-600 focus:ring-4 focus:ring-emerald-200 outline-none shadow-inner min-h-[72px]"
              />
            </div>
            <p className="text-lg text-slate-500 font-bold mt-3">
              {t('We will send a 6-digit OTP to your phone via SMS.', 'हम आपके फोन पर एसएमएस के माध्यम से 6 अंकों का ओटीपी भेजेंगे।')}
            </p>
          </div>

          {/* Prominent Send OTP Button */}
          <button
            type="button"
            onClick={handleSendOtp}
            disabled={isSendingOtp || mobileNumber.length !== 10}
            className="w-full py-6 px-8 text-2xl rounded-2xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 disabled:bg-slate-300 disabled:cursor-not-allowed transition-all shadow-xl flex items-center justify-center gap-4 min-h-[72px]"
          >
            {isSendingOtp ? (
              <>
                <RefreshCw className="w-8 h-8 animate-spin" />
                <span>{t('Sending OTP via SMS...', 'एसएमएस भेजा जा रहा है...')}</span>
              </>
            ) : (
              <>
                <span>{t('Send OTP', 'ओटीपी भेजें')}</span>
                <ArrowRight className="w-8 h-8" />
              </>
            )}
          </button>
        </div>
      )}

      {/* =================================================================== */}
      {/* VIEW 2: OTP Verification                                            */}
      {/* =================================================================== */}
      {step === 'otp' && (
        <div className="space-y-6">
          {/* Target number display card */}
          <div className="flex items-center justify-between bg-emerald-50 border-2 border-emerald-300 rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <Phone className="w-7 h-7 text-emerald-700" />
              <span className="text-2xl font-extrabold text-emerald-950">
                {t('OTP sent to', 'ओटीपी भेजा गया')}: {getMaskedPhone(mobileNumber)}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setStep('phone')
                setOtp('')
                setErrorMessage('')
              }}
              className="text-lg font-black text-emerald-800 underline hover:text-emerald-950 flex items-center gap-1.5"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>{t('Change Number', 'नंबर बदलें')}</span>
            </button>
          </div>

          <div>
            <label className="block text-2xl font-extrabold text-slate-800 mb-3">
              {t('Enter 6-Digit OTP', '6 अंकों का ओटीपी दर्ज करें')}
            </label>
            <input
              type="tel"
              inputMode="numeric"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="------"
              className="w-full py-6 px-6 text-4xl font-black text-center tracking-[0.6em] text-slate-900 bg-white border-4 border-emerald-600 rounded-2xl focus:ring-4 focus:ring-emerald-200 outline-none shadow-inner min-h-[72px]"
            />

            {/* Resend OTP countdown and button */}
            <div className="mt-4 flex items-center justify-between">
              <span className="text-base font-bold text-slate-500">
                {t('Did not receive SMS?', 'एसएमएस नहीं मिला?')}
              </span>

              {resendTimer > 0 ? (
                <span className="text-lg font-extrabold text-slate-600 bg-slate-100 px-4 py-2 rounded-xl border border-slate-300">
                  {t(`Resend in ${resendTimer}s`, `${resendTimer}s में पुनः भेजें`)}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={isSendingOtp}
                  className="text-lg font-black text-emerald-700 underline hover:text-emerald-900 flex items-center gap-2"
                >
                  <RefreshCw className="w-5 h-5" />
                  <span>{t('Resend OTP', 'ओटीपी पुनः भेजें')}</span>
                </button>
              )}
            </div>
          </div>

          {/* Prominent Verify OTP Button */}
          <button
            type="button"
            onClick={handleVerifyOtp}
            disabled={isVerifyingOtp || otp.length !== 6}
            className="w-full py-6 px-8 text-2xl rounded-2xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 disabled:bg-slate-300 disabled:cursor-not-allowed transition-all shadow-xl flex items-center justify-center gap-4 min-h-[72px]"
          >
            {isVerifyingOtp ? (
              <>
                <RefreshCw className="w-8 h-8 animate-spin" />
                <span>{t('Verifying Token...', 'टोकन सत्यापित हो रहा है...')}</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-8 h-8" />
                <span>{t('Verify OTP & Start Consultation', 'ओटीपी सत्यापित करें और परामर्श शुरू करें')}</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}
