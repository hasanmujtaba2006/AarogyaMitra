'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Stethoscope, User } from 'lucide-react'
import { useLanguage } from '@/context/LanguageContext'

export default function Header() {
  const pathname = usePathname()
  const { t } = useLanguage()
  
  return (
    <header className="bg-white border-b border-slate-200 py-2.5 sm:py-3.5 px-3 sm:px-6 sticky top-0 z-50 shadow-sm print:hidden">
      <div className="container mx-auto max-w-7xl flex flex-col md:flex-row justify-between items-center gap-2.5 sm:gap-4">
        
        {/* Top/Left Row: AarogyaMitra Branding + ABDM Mobile Icon */}
        <div className="flex items-center justify-between w-full md:w-auto shrink-0">
          <Link href="/" className="flex items-center gap-2.5 sm:gap-3.5 group">
            <img
              src="/logos/aarogyamlogo.png"
              alt="AarogyaMitra Logo"
              className="h-8 sm:h-10 md:h-11 w-auto object-contain transition-transform group-hover:scale-105"
            />
            <div className="h-8 w-px bg-slate-200 hidden xs:block sm:block"></div>
            <div className="flex flex-col">
              <span className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight text-blue-900 leading-none">
                आरोग्यMitra
              </span>
              <span className="bg-blue-50 text-blue-800 text-[9px] sm:text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider w-fit mt-0.5">
                {t('Kiosk System', 'कियोस्क सिस्टम', 'கியோஸ்க் முறைமை', 'కియోస్క్ సిస్టమ్')}
              </span>
            </div>
          </Link>

          {/* ABDM Logo shown on right side on mobile */}
          <div className="md:hidden shrink-0">
            <img
              src="/logos/abdm-logo.png"
              alt="Ayushman Bharat Digital Mission"
              className="h-9 sm:h-11 w-auto object-contain"
            />
          </div>
        </div>

        {/* Navigation / Role Switcher */}
        <div className="flex items-center justify-center w-full md:w-auto">
          <nav className="flex items-center gap-1.5 sm:gap-2.5 bg-slate-100/80 p-1 rounded-2xl border border-slate-200/80 w-full sm:w-auto justify-center">
            <Link
              href="/"
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl transition-all text-xs sm:text-sm font-bold ${
                pathname === '/' 
                  ? 'bg-white text-blue-900 shadow-sm border border-slate-200/80' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <User className="w-4 h-4 text-blue-700 shrink-0" />
              <span className="truncate">{t('Patient Kiosk', 'रोगी कियोस्क', 'நோயாளி கியோஸ்க்', 'రోగి కియోస్క్')}</span>
            </Link>
            <Link
              href="/doctor"
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl transition-all text-xs sm:text-sm font-bold ${
                pathname === '/doctor' 
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <Stethoscope className="w-4 h-4 text-slate-800 shrink-0" />
              <span className="truncate">{t('Doctor OPD', 'डॉक्टर ओपीडी', 'மருத்துவர் OPD', 'వైద్యుల OPD')}</span>
            </Link>
          </nav>
        </div>

        {/* Right Side: ABDM Logo (Desktop) */}
        <div className="hidden md:flex items-center justify-end shrink-0">
          <img
            src="/logos/abdm-logo.png"
            alt="Ayushman Bharat Digital Mission"
            className="h-12 lg:h-14 w-auto object-contain"
          />
        </div>

      </div>
    </header>
  )
}
