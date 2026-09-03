'use client'

import React, { useState } from 'react'
import { ShieldCheck, CheckCircle2, Copy, Check, Printer, QrCode, User, MapPin, Phone, Calendar, ArrowRight } from 'lucide-react'

export interface PatientInfo {
  id: string | number;
  abha_address: string;
  abha_number: string;
  full_name: string;
  gender: string;
  date_of_birth: string;
  mobile_number: string;
  address?: string;
  district?: string;
  state?: string;
  pincode?: string;
  auth_method?: string;
  verification_status?: string;
}

interface AbhaCardProps {
  patient: PatientInfo;
  language?: string;
  onProceed?: () => void;
  onReset?: () => void;
  compact?: boolean;
}

export default function AbhaCard({
  patient,
  language = 'en',
  onProceed,
  onReset,
  compact = false
}: AbhaCardProps) {
  const [copied, setCopied] = useState(false)

  const handleCopyAbha = () => {
    if (patient.abha_number) {
      navigator.clipboard.writeText(patient.abha_number)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  const calculateAge = (dob: string) => {
    if (!dob) return ''
    try {
      const birthYear = parseInt(dob.split('-')[0], 10)
      if (isNaN(birthYear)) return ''
      const age = new Date().getFullYear() - birthYear
      return `${age} Yrs`
    } catch {
      return ''
    }
  }

  const ageStr = calculateAge(patient.date_of_birth)

  return (
    <div className="w-full flex flex-col items-center">
      {/* Official ABDM ABHA Digital Health Card */}
      <div 
        id="abha-card-printable"
        className="w-full max-w-lg bg-gradient-to-br from-white via-slate-50 to-emerald-50/30 rounded-2xl border-2 border-slate-200 shadow-xl overflow-hidden relative text-slate-800 transition-all hover:shadow-2xl"
      >
        {/* National Tricolor Top Ribbon */}
        <div className="h-2 w-full flex">
          <div className="h-full w-1/3 bg-[#FF9933]"></div>
          <div className="h-full w-1/3 bg-white border-y border-slate-100"></div>
          <div className="h-full w-1/3 bg-[#138808]"></div>
        </div>

        {/* Card Header */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center p-1 border border-white/20">
              <img 
                src="/logos/abdm-logo.png" 
                alt="ABDM" 
                className="w-full h-full object-contain brightness-110"
                onError={(e) => {
                  // Fallback if logo fails
                  (e.target as HTMLElement).style.display = 'none'
                }}
              />
            </div>
            <div>
              <p className="text-[10px] font-bold tracking-wider uppercase text-emerald-400">
                आयुष्मान भारत डिजिटल मिशन
              </p>
              <h4 className="text-xs font-black tracking-tight text-white sm:text-sm">
                National Health Authority (NHA)
              </h4>
            </div>
          </div>

          <div className="flex items-center gap-1.5 bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 px-2.5 py-1 rounded-full text-[11px] font-bold">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>ABHA VERIFIED</span>
          </div>
        </div>

        {/* Card Body */}
        <div className="p-5">
          <div className="flex items-start justify-between gap-4">
            
            {/* Left: Patient Details */}
            <div className="flex-1 space-y-3">
              <div>
                <span className="text-[10px] font-bold tracking-wider uppercase text-slate-400 block">
                  Beneficiary Name / लाभार्थी का नाम
                </span>
                <h3 className="text-lg font-black text-slate-900 tracking-tight leading-tight">
                  {patient.full_name}
                </h3>
              </div>

              {/* ABHA Number with Copy Button */}
              <div className="bg-slate-100/90 rounded-xl p-2.5 border border-slate-200/80">
                <span className="text-[10px] font-bold text-slate-500 block uppercase">
                  ABHA Number (14-Digit Universal ID)
                </span>
                <div className="flex items-center justify-between mt-0.5">
                  <span className="font-mono text-base sm:text-lg font-black tracking-wider text-blue-900">
                    {patient.abha_number || '91-XXXX-XXXX-XXXX'}
                  </span>
                  <button
                    onClick={handleCopyAbha}
                    type="button"
                    title="Copy ABHA Number"
                    className="p-1 hover:bg-slate-200 rounded-md text-slate-500 hover:text-slate-800 transition-colors"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Grid: Demographics */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 block font-semibold">ABHA Address</span>
                  <span className="font-semibold text-slate-700 font-mono text-[11px] truncate block">
                    {patient.abha_address}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-semibold">Gender / Age</span>
                  <span className="font-semibold text-slate-800">
                    {patient.gender === 'M' ? 'Male (पु)' : patient.gender === 'F' ? 'Female (स्त्री)' : patient.gender} {ageStr ? `• ${ageStr}` : ''}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-semibold">Date of Birth</span>
                  <span className="font-semibold text-slate-700">{patient.date_of_birth || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-semibold">Mobile</span>
                  <span className="font-semibold text-slate-700">{patient.mobile_number || 'N/A'}</span>
                </div>
              </div>

              {(patient.district || patient.state) && (
                <div className="text-xs pt-1 border-t border-slate-100">
                  <span className="text-[10px] text-slate-400 block font-semibold">Location / स्थान</span>
                  <span className="text-slate-600 font-medium text-[11px]">
                    {[patient.district, patient.state, patient.pincode].filter(Boolean).join(', ')}
                  </span>
                </div>
              )}
            </div>

            {/* Right: Verified Hologram + Stylized ABDM QR Code */}
            <div className="flex flex-col items-center shrink-0 space-y-2">
              <div className="w-24 h-24 bg-white p-1.5 rounded-xl border-2 border-slate-200 shadow-sm flex flex-col items-center justify-center relative overflow-hidden">
                {/* SVG ABDM Standard QR Code Display */}
                <svg className="w-full h-full text-slate-800" viewBox="0 0 100 100" fill="currentColor">
                  {/* Outer corner finders */}
                  <rect x="5" y="5" width="28" height="28" rx="4" fill="none" stroke="currentColor" strokeWidth="6" />
                  <rect x="12" y="12" width="14" height="14" fill="currentColor" />
                  
                  <rect x="67" y="5" width="28" height="28" rx="4" fill="none" stroke="currentColor" strokeWidth="6" />
                  <rect x="74" y="12" width="14" height="14" fill="currentColor" />
                  
                  <rect x="5" y="67" width="28" height="28" rx="4" fill="none" stroke="currentColor" strokeWidth="6" />
                  <rect x="12" y="74" width="14" height="14" fill="currentColor" />

                  {/* Realistic QR data matrix pattern elements */}
                  <rect x="40" y="8" width="6" height="6" />
                  <rect x="50" y="8" width="6" height="6" />
                  <rect x="45" y="18" width="6" height="6" />
                  <rect x="55" y="24" width="6" height="6" />
                  
                  <rect x="10" y="42" width="6" height="6" />
                  <rect x="20" y="48" width="6" height="6" />
                  <rect x="28" y="42" width="6" height="6" />

                  <rect x="40" y="40" width="20" height="20" rx="3" fill="#047857" />
                  <text x="50" y="54" fontSize="10" fontWeight="bold" textAnchor="middle" fill="white">A</text>

                  <rect x="68" y="42" width="6" height="6" />
                  <rect x="78" y="48" width="6" height="6" />
                  <rect x="86" y="40" width="6" height="6" />

                  <rect x="42" y="70" width="6" height="6" />
                  <rect x="52" y="76" width="6" height="6" />
                  <rect x="65" y="72" width="6" height="6" />
                  <rect x="75" y="80" width="6" height="6" />
                  <rect x="85" y="70" width="6" height="6" />
                  <rect x="60" y="88" width="6" height="6" />
                  <rect x="78" y="88" width="6" height="6" />
                </svg>

                <div className="absolute -bottom-1 bg-emerald-700 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full scale-90">
                  SCAN & SHARE
                </div>
              </div>

              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider text-center">
                {patient.auth_method?.replace('_', ' ') || 'VERIFIED'}
              </span>
            </div>
          </div>
        </div>

        {/* Card Footer */}
        <div className="px-5 py-2.5 bg-slate-100 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-500 font-medium">
          <div className="flex items-center gap-1 text-emerald-700 font-bold">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Digital Identity Authenticated</span>
          </div>
          <span className="font-mono text-slate-400">Govt. of India | Ayushman Bharat</span>
        </div>
      </div>

      {/* Action Controls (unless compact preview mode) */}
      {!compact && (
        <div className="w-full max-w-lg mt-5 space-y-3">
          {onProceed && (
            <button
              type="button"
              onClick={onProceed}
              className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-lg rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-700/20 active:scale-[0.98] transition-all"
            >
              <span>
                {language === 'hi' ? 'परामर्श जारी रखें' : 'Proceed to Medical Consultation'}
              </span>
              <ArrowRight className="w-5 h-5" />
            </button>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="flex-1 py-2.5 px-4 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 flex items-center justify-center gap-1.5 transition-colors shadow-sm"
            >
              <Printer className="w-4 h-4 text-slate-500" />
              <span>{language === 'hi' ? 'कार्ड प्रिंट करें' : 'Print / Save Health Card'}</span>
            </button>

            {onReset && (
              <button
                type="button"
                onClick={onReset}
                className="py-2.5 px-4 bg-white hover:bg-red-50 hover:text-red-700 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 transition-colors shadow-sm"
              >
                {language === 'hi' ? 'अन्य एबीएचए' : 'Switch Account'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
