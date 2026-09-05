'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Globe, ChevronDown, Check } from 'lucide-react'
import { LanguageCode, SUPPORTED_LANGUAGES, useLanguage } from '@/context/LanguageContext'

interface LanguageSwitcherProps {
  variant?: 'header' | 'dashboard' | 'compact' | 'dropdown' | 'dark-dropdown';
  onLanguageChange?: (lang: LanguageCode) => void;
  className?: string;
}

export default function LanguageSwitcher({
  variant = 'header',
  onLanguageChange,
  className = ''
}: LanguageSwitcherProps) {
  const { language, setLanguage } = useLanguage()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (code: LanguageCode) => {
    setLanguage(code)
    setIsOpen(false)
    if (onLanguageChange) {
      onLanguageChange(code)
    }
  }

  const currentLangObj = SUPPORTED_LANGUAGES.find((l) => l.code === language) || SUPPORTED_LANGUAGES[0]

  // Dashboard banner variant: Pill buttons for large kiosk touchscreen
  if (variant === 'dashboard') {
    return (
      <div className={`flex items-center gap-2 bg-slate-800/90 border border-slate-700 p-1.5 rounded-2xl ${className}`}>
        <div className="flex items-center gap-1.5 px-2 text-slate-300">
          <Globe className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-bold uppercase tracking-wider hidden sm:inline">Lang:</span>
        </div>
        <div className="flex items-center gap-1">
          {SUPPORTED_LANGUAGES.map((item) => {
            const isSelected = language === item.code
            return (
              <button
                key={item.code}
                type="button"
                onClick={() => handleSelect(item.code)}
                title={item.name}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all active:scale-95 ${
                  isSelected
                    ? 'bg-emerald-500 text-slate-950 shadow-md scale-105'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
                }`}
              >
                {item.nativeName}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // Dark Dropdown variant for dark cards
  if (variant === 'dark-dropdown') {
    return (
      <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 sm:gap-2.5 px-3 sm:px-4 py-1.5 sm:py-2.5 rounded-xl sm:rounded-2xl border sm:border-2 border-slate-700 bg-slate-800/90 hover:bg-slate-800 text-white text-xs sm:text-sm font-extrabold transition-all shadow-md active:scale-95 focus:outline-none focus:ring-2 focus:ring-emerald-400"
          aria-expanded={isOpen}
          aria-haspopup="true"
        >
          <Globe className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400 shrink-0" />
          <span>{currentLangObj.nativeName}</span>
          <ChevronDown className={`w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <div className="absolute right-0 mt-2 w-52 sm:w-56 max-w-[calc(100vw-2rem)] rounded-2xl bg-slate-900 shadow-2xl border-2 border-slate-700 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
            <div className="px-3.5 py-1.5 border-b border-slate-800 text-[10px] font-black uppercase tracking-wider text-slate-400">
              Select Language / भाषा चुनें
            </div>
            {SUPPORTED_LANGUAGES.map((item) => {
              const isSelected = language === item.code
              return (
                <button
                  key={item.code}
                  type="button"
                  onClick={() => handleSelect(item.code)}
                  className={`w-full px-4 py-2.5 text-left text-sm font-bold flex items-center justify-between transition-colors ${
                    isSelected
                      ? 'bg-emerald-500/20 text-emerald-300 font-extrabold border-l-4 border-emerald-400'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 text-center text-xs font-black text-slate-400">
                      {item.symbol}
                    </span>
                    <span>{item.nativeName}</span>
                    <span className="text-xs text-slate-400 font-normal">({item.name})</span>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-emerald-400 stroke-[3]" />}
                </button>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // Header / Standard Dropdown variant: Compact dropdown with Globe icon
  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 sm:gap-2.5 px-3 sm:px-4 py-1.5 sm:py-2.5 rounded-xl sm:rounded-2xl border sm:border-2 border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-xs sm:text-sm font-extrabold transition-all shadow-sm active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-500"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <Globe className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-800 shrink-0" />
        <span className="text-xs sm:text-sm">{currentLangObj.nativeName}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-52 sm:w-56 max-w-[calc(100vw-2rem)] rounded-2xl bg-white shadow-2xl border-2 border-slate-200 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="px-3.5 py-1.5 border-b border-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-400">
            Select Language / भाषा चुनें
          </div>
          {SUPPORTED_LANGUAGES.map((item) => {
            const isSelected = language === item.code
            return (
              <button
                key={item.code}
                type="button"
                onClick={() => handleSelect(item.code)}
                className={`w-full px-4 py-2.5 text-left text-sm font-bold flex items-center justify-between transition-colors ${
                  isSelected
                    ? 'bg-blue-50 text-blue-900 font-extrabold border-l-4 border-blue-600'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-6 text-center text-xs font-black text-slate-400">
                    {item.symbol}
                  </span>
                  <span>{item.nativeName}</span>
                  <span className="text-xs text-slate-400 font-normal">({item.name})</span>
                </div>
                {isSelected && <Check className="w-4 h-4 text-blue-700 stroke-[3]" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
