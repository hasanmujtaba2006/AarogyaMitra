'use client'

import React, { useState, useEffect, useRef } from 'react'
import { 
  RecaptchaVerifier, 
  signInWithPhoneNumber, 
  ConfirmationResult 
} from 'firebase/auth'
import { auth, isFirebaseConfigured } from '@/lib/firebase'
import { 
  User, 
  Phone, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  ArrowLeft, 
  RefreshCw, 
  Sparkles, 
  MapPin, 
  Calendar, 
  Lock,
  Check,
  Flame,
  Eye,
  EyeOff
} from 'lucide-react'
import { PatientInfo } from '@/components/AbhaCard'

import { LanguageCode } from '@/context/LanguageContext'
import { extractErrorMessage } from '@/lib/errorUtils'

interface AuthScreenProps {
  onLoginSuccess: (patient: PatientInfo) => void;
  language?: LanguageCode | string;
  setLanguage?: (lang: any) => void;
}

export default function AuthScreen({ 
  onLoginSuccess, 
  language = 'en', 
  setLanguage 
}: AuthScreenProps) {
  // Mode: 'login' (Returning Patient) or 'register' (New Patient)
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')

  // Firebase Refs for Phone Auth
  const confirmationResultRef = useRef<ConfirmationResult | null>(null)
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null)

  // --- LOGIN STATE ---
  const [loginMobile, setLoginMobile] = useState('')
  const [loginStep, setLoginStep] = useState<'phone' | 'pin' | 'otp'>('phone')
  const [loginPin, setLoginPin] = useState('')
  const [returningPatientName, setReturningPatientName] = useState('')
  const [isCheckingPhone, setIsCheckingPhone] = useState(false)
  const [isVerifyingPin, setIsVerifyingPin] = useState(false)
  const [unregisteredPhone, setUnregisteredPhone] = useState(false)
  const [showLoginPin, setShowLoginPin] = useState(false)
  const [loginOtp, setLoginOtp] = useState('')
  const [loginTxnId, setLoginTxnId] = useState('')
  const [demoOtpHint, setDemoOtpHint] = useState('123456')
  const [resendTimer, setResendTimer] = useState(30)
  const [isSendingOtp, setIsSendingOtp] = useState(false)
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false)
  const [billingError, setBillingError] = useState(false)

  // --- REGISTRATION STATE ---
  const [fullName, setFullName] = useState('')
  const [regMobile, setRegMobile] = useState('')
  const [gender, setGender] = useState<'M' | 'F' | 'O'>('M')
  const [age, setAge] = useState<string>('')
  const [pinCode, setPinCode] = useState('')
  const [regPin, setRegPin] = useState('')
  const [showRegPin, setShowRegPin] = useState(false)
  const [district, setDistrict] = useState('')
  const [stateName, setStateName] = useState('')
  const [pinLoading, setPinLoading] = useState(false)
  const [pinResolved, setPinResolved] = useState(false)
  const [pinError, setPinError] = useState('')
  const [isSubmittingReg, setIsSubmittingReg] = useState(false)

  // General UI Message / Error feedback
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  // Multi-lingual Helper (English, Hindi, Tamil, Telugu)
  const t = (en: string, hi?: string, ta?: string, te?: string) => {
    if (language === 'hi' && hi) return hi
    if (language === 'ta' && ta) return ta
    if (language === 'te' && te) return te
    return en
  }

  // OTP Resend Countdown Timer
  useEffect(() => {
    let interval: NodeJS.Timeout
    if (loginStep === 'otp' && resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1)
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [loginStep, resendTimer])

  // =========================================================================
  // Initialize and Cleanup Invisible RecaptchaVerifier Safely
  // =========================================================================
  useEffect(() => {
    let isMounted = true
    if (typeof window !== 'undefined' && auth) {
      try {
        if ((window as any).recaptchaVerifier) {
          try {
            (window as any).recaptchaVerifier.clear()
          } catch (e) {}
          ;(window as any).recaptchaVerifier = null
        }
        const verifier = new RecaptchaVerifier(auth, 'auth-recaptcha-container', {
          size: 'invisible',
          callback: () => {},
          'expired-callback': () => {
            if (isMounted) {
              setErrorMessage(
                t('Security verification expired. Please send OTP again.', 'सुरक्षा सत्यापन समाप्त हो गया। कृपया पुनः प्रयास करें।')
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

    return () => {
      isMounted = false
      if (recaptchaVerifierRef.current) {
        try {
          recaptchaVerifierRef.current.clear()
        } catch (e) {}
        recaptchaVerifierRef.current = null
        if (typeof window !== 'undefined') {
          ;(window as any).recaptchaVerifier = null
        }
      }
    }
  }, [language])

  // =========================================================================
  // PIN CODE THE MAGIC FEATURE: Auto-lookup District & State upon 6 digits
  // =========================================================================
  useEffect(() => {
    const cleanPin = pinCode.replace(/\D/g, '')

    // Only trigger when exactly 6 digits are entered
    if (cleanPin.length === 6) {
      setPinLoading(true)
      setPinError('')
      setPinResolved(false)

      fetch(`https://api.postalpincode.in/pincode/${cleanPin}`)
        .then((res) => {
          if (!res.ok) throw new Error('Postal service lookup failed')
          return res.json()
        })
        .then((data) => {
          if (
            Array.isArray(data) &&
            data[0]?.Status === 'Success' &&
            Array.isArray(data[0]?.PostOffice) &&
            data[0].PostOffice.length > 0
          ) {
            const office = data[0].PostOffice[0]
            const detectedDistrict = office.District || office.Circle || ''
            const detectedState = office.State || ''

            setDistrict(detectedDistrict)
            setStateName(detectedState)
            setPinResolved(true)
            setPinError('')
          } else {
            setPinError(t('PIN code not found. Please check digits.', 'पिन कोड नहीं मिला। कृपया नंबर जांचें।'))
            setDistrict('')
            setStateName('')
            setPinResolved(false)
          }
        })
        .catch((err) => {
          console.error('Postal API error:', err)
          setPinError(t('Could not auto-fetch location. Please enter below if needed.', 'स्थान प्राप्त नहीं हो सका।'))
          setPinResolved(false)
        })
        .finally(() => {
          setPinLoading(false)
        })
    } else {
      // If user edits or clears PIN code, reset auto-detected fields
      if (cleanPin.length < 6) {
        setDistrict('')
        setStateName('')
        setPinResolved(false)
        setPinError('')
      }
    }
  }, [pinCode, language])

  // Safe Fetch Helper: handles non-JSON, 500 HTML proxy errors, and connection drops gracefully
  const safeFetchJson = async (url: string, options: RequestInit) => {
    let res: Response
    try {
      res = await fetch(url, options)
    } catch (netErr: any) {
      throw new Error(
        t(
          'Network connection error. Please ensure the backend server is running on http://127.0.0.1:8000',
          'नेटवर्क त्रुटि। कृपया सुनिश्चित करें कि बैकएंड सर्वर पोर्ट 8000 पर चल रहा है।'
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
      const formatted = extractErrorMessage(data, `Request failed with status ${res.status}`)
      const errorObj = new Error(formatted)
      ;(errorObj as any).status = res.status
      ;(errorObj as any).data = data
      throw errorObj
    }
    return data
  }

  // =========================================================================
  // 1. LOGIN FLOW HANDLERS (Direct 6-Digit PIN + Fast Kiosk Verification)
  // =========================================================================

  // Check if returning phone is registered and proceed to PIN Login
  const handleCheckPhoneAndProceed = async () => {
    setErrorMessage('')
    setSuccessMessage('')
    setUnregisteredPhone(false)
    const cleanNumber = loginMobile.replace(/\D/g, '')

    if (cleanNumber.length !== 10) {
      setErrorMessage(t('Please enter a valid 10-digit mobile number.', 'कृपया 10 अंकों का वैध मोबाइल नंबर दर्ज करें।', '10 இலக்க மொபைல் எண்ணை உள்ளிடவும்.', '10 అంకెల మొబైల్ నంబర్‌ను నమోదు చేయండి.'))
      return
    }

    setIsCheckingPhone(true)
    try {
      const data = await safeFetchJson('/api/auth/check-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile_number: cleanNumber })
      })

      if (data.registered) {
        setReturningPatientName(data.full_name || '')
        setLoginStep('pin')
        setLoginPin('')
        setErrorMessage('')
      } else {
        setUnregisteredPhone(true)
        setErrorMessage(
          t(
            `Mobile number +91 ${cleanNumber} is not registered yet. Please tap "Register as New Patient" below.`,
            `मोबाइल नंबर +91 ${cleanNumber} पंजीकृत नहीं है। कृपया नीचे "नया रोगी पंजीकरण" पर टैप करें।`,
            `மொபைல் எண் +91 ${cleanNumber} இன்னும் பதிவு செய்யப்படவில்லை. கீழே பதிவு செய்யவும்.`,
            `మొబైల్ నంబర్ +91 ${cleanNumber} ఇంకా నమోదు కాలేదు. దయచేసి క్రింద నమోదు చేయండి.`
          )
        )
      }
    } catch (err: any) {
      // Fallback: proceed directly to PIN step so local/offline kiosk is never blocked
      setLoginStep('pin')
    } finally {
      setIsCheckingPhone(false)
    }
  }

  // PIN Login verification (Direct, Fast & Reliable)
  const handlePinLogin = async () => {
    setErrorMessage('')
    setSuccessMessage('')
    const cleanNumber = loginMobile.replace(/\D/g, '')
    const cleanPin = loginPin.replace(/\D/g, '')

    if (cleanPin.length !== 6) {
      setErrorMessage(t('Please enter your 6-digit Login PIN.', 'कृपया अपना 6 अंकों का लॉगिन पिन दर्ज करें।', 'உங்கள் 6 இலக்க உள்நுழைவு பின்னை உள்ளிடவும்.', 'దయచేసి మీ 6 అంకెల లాగిన్ పిన్ నమోదు చేయండి.'))
      return
    }

    setIsVerifyingPin(true)
    try {
      const data = await safeFetchJson('/api/auth/login-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mobile_number: cleanNumber,
          pin: cleanPin
        })
      })

      if (data.access_token) {
        localStorage.setItem('aarogya_token', data.access_token)
      }

      const p = data.patient
      const patientData: PatientInfo = {
        id: p.id || cleanNumber,
        abha_number: p.uhid || p.abha_number || `AM-${cleanNumber}`,
        abha_address: p.abha_address || `${cleanNumber}@aarogya`,
        full_name: p.full_name || `Patient ${cleanNumber.slice(-4)}`,
        gender: p.gender || 'M',
        date_of_birth: p.date_of_birth || '1990-01-01',
        age: p.age,
        mobile_number: p.mobile_number || cleanNumber,
        address: p.address,
        district: p.district || district,
        state: p.state || stateName,
        pincode: p.pincode || pinCode,
        blood_group: p.blood_group || 'B+',
        allergies: p.allergies || 'No Known Allergies',
        profile_photo: p.profile_photo || '',
        auth_method: 'PIN_LOGIN',
        verification_status: 'VERIFIED'
      }

      onLoginSuccess(patientData)
    } catch (err: any) {
      const fallback = t('Incorrect 6-digit PIN. Please check your PIN and re-enter.', 'गलत 6-अंकीय पिन। कृपया अपना पिन जांचें और पुनः दर्ज करें।', 'தவறான 6 இலக்க PIN. உங்கள் PIN-ஐ சரிபார்த்து மீண்டும் முயற்சிக்கவும்.', 'తప్పు 6-అంకెల PIN. దయచేసి మీ PINని తనిఖీ చేసి మళ్లీ ప్రయత్నించండి.')
      const friendly = extractErrorMessage(err, fallback)
      setErrorMessage(friendly)
    } finally {
      setIsVerifyingPin(false)
    }
  }

  const handleSendOtp = async () => {
    setErrorMessage('')
    setSuccessMessage('')
    const cleanNumber = loginMobile.replace(/\D/g, '')

    if (cleanNumber.length !== 10) {
      setErrorMessage(t('Please enter a valid 10-digit mobile number.', 'कृपया 10 अंकों का वैध मोबाइल नंबर दर्ज करें।'))
      return
    }

    setIsSendingOtp(true)
    try {
      if (isFirebaseConfigured && recaptchaVerifierRef.current) {
        // REAL FIREBASE CARRIER SMS OTP
        const fullPhone = `+91${cleanNumber}`
        const confirmation = await signInWithPhoneNumber(
          auth,
          fullPhone,
          recaptchaVerifierRef.current
        )
        confirmationResultRef.current = confirmation
        setLoginStep('otp')
        setResendTimer(30)
        setSuccessMessage(
          t(
            `Real SMS OTP successfully dispatched to +91 ${cleanNumber} via Google Firebase!`,
            `गूगल फ़ायरबेस द्वारा +91 ${cleanNumber} पर असली एसएमएस ओटीपी भेजा गया!`
          )
        )
      } else {
        // Backend OTP fallback when Firebase credentials are not yet entered in .env.local
        const data = await safeFetchJson('/api/auth/send-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mobile_number: cleanNumber })
        })

        setLoginTxnId(data.transaction_id || `txn_${Date.now()}`)
        if (data.demo_otp) {
          setDemoOtpHint(data.demo_otp)
        }
        setLoginStep('otp')
        setResendTimer(30)
        setSuccessMessage(
          data.message || t('OTP sent to your mobile via SMS.', 'ओटीपी आपके मोबाइल पर एसएमएस द्वारा भेजा गया है।')
        )
      }
    } catch (err: any) {
      console.error('Send OTP error:', err)
      let msg = extractErrorMessage(err, t('Error sending OTP. Please check your phone number and try again.', 'ओटीपी भेजने में त्रुटि हुई। कृपया पुनः प्रयास करें।'))
      if (err.code === 'auth/invalid-api-key' || err.code === 'auth/configuration-not-found') {
        msg = t(
          'Firebase keys not configured in frontend/.env.local. Please paste your Firebase web credentials in frontend/.env.local for live carrier SMS.',
          'frontend/.env.local में फ़ायरबेस कुंजियाँ दर्ज करें।'
        )
      } else if (err.code === 'auth/invalid-phone-number') {
        msg = t('Invalid Indian phone number. Please enter a valid 10-digit number.', 'अमान्य फोन नंबर।')
      } else if (err.code === 'auth/operation-not-allowed') {
        msg = t(
          'SMS region or Phone Auth not enabled in Firebase Console. Go to Firebase Console -> Authentication -> Settings -> SMS region policy and allow India (+91), or add your number under "Phone numbers for testing".',
          'फ़ायरबेस कंसोल में भारत (+91) के लिए एसएमएस क्षेत्र नीति सक्षम करें या "Phone numbers for testing" में नंबर जोड़ें।'
        )
      } else if (err.code === 'auth/billing-not-enabled') {
        setBillingError(true)
        msg = t(
          'Google requires billing (Blaze plan) to send real carrier SMS. You can add your number under "Phone numbers for testing" in Firebase Console (100% Free, no credit card needed), or use Kiosk Local OTP below.',
          'गूगल फ़ायरबेस को असली एसएमएस के लिए बिलिंग की आवश्यकता है। मुफ़्त परीक्षण के लिए "Phone numbers for testing" में नंबर जोड़ें, या नीचे दिए गए बटन से कियोस्क ओटीपी का उपयोग करें।'
        )
      } else if (err.code === 'auth/too-many-requests') {
        msg = t('Too many requests. Please wait a few moments before trying again.', 'कृपया कुछ समय प्रतीक्षा करें।')
      }
      setErrorMessage(msg)
    } finally {
      setIsSendingOtp(false)
    }
  }

  // Instant Fallback to Local/Fast2SMS OTP (Bypasses Google Billing entirely)
  const handleUseLocalOtp = async () => {
    setErrorMessage('')
    setSuccessMessage('')
    setBillingError(false)
    const cleanNumber = loginMobile.replace(/\D/g, '')

    if (cleanNumber.length !== 10) {
      setErrorMessage(t('Please enter a valid 10-digit mobile number.', 'कृपया 10 अंकों का वैध मोबाइल नंबर दर्ज करें।'))
      return
    }

    setIsSendingOtp(true)
    try {
      confirmationResultRef.current = null // Clear Firebase ref to use backend verify
      const data = await safeFetchJson('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile_number: cleanNumber })
      })

      setLoginTxnId(data.transaction_id || `txn_${Date.now()}`)
      if (data.demo_otp) {
        setDemoOtpHint(data.demo_otp)
      }
      setLoginStep('otp')
      setResendTimer(30)
      setSuccessMessage(
        data.message || t('Kiosk OTP generated successfully.', 'कियोस्क ओटीपी सफलतापूर्वक उत्पन्न हुआ।')
      )
    } catch (err: any) {
      setErrorMessage(extractErrorMessage(err, t('Unable to send OTP at this moment. Please check your mobile number or try again.', 'ओटीपी भेजने में असमर्थ। कृपया पुनः प्रयास करें।')))
    } finally {
      setIsSendingOtp(false)
    }
  }

  const handleVerifyLogin = async () => {
    setErrorMessage('')
    setSuccessMessage('')
    const cleanNumber = loginMobile.replace(/\D/g, '')
    const cleanOtp = loginOtp.replace(/\D/g, '')

    if (cleanOtp.length !== 6) {
      setErrorMessage(t('Please enter the 6-digit OTP code.', 'कृपया 6 अंकों का ओटीपी कोड दर्ज करें।'))
      return
    }

    setIsVerifyingOtp(true)
    try {
      if (confirmationResultRef.current) {
        // REAL FIREBASE OTP VERIFICATION
        const userCredential = await confirmationResultRef.current.confirm(cleanOtp)
        const user = userCredential.user
        const idToken = await user.getIdToken()

        if (idToken) {
          localStorage.setItem('aarogya_token', idToken)
        }

        // Validate token with FastAPI backend
        const data = await safeFetchJson('/api/auth/firebase-verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id_token: idToken })
        })

        if (data.status === 'AUTHENTICATED' && data.patient) {
          onLoginSuccess(data.patient)
        } else if (data.status === 'REGISTER_REQUIRED') {
          // New patient phone verified via Firebase -> prompt registration
          setRegMobile(cleanNumber)
          setAuthMode('register')
          setSuccessMessage(
            t(
              'Phone number verified via Firebase SMS! Please complete patient details below.',
              'फोन नंबर फ़ायरबेस से सत्यापित हुआ! कृपया नीचे रोगी का विवरण भरें।'
            )
          )
        }
      } else {
        // Fallback local verify
        const data = await safeFetchJson('/api/auth/verify-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mobile_number: cleanNumber,
            transaction_id: loginTxnId,
            otp: cleanOtp
          })
        })

        if (data.access_token) {
          localStorage.setItem('aarogya_token', data.access_token)
        }

        const p = data.patient
        const patientData: PatientInfo = {
          id: p.id || cleanNumber,
          abha_number: p.uhid || p.abha_number || `AM-${cleanNumber}`,
          abha_address: p.abha_address || `${cleanNumber}@aarogya`,
          full_name: p.full_name || `Patient ${cleanNumber.slice(-4)}`,
          gender: p.gender || 'M',
          date_of_birth: p.date_of_birth || '1990-01-01',
          age: p.age,
          mobile_number: p.mobile_number || cleanNumber,
          address: p.address,
          district: p.district || district,
          state: p.state || stateName,
          pincode: p.pincode || pinCode,
          blood_group: p.blood_group || 'B+',
          allergies: p.allergies || 'No Known Allergies',
          profile_photo: p.profile_photo || '',
          auth_method: 'MANUAL_OTP',
          verification_status: 'VERIFIED'
        }

        onLoginSuccess(patientData)
      }
    } catch (err: any) {
      console.error('Verify OTP error:', err)
      let msg = extractErrorMessage(err, t('Verification failed. Please check the OTP code and try again.', 'सत्यापन विफल। कृपया ओटीपी जांचें।'))
      if (err.code === 'auth/invalid-verification-code') {
        msg = t('Incorrect SMS OTP. Please check your mobile phone SMS and re-enter.', 'गलत ओटीपी। कृपया अपने फोन पर आया सही कोड दर्ज करें।')
      } else if (err.code === 'auth/code-expired') {
        msg = t('OTP has expired. Please tap "Resend OTP".', 'ओटीपी समाप्त हो गया है। कृपया पुनः भेजें।')
      }
      setErrorMessage(msg)
    } finally {
      setIsVerifyingOtp(false)
    }
  }

  // =========================================================================
  // 2. REGISTRATION FLOW HANDLER
  // =========================================================================
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage('')
    setSuccessMessage('')

    const cleanNumber = regMobile.replace(/\D/g, '')
    const cleanPin = pinCode.replace(/\D/g, '')
    const cleanLoginPin = regPin.replace(/\D/g, '')
    const parsedAge = parseInt(age, 10)

    if (!fullName.trim()) {
      setErrorMessage(t('Please enter patient full name.', 'कृपया रोगी का पूरा नाम दर्ज करें।'))
      return
    }
    if (cleanNumber.length !== 10) {
      setErrorMessage(t('Please enter a valid 10-digit mobile number.', 'कृपया 10 अंकों का वैध मोबाइल नंबर दर्ज करें।'))
      return
    }
    if (isNaN(parsedAge) || parsedAge < 1 || parsedAge > 120) {
      setErrorMessage(t('Please enter a valid age (1-120).', 'कृपया वैध आयु (1-120) दर्ज करें।'))
      return
    }
    if (cleanPin.length !== 6) {
      setErrorMessage(t('Please enter a 6-digit postal PIN code.', 'कृपया 6 अंकों का पोस्टल पिन कोड दर्ज करें।'))
      return
    }
    if (cleanLoginPin.length !== 6) {
      setErrorMessage(t('Please create a 6-digit Login PIN.', 'कृपया 6 अंकों का लॉगिन पिन बनाएं।', 'தயவுசெய்து 6 இலக்க உள்நுழைவு பின்னை உருவாக்கவும்.', 'దయచేసి 6 అంకెల లాగిన్ పిన్‌ను సృష్టించండి.'))
      return
    }

    setIsSubmittingReg(true)
    try {
      const data = await safeFetchJson('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName.trim(),
          mobile_number: cleanNumber,
          gender: gender,
          age: parsedAge,
          pin_code: cleanPin,
          district: district || 'District HQ',
          state: stateName || 'State',
          login_pin: cleanLoginPin
        })
      })

      if (data.access_token) {
        localStorage.setItem('aarogya_token', data.access_token)
      }

      const p = data.patient
      const patientData: PatientInfo = {
        id: p.id || cleanNumber,
        abha_number: data.uhid || p.uhid || p.abha_number,
        abha_address: p.abha_address || `${cleanNumber}@aarogya`,
        full_name: p.full_name || fullName.trim(),
        gender: p.gender || gender,
        date_of_birth: p.date_of_birth || `${new Date().getFullYear() - parsedAge}-01-01`,
        age: parsedAge,
        mobile_number: p.mobile_number || cleanNumber,
        address: p.address,
        district: p.district || district,
        state: p.state || stateName,
        pincode: p.pin_code || cleanPin,
        blood_group: p.blood_group || 'B+',
        allergies: p.allergies || 'No Known Allergies',
        profile_photo: p.profile_photo || '',
        auth_method: 'MANUAL_REGISTER',
        verification_status: 'VERIFIED'
      }

      onLoginSuccess(patientData)
    } catch (err: any) {
      setErrorMessage(extractErrorMessage(err, t('Registration failed. Please check your details and try again.', 'पंजीकरण विफल रहा। कृपया विवरण जांचें।')))
    } finally {
      setIsSubmittingReg(false)
    }
  }

  return (
    <div className="w-full max-w-3xl mx-auto bg-white rounded-2xl sm:rounded-3xl border-2 sm:border-4 border-slate-900 shadow-xl sm:shadow-2xl p-4 sm:p-8 md:p-10 my-2 sm:my-4 text-slate-900">
      {/* Invisible reCAPTCHA container for Firebase Phone Authentication */}
      <div id="auth-recaptcha-container"></div>

      {/* Top Header with Kiosk Accessibility Badge */}
      <div className="text-center mb-5 sm:mb-8">
        <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-1.5 sm:py-2 rounded-full bg-emerald-100 border-2 border-emerald-500 text-emerald-800 text-xs sm:text-base font-extrabold tracking-wide mb-3 sm:mb-4">
          <ShieldCheck className="w-4 h-4 sm:w-6 sm:h-6 text-emerald-600 shrink-0" />
          <span>{t('AAROGYAMITRA HEALTHCARE KIOSK', 'आरोग्यमित्र स्वास्थ्य कियोस्क', 'ஆரோக்கியமித்ரா சுகாதார கியோஸ்க்', 'ఆరోగ్యమిత్ర హెల్త్‌కేర్ కియోస్క్')}</span>
        </div>

        <h1 className="text-2xl sm:text-4xl md:text-5xl font-black text-slate-900 tracking-tight leading-tight">
          {authMode === 'login' 
            ? t('Patient Login', 'रोगी लॉग इन', 'நோயாளி உள்நுழைவு', 'రోగి లాగిన్') 
            : t('New Patient Registration', 'नया रोगी पंजीकरण', 'புதிய நோயாளி பதிவு', 'కొత్త రోగి నమోదు')}
        </h1>
        <p className="text-sm sm:text-xl md:text-2xl text-slate-600 font-bold mt-1.5 sm:mt-2">
          {t('Touch the large buttons below to proceed', 'आगे बढ़ने के लिए नीचे बड़े बटनों को स्पर्श करें', 'தொடர கீழே உள்ள பெரிய பொத்தான்களைத் தொடவும்', 'కొనసాగడానికి క్రింది పెద్ద బటన్లను నొక్కండి')}
        </p>
      </div>

      {/* High-Contrast Mode Toggle Switch */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 p-1.5 sm:p-2 bg-slate-100 rounded-2xl sm:rounded-3xl border-2 sm:border-4 border-slate-300 mb-6 sm:mb-8">
        <button
          type="button"
          onClick={() => {
            setAuthMode('login')
            setErrorMessage('')
            setSuccessMessage('')
          }}
          className={`py-3 sm:py-4 px-3 sm:px-4 rounded-xl sm:rounded-2xl text-sm sm:text-lg md:text-xl font-black transition-all flex items-center justify-center gap-2 sm:gap-3 active:scale-95 ${
            authMode === 'login'
              ? 'bg-blue-700 text-white shadow-xl scale-[1.01] sm:scale-[1.02] border-2 border-blue-900'
              : 'bg-transparent text-slate-700 hover:text-slate-900 hover:bg-slate-200'
          }`}
        >
          <Phone className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" />
          <span className="truncate">{t('Returning Patient (Login)', 'पुराना रोगी (लॉग इन)', 'பழைய நோயாளி (உள்நுழைவு)', 'పాత రోగి (లాగిన్)')}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setAuthMode('register')
            setErrorMessage('')
            setSuccessMessage('')
          }}
          className={`py-3 sm:py-4 px-3 sm:px-4 rounded-xl sm:rounded-2xl text-sm sm:text-lg md:text-xl font-black transition-all flex items-center justify-center gap-2 sm:gap-3 active:scale-95 ${
            authMode === 'register'
              ? 'bg-emerald-700 text-white shadow-xl scale-[1.01] sm:scale-[1.02] border-2 border-emerald-900'
              : 'bg-transparent text-slate-700 hover:text-slate-900 hover:bg-slate-200'
          }`}
        >
          <User className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" />
          <span className="truncate">{t('New Patient (Register)', 'नया रोगी (पंजीकरण)', 'புதிய நோயாளி (பதிவு)', 'కొత్త రోగి (నమోదు)')}</span>
        </button>
      </div>

      {/* Global Error Banner */}
      {errorMessage && (
        <div className="mb-5 sm:mb-6 p-4 sm:p-6 bg-red-50 border-2 sm:border-4 border-red-500 rounded-xl sm:rounded-2xl flex items-start gap-3 sm:gap-4 animate-shake shadow-md">
          <AlertCircle className="w-6 h-6 sm:w-8 sm:h-8 text-red-600 shrink-0 mt-0.5" />
          <div className="w-full">
            <h4 className="text-base sm:text-xl font-black text-red-900">{t('Attention Needed', 'कृपया ध्यान दें')}</h4>
            <p className="text-sm sm:text-lg font-bold text-red-700 mt-1">{errorMessage}</p>

            {billingError && (
              <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t-2 border-red-200">
                <button
                  type="button"
                  onClick={handleUseLocalOtp}
                  className="px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl bg-slate-900 hover:bg-black text-white font-extrabold text-sm sm:text-lg flex items-center gap-2 shadow-lg transition-all active:scale-95"
                >
                  <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400 shrink-0" />
                  <span>{t('Continue with Kiosk OTP (Instant Demo Mode)', 'कियोस्क ओटीपी के साथ जारी रखें (डेमो मोड)')}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 1. RETURNING PATIENT LOGIN FLOW                                      */}
      {/* =================================================================== */}
      {authMode === 'login' && (
        <div className="space-y-4 sm:space-y-6">
          {loginStep === 'phone' && (
            /* Step 1: Mobile Number Input */
            <div className="space-y-4 sm:space-y-6">
              <div>
                <label className="block text-base sm:text-xl md:text-2xl font-extrabold text-slate-800 mb-1.5 sm:mb-3">
                  {t('Enter 10-Digit Mobile Number', '10 अंकों का मोबाइल नंबर दर्ज करें', '10 இலக்க மொபைல் எண்ணை உள்ளிடவும்', '10 అంకెల మొబైల్ నంబర్‌ను నమోదు చేయండి')}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 sm:pl-6 flex items-center pointer-events-none text-lg sm:text-2xl font-black text-slate-400">
                    +91
                  </div>
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    value={loginMobile}
                    onChange={(e) => {
                      setLoginMobile(e.target.value.replace(/\D/g, '').slice(0, 10))
                      setUnregisteredPhone(false)
                      setErrorMessage('')
                    }}
                    placeholder="9876543210"
                    className="w-full pl-16 sm:pl-24 pr-4 sm:pr-6 py-3.5 sm:py-5 text-xl sm:text-3xl font-black tracking-wider text-slate-900 bg-white border-2 sm:border-4 border-slate-400 rounded-xl sm:rounded-2xl focus:border-blue-600 focus:ring-2 sm:focus:ring-4 focus:ring-blue-200 outline-none shadow-inner"
                  />
                </div>
                <p className="text-xs sm:text-base text-slate-500 font-bold mt-1.5 sm:mt-2">
                  {t('Enter your mobile number to log in with your 6-digit PIN.', 'अपने 6 अंकों के पिन से लॉग इन करने के लिए मोबाइल नंबर दर्ज करें।', 'உங்கள் 6 இலக்க பின்னைப் பயன்படுத்தி உள்நுழைய மொபைல் எண்ணை உள்ளிடவும்.', 'మీ 6 అంకెల పిన్‌తో లాగిన్ చేయడానికి మొబైల్ నంబర్‌ను నమోదు చేయండి.')}
                </p>
              </div>

              {/* Unregistered Phone Banner with 1-Click Registration */}
              {unregisteredPhone && (
                <div className="p-4 bg-amber-50 border-2 sm:border-3 border-amber-400 rounded-2xl space-y-3 text-left animate-shake shadow-md">
                  <div className="flex items-center gap-2 text-amber-900 font-black text-sm sm:text-base">
                    <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                    <span>{t('New Patient Detected!', 'नया रोगी मिला!')}</span>
                  </div>
                  <p className="text-xs sm:text-sm font-bold text-amber-800">
                    {t(
                      `+91 ${loginMobile} is not registered yet. Tap below to register and create your 6-digit PIN in 30 seconds.`,
                      `+91 ${loginMobile} पंजीकृत नहीं है। 30 सेकंड में पंजीकरण करने और 6 अंकों का पिन बनाने के लिए नीचे टैप करें।`
                    )}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setRegMobile(loginMobile.replace(/\D/g, ''))
                      setAuthMode('register')
                      setUnregisteredPhone(false)
                      setErrorMessage('')
                    }}
                    className="w-full py-3 px-4 bg-emerald-700 hover:bg-emerald-800 active:scale-95 text-white font-black rounded-xl text-sm sm:text-base flex items-center justify-center gap-2 shadow-md transition-all"
                  >
                    <User className="w-5 h-5 shrink-0" />
                    <span>{t('Register as New Patient (30 Seconds)', 'नया रोगी पंजीकरण करें (30 सेकंड)')}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Action "Continue to PIN Login" Button */}
              <button
                type="button"
                onClick={handleCheckPhoneAndProceed}
                disabled={isCheckingPhone || loginMobile.length !== 10}
                className="w-full py-3.5 sm:py-5 px-4 sm:px-8 text-base sm:text-2xl rounded-xl sm:rounded-2xl font-black text-white bg-blue-600 hover:bg-blue-700 active:scale-95 disabled:bg-slate-300 disabled:cursor-not-allowed transition-all shadow-xl flex items-center justify-center gap-2.5 sm:gap-4"
              >
                {isCheckingPhone ? (
                  <>
                    <RefreshCw className="w-5 h-5 sm:w-7 sm:h-7 animate-spin" />
                    <span>{t('Checking Patient Record...', 'रोगी रिकॉर्ड जांचा जा रहा है...', 'சரிபார்க்கப்படுகிறது...', 'పరిశీలిస్తోంది...')}</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-5 h-5 sm:w-7 sm:h-7" />
                    <span>{t('Continue to PIN Login', 'पिन लॉगिन जारी रखें', 'PIN உள்நுழைவுக்கு தொடரவும்', 'PIN లాగిన్ కొనసాగించండి')}</span>
                    <ArrowRight className="w-5 h-5 sm:w-7 sm:h-7" />
                  </>
                )}
              </button>
            </div>
          )}

          {loginStep === 'pin' && (
            /* Step 2: 6-Digit PIN Verification */
            <div className="space-y-4 sm:space-y-6">
              <div className="flex items-center justify-between bg-blue-50 border-2 border-blue-300 rounded-xl sm:rounded-2xl p-3 sm:p-4">
                <div className="flex items-center gap-2 sm:gap-3 text-left">
                  <Phone className="w-5 h-5 sm:w-6 sm:h-6 text-blue-700 shrink-0" />
                  <div>
                    {returningPatientName && (
                      <span className="block text-xs sm:text-sm font-black text-blue-900">
                        {returningPatientName}
                      </span>
                    )}
                    <span className="text-base sm:text-xl font-extrabold text-blue-950 font-mono">
                      +91 {loginMobile || 'Patient'}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setLoginStep('phone')
                    setLoginPin('')
                    setErrorMessage('')
                  }}
                  className="text-xs sm:text-base font-black text-blue-700 underline hover:text-blue-900 flex items-center gap-1"
                >
                  <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span>{t('Change Number', 'नंबर बदलें', 'எண்ணை மாற்றவும்', 'నంబరు మార్చండి')}</span>
                </button>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5 sm:mb-3">
                  <label className="text-base sm:text-xl md:text-2xl font-extrabold text-slate-800 flex items-center gap-2">
                    <Lock className="w-5 h-5 sm:w-6 sm:h-6 text-blue-700 shrink-0" />
                    <span>{t('Enter 6-Digit Login PIN', '6 अंकों का लॉगिन पिन दर्ज करें', '6 இலக்க உள்நுழைவு பின்னை உள்ளிடவும்', '6 అంకెల లాగిన్ పిన్ నమోదు చేయండి')}</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowLoginPin(!showLoginPin)}
                    className="text-xs sm:text-sm font-extrabold text-blue-700 underline hover:text-blue-900 flex items-center gap-1"
                  >
                    {showLoginPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>{showLoginPin ? t('Hide PIN', 'पिन छिपाएं') : t('Show PIN', 'पिन दिखाएं')}</span>
                  </button>
                </div>

                <input
                  type={showLoginPin ? "text" : "password"}
                  inputMode="numeric"
                  maxLength={6}
                  value={loginPin}
                  onChange={(e) => setLoginPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="------"
                  className="w-full py-3.5 sm:py-5 px-3 sm:px-6 text-2xl sm:text-4xl font-black text-center tracking-[0.3em] sm:tracking-[0.5em] text-blue-950 bg-white border-2 sm:border-4 border-blue-600 rounded-xl sm:rounded-2xl focus:ring-2 sm:focus:ring-4 focus:ring-blue-200 outline-none shadow-inner"
                />
              </div>

              {/* Action "Verify PIN & Start Consultation" Button */}
              <button
                type="button"
                onClick={handlePinLogin}
                disabled={isVerifyingPin || loginPin.length !== 6}
                className="w-full py-3.5 sm:py-5 px-4 sm:px-8 text-base sm:text-2xl rounded-xl sm:rounded-2xl font-black text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 disabled:bg-slate-300 disabled:cursor-not-allowed transition-all shadow-xl flex items-center justify-center gap-2.5 sm:gap-4"
              >
                {isVerifyingPin ? (
                  <>
                    <RefreshCw className="w-5 h-5 sm:w-7 sm:h-7 animate-spin" />
                    <span>{t('Verifying PIN...', 'पिन सत्यापित हो रहा है...', 'PIN சரிபார்க்கப்படுகிறது...', 'PIN ధృవీకరించబడుతోంది...')}</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-5 h-5 sm:w-7 sm:h-7" />
                    <span>{t('Verify PIN & Start Consultation', 'पिन सत्यापित करें और परामर्श शुरू करें', 'சரிபார்த்து ஆலோசனையைத் தொடங்கவும்', 'ధృవీకరించి సంప్రదింపులను ప్రారంభించండి')}</span>
                  </>
                )}
              </button>
            </div>
          )}

          {loginStep === 'otp' && (
            /* Step 2 (Alternative): 6-Digit OTP Verification */
            <div className="space-y-4 sm:space-y-6">
              <div className="flex items-center justify-between bg-blue-50 border-2 border-blue-300 rounded-xl sm:rounded-2xl p-3 sm:p-4">
                <div className="flex items-center gap-2 sm:gap-3">
                  <Phone className="w-5 h-5 sm:w-6 sm:h-6 text-blue-700 shrink-0" />
                  <span className="text-base sm:text-xl font-extrabold text-blue-950 font-mono">
                    +91 {loginMobile}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setLoginStep('phone')
                    setLoginOtp('')
                    setErrorMessage('')
                  }}
                  className="text-xs sm:text-base font-black text-blue-700 underline hover:text-blue-900 flex items-center gap-1"
                >
                  <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span>{t('Change Number', 'नंबर बदलें', 'எண்ணை மாற்றவும்', 'నంబరు మార్చండి')}</span>
                </button>
              </div>

              <div>
                <label className="block text-base sm:text-xl md:text-2xl font-extrabold text-slate-800 mb-1.5 sm:mb-3">
                  {t('Enter 6-Digit OTP', '6 अंकों का ओटीपी दर्ज करें', '6 இலக்க OTP ஐ உள்ளிடவும்', '6 అంకెల OTP ని నమోదు చేయండి')}
                </label>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={6}
                  value={loginOtp}
                  onChange={(e) => setLoginOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="------"
                  className="w-full py-3.5 sm:py-5 px-3 sm:px-6 text-2xl sm:text-4xl font-black text-center tracking-[0.3em] sm:tracking-[0.5em] text-blue-950 bg-white border-2 sm:border-4 border-blue-600 rounded-xl sm:rounded-2xl focus:ring-2 sm:focus:ring-4 focus:ring-blue-200 outline-none shadow-inner"
                />

                {/* Resend OTP countdown */}
                <div className="mt-2.5 sm:mt-4 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setLoginStep('pin')}
                    className="text-xs sm:text-base font-bold text-blue-700 underline"
                  >
                    {t('Switch to PIN Login', 'पिन लॉगिन पर स्विच करें')}
                  </button>

                  {resendTimer > 0 ? (
                    <span className="text-xs sm:text-base font-bold text-slate-500">
                      {t(`Resend in ${resendTimer}s`, `${resendTimer}s में पुनः भेजें`)}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      className="text-xs sm:text-base font-black text-blue-700 underline hover:text-blue-900 flex items-center gap-1.5"
                    >
                      <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5" />
                      <span>{t('Resend OTP', 'ओटीपी पुनः भेजें')}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Action "Verify & Proceed" Button */}
              <button
                type="button"
                onClick={handleVerifyLogin}
                disabled={isVerifyingOtp || loginOtp.length !== 6}
                className="w-full py-3.5 sm:py-5 px-4 sm:px-8 text-base sm:text-2xl rounded-xl sm:rounded-2xl font-black text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 disabled:bg-slate-300 disabled:cursor-not-allowed transition-all shadow-xl flex items-center justify-center gap-2.5 sm:gap-4"
              >
                {isVerifyingOtp ? (
                  <>
                    <RefreshCw className="w-5 h-5 sm:w-7 sm:h-7 animate-spin" />
                    <span>{t('Verifying OTP...', 'ओटीपी सत्यापित हो रहा है...', 'OTP சரிபார்க்கப்படுகிறது...', 'OTP ధృవీకరించబడుతోంది...')}</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-5 h-5 sm:w-7 sm:h-7" />
                    <span>{t('Verify & Start Consultation', 'सत्यापित करें और परामर्श शुरू करें', 'சரிபார்த்து ஆலோசனையைத் தொடங்கவும்', 'ధృవీకరించి సంప్రదింపులను ప్రారంభించండి')}</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* 2. NEW PATIENT REGISTRATION FLOW                                    */}
      {/* =================================================================== */}
      {authMode === 'register' && (
        <form onSubmit={handleRegister} className="space-y-4 sm:space-y-6">
          {/* 1. Full Name */}
          <div>
            <label className="block text-sm sm:text-lg md:text-xl font-extrabold text-slate-800 mb-1 sm:mb-2">
              {t('1. Full Name', '1. पूरा नाम', '1. முழுப் பெயர்', '1. పూర్తి పేరు')} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder={t('e.g. Ramesh Patel', 'उदा. रमेश पटेल', 'எ.கா. ரமேஷ் பட்டேல்', 'ఉదా. రమేష్ పటేల్')}
              className="w-full p-3 sm:p-4 text-base sm:text-xl font-bold text-slate-900 bg-white border-2 sm:border-4 border-slate-300 rounded-xl sm:rounded-2xl focus:border-blue-600 focus:ring-2 sm:focus:ring-4 focus:ring-blue-100 outline-none shadow-inner"
            />
          </div>

          {/* 2. Mobile Number */}
          <div>
            <label className="block text-sm sm:text-lg md:text-xl font-extrabold text-slate-800 mb-1 sm:mb-2">
              {t('2. Mobile Number (10 Digits)', '2. मोबाइल नंबर (10 अंक)', '2. மொபைல் எண் (10 இலக்கங்கள்)', '2. మొబైల్ నంబర్ (10 అంకెలు)')} <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 sm:pl-6 flex items-center pointer-events-none text-base sm:text-xl font-black text-slate-400">
                +91
              </div>
              <input
                type="tel"
                inputMode="numeric"
                maxLength={10}
                required
                value={regMobile}
                onChange={(e) => setRegMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="9876543210"
                className="w-full pl-16 sm:pl-20 pr-4 sm:pr-6 py-3 sm:py-4 text-base sm:text-xl font-bold tracking-wider text-slate-900 bg-white border-2 sm:border-4 border-slate-300 rounded-xl sm:rounded-2xl focus:border-blue-600 focus:ring-2 sm:focus:ring-4 focus:ring-blue-100 outline-none shadow-inner"
              />
            </div>
          </div>

          {/* 3. Gender */}
          <div>
            <label className="block text-sm sm:text-lg md:text-xl font-extrabold text-slate-800 mb-1 sm:mb-2">
              {t('3. Gender', '3. लिंग', '3. பாலினம்', '3. లింగం')} <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2 sm:gap-4">
              <button
                type="button"
                onClick={() => setGender('M')}
                className={`py-2.5 sm:py-4 px-2 text-sm sm:text-xl font-black rounded-xl sm:rounded-2xl border-2 sm:border-4 transition-all flex flex-col items-center justify-center gap-0.5 sm:gap-1 active:scale-95 ${
                  gender === 'M'
                    ? 'bg-blue-700 text-white border-blue-950 shadow-lg sm:shadow-xl scale-[1.01] sm:scale-[1.02]'
                    : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400'
                }`}
              >
                <span>{t('Male', 'पुरुष', 'ஆண்', 'పురుషుడు')}</span>
                <span className="text-[10px] sm:text-xs font-bold opacity-80">(M)</span>
              </button>

              <button
                type="button"
                onClick={() => setGender('F')}
                className={`py-2.5 sm:py-4 px-2 text-sm sm:text-xl font-black rounded-xl sm:rounded-2xl border-2 sm:border-4 transition-all flex flex-col items-center justify-center gap-0.5 sm:gap-1 active:scale-95 ${
                  gender === 'F'
                    ? 'bg-rose-700 text-white border-rose-950 shadow-lg sm:shadow-xl scale-[1.01] sm:scale-[1.02]'
                    : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400'
                }`}
              >
                <span>{t('Female', 'महिला', 'பெண்', 'స్త్రీ')}</span>
                <span className="text-[10px] sm:text-xs font-bold opacity-80">(F)</span>
              </button>

              <button
                type="button"
                onClick={() => setGender('O')}
                className={`py-2.5 sm:py-4 px-2 text-sm sm:text-xl font-black rounded-xl sm:rounded-2xl border-2 sm:border-4 transition-all flex flex-col items-center justify-center gap-0.5 sm:gap-1 active:scale-95 ${
                  gender === 'O'
                    ? 'bg-purple-700 text-white border-purple-950 shadow-lg sm:shadow-xl scale-[1.01] sm:scale-[1.02]'
                    : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400'
                }`}
              >
                <span>{t('Other', 'अन्य', 'மற்றவை', 'ఇతర')}</span>
                <span className="text-[10px] sm:text-xs font-bold opacity-80">(O)</span>
              </button>
            </div>
          </div>

          {/* 4. Age */}
          <div>
            <label className="block text-sm sm:text-lg md:text-xl font-extrabold text-slate-800 mb-1 sm:mb-2">
              {t('4. Age (Years)', '4. आयु (वर्ष)', '4. வயது (ஆண்டுகள்)', '4. వయస్సు (సంవత్సరాలు)')} <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min={1}
              max={120}
              required
              value={age}
              onChange={(e) => setAge(e.target.value)}
              placeholder="e.g. 42"
              className="w-full p-3 sm:p-4 text-base sm:text-xl font-bold text-slate-900 bg-white border-2 sm:border-4 border-slate-300 rounded-xl sm:rounded-2xl focus:border-blue-600 focus:ring-2 sm:focus:ring-4 focus:ring-blue-100 outline-none shadow-inner"
            />
          </div>

          {/* 5. PIN Code (The Magic Feature) */}
          <div className="bg-blue-50 border-2 sm:border-4 border-blue-200 rounded-2xl sm:rounded-3xl p-3.5 sm:p-6 space-y-3 sm:space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5 sm:mb-2 flex-wrap gap-1">
                <label className="text-sm sm:text-lg md:text-xl font-extrabold text-blue-950 flex items-center gap-1.5 sm:gap-2">
                  <MapPin className="w-5 h-5 sm:w-6 sm:h-6 text-blue-700 shrink-0" />
                  <span>{t('5. PIN Code', '5. पिन कोड', '5. அஞ்சல் குறியீடு', '5. పిన్ కోడ్')} <span className="text-red-500">*</span></span>
                </label>
                {pinLoading && (
                  <span className="text-xs sm:text-sm font-black text-blue-700 flex items-center gap-1 animate-pulse">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>{t('Finding District & State...', 'स्थान खोज रहे हैं...', 'இடம் தேடப்படுகிறது...', 'స్థలాన్ని శోధిస్తోంది...')}</span>
                  </span>
                )}
                {pinResolved && (
                  <span className="text-xs sm:text-sm font-black text-emerald-800 bg-emerald-100 border border-emerald-400 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{t('Postal Auto-Resolved', 'पिन कोड सत्यापित', 'அஞ்சல் குறியீடு சரிபார்க்கப்பட்டது', 'పిన్ కోడ్ ధృవీకరించబడింది')}</span>
                  </span>
                )}
              </div>

              <input
                type="tel"
                inputMode="numeric"
                maxLength={6}
                required
                value={pinCode}
                onChange={(e) => setPinCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="226001"
                className="w-full p-3 sm:p-4 text-xl sm:text-2xl font-black tracking-widest text-slate-900 bg-white border-2 sm:border-4 border-blue-400 rounded-xl sm:rounded-2xl focus:border-blue-700 focus:ring-2 sm:focus:ring-4 focus:ring-blue-200 outline-none shadow-inner"
              />
              <p className="text-xs sm:text-sm font-bold text-blue-800 mt-1.5">
                {t('Type exactly 6 digits to automatically fill District and State.', 'जिला और राज्य अपने आप भरने के लिए 6 अंक टाइप करें।', 'மாவட்டம் மற்றும் மாநிலத்தை நிரப்ப சரியாக 6 இலக்கங்களை தட்டச்சு செய்யவும்.', 'జిల్లా మరియు రాష్ట్రాన్ని పూరించడానికి సరిగ్గా 6 అంకెలను టైప్ చేయండి.')}
              </p>
              {pinError && (
                <p className="text-xs sm:text-sm font-black text-red-600 mt-1">{pinError}</p>
              )}
            </div>

            {/* Read-Only District & State Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-4 pt-1">
              <div>
                <label className="block text-xs sm:text-sm font-extrabold text-slate-700 mb-1">
                  {t('District (Auto-filled)', 'जिला (स्वतः भरा गया)', 'மாவட்டம் (தானாக நிரப்பப்பட்டது)', 'జిల్లా (స్వయంచాలకంగా పూరించబడింది)')}
                </label>
                <input
                  type="text"
                  readOnly
                  value={district}
                  placeholder={t('Auto-populated from PIN', 'पिन से स्वतः भरा जाएगा', 'அஞ்சல் குறியீட்டிலிருந்து தானாகவே நிரப்பப்படும்', 'పిన్ నుండి స్వయంచాలకంగా పూరించబడుతుంది')}
                  className="w-full p-2.5 sm:p-3 text-sm sm:text-base font-extrabold bg-slate-200/90 text-slate-800 border border-slate-300 rounded-xl cursor-not-allowed shadow-inner"
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-extrabold text-slate-700 mb-1">
                  {t('State (Auto-filled)', 'राज्य (स्वतः भरा गया)', 'மாநிலம் (தானாக நிரப்பப்பட்டது)', 'రాష్ట్రం (స్వయంచాలకంగా పూరించబడింది)')}
                </label>
                <input
                  type="text"
                  readOnly
                  value={stateName}
                  placeholder={t('Auto-populated from PIN', 'पिन से स्वतः भरा जाएगा', 'அஞ்சல் குறியீட்டிலிருந்து தானாகவே நிரப்பப்படும்', 'పిన్ నుండి స్వయంచాలకంగా పూరించబడుతుంది')}
                  className="w-full p-2.5 sm:p-3 text-sm sm:text-base font-extrabold bg-slate-200/90 text-slate-800 border border-slate-300 rounded-xl cursor-not-allowed shadow-inner"
                />
              </div>
            </div>
          </div>

          {/* 6. Create 6-Digit Login PIN */}
          <div className="bg-emerald-50 border-2 sm:border-4 border-emerald-300 rounded-2xl sm:rounded-3xl p-3.5 sm:p-6 space-y-2 sm:space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <label className="text-sm sm:text-lg md:text-xl font-extrabold text-emerald-950 flex items-center gap-1.5 sm:gap-2">
                <Lock className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-700 shrink-0" />
                <span>{t('6. Create 6-Digit Login PIN', '6. 6 अंकों का लॉगिन पिन बनाएं', '6. 6 இலக்க உள்நுழைவு பின்னை உருவாக்கவும்', '6. 6 అంకెల లాగిన్ పిన్ సృష్టించండి')} <span className="text-red-500">*</span></span>
              </label>
              <button
                type="button"
                onClick={() => setShowRegPin(!showRegPin)}
                className="text-xs sm:text-sm font-extrabold text-emerald-800 underline hover:text-emerald-950 flex items-center gap-1"
              >
                {showRegPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span>{showRegPin ? t('Hide PIN', 'पिन छिपाएं') : t('Show PIN', 'पिन दिखाएं')}</span>
              </button>
            </div>

            <input
              type={showRegPin ? "text" : "password"}
              inputMode="numeric"
              maxLength={6}
              required
              value={regPin}
              onChange={(e) => setRegPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="------"
              className="w-full p-3 sm:p-4 text-2xl sm:text-3xl font-black text-center tracking-[0.3em] sm:tracking-[0.5em] text-emerald-950 bg-white border-2 sm:border-4 border-emerald-500 rounded-xl sm:rounded-2xl focus:border-emerald-700 focus:ring-2 sm:focus:ring-4 focus:ring-emerald-200 outline-none shadow-inner"
            />
            <p className="text-xs sm:text-sm font-bold text-emerald-800">
              {t(
                'Remember this 6-digit PIN! You will use it to log in at any AarogyaMitra kiosk.',
                'यह 6 अंकों का पिन याद रखें! अगली बार लॉग इन करने के लिए आप इस पिन का उपयोग करेंगे।',
                'இந்த 6 இலக்க பின்னை நினைவில் கொள்ளுங்கள்! அடுத்த முறை உள்நுழைய இதைப் பயன்படுத்துவீர்கள்.',
                'ఈ 6 అంకెల పిన్‌ను గుర్తుంచుకోండి! తదుపరిసారి లాగిన్ చేయడానికి దీన్ని ఉపయోగిస్తారు.'
              )}
            </p>
          </div>

          {/* 7. Submit Button */}
          <button
            type="submit"
            disabled={isSubmittingReg}
            className="w-full py-3.5 sm:py-5 px-5 sm:px-8 text-base sm:text-2xl rounded-xl sm:rounded-2xl font-black text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 disabled:bg-slate-300 disabled:cursor-not-allowed transition-all shadow-xl flex items-center justify-center gap-2.5 sm:gap-4 mt-5 sm:mt-8"
          >
            {isSubmittingReg ? (
              <>
                <RefreshCw className="w-5 h-5 sm:w-7 sm:h-7 animate-spin" />
                <span>{t('Registering Patient...', 'रोगी पंजीकृत हो रहा है...', 'நோயாளி பதிவு செய்யப்படுகிறார்...', 'రోగి నమోదు చేయబడుతున్నారు...')}</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                <span>{t('Register & Start Consultation', 'पंजीकरण करें और परामर्श शुरू करें', 'பதிவுசெய்து ஆலோசனையைத் தொடங்கவும்', 'నమోదు చేసి సంప్రదింపులు ప్రారంభించండి')}</span>
              </>
            )}
          </button>
        </form>
      )}
    </div>
  )
}
