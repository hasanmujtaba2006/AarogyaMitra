'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Stethoscope, User } from 'lucide-react'
import { useLanguage } from '@/context/LanguageContext'

export default function Header() {
  const pathname = usePathname()
  const { t } = useLanguage()
  
  return (
    <header className="bg-white border-b-2 border-slate-100 py-4 px-6 sticky top-0 z-50 shadow-sm">
      <div className="container mx-auto max-w-7xl flex flex-col md:flex-row justify-between items-center gap-4">
        
        {/* Left Side: MoHFW Logo & Kiosk Branding */}
        <div className="flex items-center gap-3 sm:gap-4 shrink-0 justify-center md:justify-start w-full md:w-auto">
            <img
              src="/logos/mohfw-logo.png"
              alt="Ministry of Health and Family Welfare"
              className="h-10 sm:h-12 w-auto object-contain"
            />
            <div className="h-12 w-px bg-slate-200 hidden sm:block"></div>
          <div className="flex flex-col">
            <span className="text-2xl md:text-3xl font-black tracking-tight text-blue-900 leading-none">आरोग्यMitra</span>
            <span className="bg-blue-50 text-blue-800 text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider w-fit mt-1">
              {t('Kiosk System', 'कियोस्क सिस्टम', 'கியோஸ்க் முறைமை', 'కియోస్క్ సిస్టమ్')}
            </span>
          </div>
        </div>

        {/* Navigation / Role Switcher & Language Switcher */}
        <div className="flex items-center gap-3 sm:gap-4 justify-center flex-wrap">
          <nav className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/"
              className={`flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-2xl transition-all border text-sm sm:text-base font-bold ${
                pathname === '/' 
                  ? 'bg-blue-50 text-blue-900 border-blue-200 shadow-sm' 
                  : 'hover:bg-slate-50 text-slate-600 border-transparent'
              }`}
            >
              <User className="w-5 h-5 text-blue-900" />
              <span>{t('Patient Kiosk', 'रोगी कियोस्क', 'நோயாளி கியோஸ்க்', 'రోగి కియోస్క్')}</span>
            </Link>
            <Link
              href="/doctor"
              className={`flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-2xl transition-all border text-sm sm:text-base font-bold ${
                pathname === '/doctor' 
                  ? 'bg-slate-100 text-slate-900 border-slate-200 shadow-sm' 
                  : 'hover:bg-slate-50 text-slate-600 border-transparent'
              }`}
            >
              <Stethoscope className="w-5 h-5 text-slate-900" />
              <span>{t('Doctor OPD', 'डॉक्टर ओपीडी', 'மருத்துவர் OPD', 'వైద్యుల OPD')}</span>
            </Link>
          </nav>
        </div>

        {/* Right Side: ABDM Logo */}
        <div className="flex items-center justify-end shrink-0">
          <img
            src="/logos/abdm-logo.png"
            alt="Ayushman Bharat Digital Mission"
            className="h-16 md:h-20 w-auto object-contain"
          />
        </div>

      </div>
    </header>
  )
}
