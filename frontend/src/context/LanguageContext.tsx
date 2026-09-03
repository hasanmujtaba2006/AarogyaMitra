'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'

export type LanguageCode = 'en' | 'hi' | 'ta' | 'te'

export interface LanguageOption {
  code: LanguageCode;
  name: string;
  nativeName: string;
  symbol: string;
  subtext: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    symbol: 'EN',
    subtext: 'Standard Indian English for medical consultation'
  },
  {
    code: 'hi',
    name: 'Hindi',
    nativeName: 'हिन्दी',
    symbol: 'अ',
    subtext: 'हिन्दी में स्वास्थ्य परामर्श और बातचीत के लिए'
  },
  {
    code: 'ta',
    name: 'Tamil',
    nativeName: 'தமிழ்',
    symbol: 'அ',
    subtext: 'தமிழில் மருத்துவ ஆலோசனை பெற இதைத் தேர்ந்தெடுக்கவும்'
  },
  {
    code: 'te',
    name: 'Telugu',
    nativeName: 'తెలుగు',
    symbol: 'అ',
    subtext: 'తెలుగులో ఆరోగ్య సంప్రదింపుల కోసం ఎంచుకోండి'
  }
]

interface LanguageContextType {
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  hasLoggedIn: boolean;
  setHasLoggedIn: (val: boolean) => void;
  languages: LanguageOption[];
  t: (en: string, hi?: string, ta?: string, te?: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export const STORAGE_KEY_LANG = 'aarogya_preferred_language'
export const STORAGE_KEY_LOGGED_IN = 'aarogya_has_logged_in'

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode>('en')
  const [hasLoggedIn, setHasLoggedInState] = useState<boolean>(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedLang = localStorage.getItem(STORAGE_KEY_LANG) as LanguageCode | null
      const savedLoggedIn = localStorage.getItem(STORAGE_KEY_LOGGED_IN)

      if (savedLang && ['en', 'hi', 'ta', 'te'].includes(savedLang)) {
        setLanguageState(savedLang)
      }
      if (savedLoggedIn === 'true') {
        setHasLoggedInState(true)
      }
    }
  }, [])

  const setLanguage = (lang: LanguageCode) => {
    setLanguageState(lang)
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_LANG, lang)
    }
  }

  const setHasLoggedIn = (val: boolean) => {
    setHasLoggedInState(val)
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_LOGGED_IN, val ? 'true' : 'false')
    }
  }

  const t = (en: string, hi?: string, ta?: string, te?: string): string => {
    if (language === 'hi' && hi) return hi
    if (language === 'ta' && ta) return ta
    if (language === 'te' && te) return te
    return en
  }

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        hasLoggedIn,
        setHasLoggedIn,
        languages: SUPPORTED_LANGUAGES,
        t
      }}
    >
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return context
}
