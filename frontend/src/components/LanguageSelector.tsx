'use client'

import React, { useState } from 'react'
import { Check, Globe, Sparkles, Volume2, ArrowRight, ShieldCheck } from 'lucide-react'
import { LanguageCode, SUPPORTED_LANGUAGES, useLanguage } from '@/context/LanguageContext'

interface LanguageSelectorProps {
  onLanguageSelected: (lang: LanguageCode) => void;
}

export default function LanguageSelector({ onLanguageSelected }: LanguageSelectorProps) {
  const { language, setLanguage } = useLanguage()
  const [selectedLang, setSelectedLang] = useState<LanguageCode>(language || 'en')

  const greetings: Record<LanguageCode, { welcome: string; prompt: string; button: string }> = {
    en: {
      welcome: 'Welcome to AarogyaMitra Kiosk',
      prompt: 'Please select your preferred consultation language',
      button: 'Continue to Patient Login'
    },
    hi: {
      welcome: 'आरोग्यमित्र कियोस्क में आपका स्वागत है',
      prompt: 'कृपया परामर्श के लिए अपनी पसंदीदा भाषा चुनें',
      button: 'रोगी लॉगिन पर आगे बढ़ें'
    },
    ta: {
      welcome: 'ஆரோக்கியமித்ரா கியோஸ்கிற்கு நல்வரவு',
      prompt: 'தயவுசெய்து உங்கள் விருப்பமான மொழியைத் தேர்ந்தெடுக்கவும்',
      button: 'நோயாளி உள்நுழைவுக்கு தொடரவும்'
    },
    te: {
      welcome: 'ఆరోగ్యమిత్ర కియోస్క్‌కి స్వాగతం',
      prompt: 'దయచేసి మీ ప్రాధాన్య సంప్రదింపుల భాషను ఎంచుకోండి',
      button: 'రోగి లాగిన్‌కు కొనసాగండి'
    }
  }

  const handleCardClick = (code: LanguageCode) => {
    setSelectedLang(code)
    setLanguage(code)
    // Audio hint using speech synthesis if supported
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel()
        const textToSpeak: Record<LanguageCode, { text: string; lang: string }> = {
          en: { text: 'English selected. Proceeding to login.', lang: 'en-IN' },
          hi: { text: 'हिन्दी भाषा चुनी गई। लॉगिन की ओर बढ़ रहे हैं।', lang: 'hi-IN' },
          ta: { text: 'தமிழ் மொழி தேர்ந்தெடுக்கப்பட்டது.', lang: 'ta-IN' },
          te: { text: 'తెలుగు భాష ఎంచుకోబడింది.', lang: 'te-IN' }
        }
        const item = textToSpeak[code]
        const utterance = new SpeechSynthesisUtterance(item.text)
        utterance.lang = item.lang
        utterance.rate = 0.95
        window.speechSynthesis.speak(utterance)
      } catch (e) {
        // Speech synthesis optional
      }
    }
  }

  const handleConfirm = () => {
    setLanguage(selectedLang)
    onLanguageSelected(selectedLang)
  }

  const currentInfo = greetings[selectedLang] || greetings.en

  return (
    <div className="w-full max-w-4xl mx-auto my-3 sm:my-6 px-2 sm:px-4">
      <div className="bg-white rounded-2xl sm:rounded-3xl border-2 sm:border-4 border-slate-900 shadow-xl sm:shadow-2xl p-4 sm:p-8 md:p-10 text-slate-900 overflow-hidden">
        {/* Top Header Badge */}
        <div className="text-center mb-5 sm:mb-8">
          <div className="inline-flex items-center gap-2 px-3.5 sm:px-5 py-1.5 sm:py-2 rounded-full bg-blue-50 border-2 border-blue-500 text-blue-900 text-xs sm:text-base font-extrabold tracking-wide mb-3 sm:mb-4">
            <Globe className="w-4 h-4 sm:w-6 sm:h-6 text-blue-700 animate-pulse" />
            <span>LANGUAGE PREFERENCE / भाषा चयन</span>
          </div>

          <h1 className="text-2xl sm:text-4xl md:text-5xl font-black text-slate-900 tracking-tight leading-tight">
            {currentInfo.welcome}
          </h1>
          <p className="text-base sm:text-xl md:text-2xl text-slate-600 font-bold mt-1.5 sm:mt-2">
            {currentInfo.prompt}
          </p>

          <p className="text-xs sm:text-sm text-slate-400 font-semibold mt-1">
            Touch any language card below. Once you log in, your choice is remembered automatically.
          </p>
        </div>

        {/* 4 Large Touch-Friendly Language Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-5 mb-5 sm:mb-8">
          {SUPPORTED_LANGUAGES.map((item) => {
            const isSelected = selectedLang === item.code
            return (
              <button
                key={item.code}
                type="button"
                onClick={() => handleCardClick(item.code)}
                className={`relative p-3.5 sm:p-6 rounded-2xl sm:rounded-3xl border-2 sm:border-4 text-left transition-all flex flex-col justify-between gap-2.5 sm:gap-4 active:scale-95 shadow-md ${
                  isSelected
                    ? 'border-blue-700 bg-blue-50/70 ring-2 sm:ring-4 ring-blue-200 shadow-xl scale-[1.01] sm:scale-[1.02]'
                    : 'border-slate-200 sm:border-slate-300 bg-slate-50 hover:bg-slate-100 hover:border-slate-400'
                }`}
              >
                {/* Checkmark Indicator on top right */}
                {isSelected && (
                  <div className="absolute top-3 sm:top-4 right-3 sm:right-4 bg-blue-700 text-white rounded-full p-1 sm:p-1.5 shadow-md">
                    <Check className="w-4 h-4 sm:w-5 sm:h-5 stroke-[3]" />
                  </div>
                )}

                <div className="flex items-center gap-3 sm:gap-4">
                  <div
                    className={`w-11 h-11 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl flex items-center justify-center font-black text-xl sm:text-2xl shrink-0 shadow-inner ${
                      isSelected
                        ? 'bg-blue-700 text-white'
                        : 'bg-white text-slate-700 border-2 border-slate-200'
                    }`}
                  >
                    {item.symbol}
                  </div>
                  <div>
                    <h3 className="text-xl sm:text-3xl font-black text-slate-900 leading-tight">
                      {item.nativeName}
                    </h3>
                    <p className="text-xs sm:text-base font-bold text-slate-500">
                      {item.name}
                    </p>
                  </div>
                </div>

                <p className="text-xs sm:text-sm font-semibold text-slate-600 border-t border-slate-200/80 pt-2 sm:pt-3">
                  {item.subtext}
                </p>
              </button>
            )
          })}
        </div>

        {/* Big Action Button to Proceed to Login */}
        <button
          type="button"
          onClick={handleConfirm}
          className="w-full py-3.5 sm:py-5 px-5 sm:px-8 text-base sm:text-2xl rounded-xl sm:rounded-2xl font-black text-white bg-blue-700 hover:bg-blue-800 active:scale-95 transition-all shadow-xl flex items-center justify-center gap-2.5 sm:gap-4"
        >
          <span>{currentInfo.button}</span>
          <ArrowRight className="w-5 h-5 sm:w-8 sm:h-8" />
        </button>

        {/* Footer info note */}
        <div className="mt-4 sm:mt-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] sm:text-xs font-bold text-slate-400 text-center sm:text-left border-t border-slate-100 pt-3 sm:pt-4">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600 shrink-0" />
            <span>Bhashini AI Multilingual Speech & Translation Engine Enabled</span>
          </div>
          <span>Switchable in dashboard anytime</span>
        </div>
      </div>
    </div>
  )
}
