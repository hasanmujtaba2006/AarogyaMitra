'use client'

import React, { useState } from 'react'
import { CreditCard, Shield, Key, ArrowRight, CheckCircle, AlertCircle, XCircle, MessageSquare, Languages } from 'lucide-react'

interface PatientInfo {
  id: string;
  abha_address: string;
  abha_number: string;
  full_name: string;
  gender: string;
  date_of_birth: string;
  mobile_number: string;
}

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
  const [step, setStep] = useState<'lang' | 'login' | 'otp' | 'success'>('lang')
  const [abhaAddress, setAbhaAddress] = useState('')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [patientInfo, setPatientInfo] = useState<PatientInfo | null>(null)

  const handleLanguageChange = (lang: string) => {
    setLanguage(lang)
  }

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!abhaAddress) {
      setError(language === 'hi' ? 'कृपया एबीएचए पता दर्ज करें।' : 'Please enter your ABHA Address')
      return
    }
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/abdm/lookup-abha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ abha_id: abhaAddress })
      })
      
      if (!res.ok) {
        let errorMsg = 'Failed to initialize authentication'
        try {
          const data = await res.json()
          errorMsg = data.detail || errorMsg
        } catch {
          errorMsg = `Server error (${res.status}). Please check if the backend is running properly.`
        }
        throw new Error(errorMsg)
      }
      
      const data = await res.json()
      setStep('otp')
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!otp || otp.length !== 6) {
      setError(language === 'hi' ? 'कृपया 6 अंकों का सही ओटीपी दर्ज करें।' : 'Please enter a valid 6-digit OTP')
      return
    }
    setError('')
    setLoading(true)
    try {
      const response = await fetch('/api/abdm/verify-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ abha_id: abhaAddress, otp }),
      })
      
      if (!response.ok) {
        let errorMsg = 'Invalid OTP. Please try again.'
        try {
          const data = await response.json()
          errorMsg = data.detail || errorMsg
        } catch {
          errorMsg = `Server error (${response.status}). Please check if the backend is running properly.`
        }
        throw new Error(errorMsg)
      }
      
      const data = await response.json()
      setPatientInfo(data.patient)
      onLoginSuccess(data.patient)
      setStep('success')
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    setPatientInfo(null)
    setAbhaAddress('')
    setOtp('')
    setStep('login')
  }

  const getGreeting = () => {
    const langObj = LANGUAGES.find(l => l.code === language)
    return langObj ? langObj.greeting : 'Welcome to AarogyaMitra'
  }

  return (
    <div className="bg-white p-6 rounded-xl shadow-md border border-slate-100 h-full flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <CreditCard className="w-6 h-6 text-emerald-600" />
            <div>
              <h2 className="font-semibold text-slate-800 text-lg">
                {language === 'hi' ? 'एबीएचए सत्यापन' : 'ABHA Verification'}
              </h2>
              <p className="text-xs text-slate-500">
                {language === 'hi' ? 'आयुष्मान भारत स्वास्थ्य खाता' : 'Ayushman Bharat Health Account'}
              </p>
            </div>
          </div>
          
          {step !== 'lang' && (
            <button
              type="button"
              onClick={() => setStep('lang')}
              className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold border border-emerald-200 hover:bg-emerald-50 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <Languages className="w-3.5 h-3.5" />
              {language === 'hi' ? 'भाषा बदलें' : 'Change Language'}
            </button>
          )}
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg flex items-start gap-2 text-sm border border-red-100">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* LANGUAGE SELECTION SCREEN */}
        {step === 'lang' && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600 font-medium">Please select your preferred language / कृपया अपनी पसंदीदा भाषा चुनें:</p>
            <div className="grid grid-cols-2 gap-3">
              {LANGUAGES.map(lang => (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => {
                    handleLanguageChange(lang.code)
                    setStep('login')
                  }}
                  className="py-2.5 px-4 border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/20 text-slate-700 hover:text-emerald-700 rounded-xl text-sm font-semibold transition-all text-left"
                >
                  {lang.native}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* LOGIN SCREEN */}
        {step === 'login' && (
          <form onSubmit={handleSendOTP} className="space-y-4">
            <div className="p-3 bg-emerald-50 text-emerald-800 rounded-lg flex gap-2 text-xs border border-emerald-100">
              <MessageSquare className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{getGreeting()}</span>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">
                {language === 'hi' ? 'एबीएचए पता' : 'ABHA Address'}
              </label>
              <input
                type="text"
                value={abhaAddress}
                onChange={(e) => setAbhaAddress(e.target.value)}
                placeholder="e.g., aditya_roy@abdm"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-700 text-sm font-medium"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (language === 'hi' ? 'ओटीपी भेजा जा रहा है...' : 'Sending OTP...') : (language === 'hi' ? 'ओटीपी भेजें' : 'Send OTP')}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* OTP VERIFICATION SCREEN */}
        {step === 'otp' && (
          <form onSubmit={handleVerifyOTP} className="space-y-4">
            <div className="p-3 bg-emerald-50 text-emerald-800 rounded-lg flex gap-2 text-xs border border-emerald-100">
              <MessageSquare className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                {language === 'hi' 
                  ? 'कृपया आपके पंजीकृत मोबाइल पर भेजा गया 6 अंकों का ओटीपी दर्ज करें।' 
                  : 'Please enter the 6-digit OTP sent to your registered mobile.'}
              </span>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">
                {language === 'hi' ? 'ओटीपी दर्ज करें' : 'Enter OTP'}
              </label>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="------"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-700 text-sm font-medium text-center tracking-widest font-semibold"
                maxLength={6}
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (language === 'hi' ? 'सत्यापित किया जा रहा है...' : 'Verifying...') : (language === 'hi' ? 'ओटीपी सत्यापित करें' : 'Verify OTP')}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* SUCCESS SCREEN */}
        {step === 'success' && patientInfo && (
          <div className="space-y-4">
            <div className="flex flex-col items-center justify-center p-4 bg-slate-50 rounded-xl border border-slate-100 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/5 rounded-bl-full flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-emerald-500 translate-x-1 -translate-y-1" />
              </div>
              
              <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-700 mb-2 font-bold text-lg">
                {patientInfo.full_name ? patientInfo.full_name[0] : 'U'}
              </div>
              
              <h3 className="font-semibold text-slate-800 text-base">{patientInfo.full_name}</h3>
              <p className="text-xs text-slate-500 font-mono mt-0.5">ABHA ID: {patientInfo.abha_number || 'N/A'}</p>
            </div>

            <div className="space-y-2.5 text-xs text-slate-600">
              <div className="flex justify-between py-1.5 border-b border-slate-50">
                <span className="text-slate-400">{language === 'hi' ? 'लिंग' : 'Gender'}</span>
                <span className="font-medium text-slate-700">{patientInfo.gender}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-50">
                <span className="text-slate-400">{language === 'hi' ? 'जन्म तिथि' : 'Date of Birth'}</span>
                <span className="font-medium text-slate-700">{patientInfo.date_of_birth}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-50">
                <span className="text-slate-400">{language === 'hi' ? 'मोबाइल' : 'Mobile'}</span>
                <span className="font-medium text-slate-700">{patientInfo.mobile_number}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {patientInfo && (
        <button
          onClick={handleLogout}
          type="button"
          className="w-full mt-4 py-2 px-4 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-sm font-medium transition-colors"
        >
          {language === 'hi' ? 'अंकमुक्त एबीएचए' : 'Unlink ABHA'}
        </button>
      )}
    </div>
  )
}
