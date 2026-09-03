'use client'

import React, { useState, useRef } from 'react'
import { 
  User, 
  Phone, 
  Camera, 
  Check, 
  Copy, 
  Edit3, 
  ArrowRight, 
  CreditCard, 
  X, 
  Save, 
  ShieldCheck, 
  Droplet,
  AlertTriangle,
  Upload,
  MapPin,
  Calendar,
  Sparkles,
  HeartPulse,
  BadgeCheck,
  Lock
} from 'lucide-react'
import AbhaCard, { PatientInfo } from '@/components/AbhaCard'
import { LanguageCode, useLanguage } from '@/context/LanguageContext'

interface ProfileSectionProps {
  patient: PatientInfo;
  language?: LanguageCode | string;
  onProceed?: () => void;
  onUpdatePatient?: (updated: PatientInfo) => void;
  onReset?: () => void;
}

export default function ProfileSection({
  patient,
  language = 'en',
  onProceed,
  onUpdatePatient,
  onReset
}: ProfileSectionProps) {
  const { t } = useLanguage()
  const [copiedAbha, setCopiedAbha] = useState(false)
  const [showAbhaCardModal, setShowAbhaCardModal] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  function calculateAgeNumber(dob?: string): number {
    if (!dob) return 19
    try {
      const year = parseInt(dob.split('-')[0], 10)
      if (isNaN(year)) return 19
      const diff = new Date().getFullYear() - year
      return diff > 0 ? diff : 19
    } catch {
      return 19
    }
  }

  // Edit Modal State initialized with current patient values
  const [editForm, setEditForm] = useState({
    full_name: patient.full_name || '',
    age: patient.age || (patient.date_of_birth ? calculateAgeNumber(patient.date_of_birth) : 19),
    gender: patient.gender || 'M',
    blood_group: patient.blood_group || 'B+',
    abha_address: patient.abha_address || 'hasan.m@abdm',
    mobile_number: patient.mobile_number || '+919876543210',
    location: patient.address || [patient.district, patient.state].filter(Boolean).join(', ') || 'Mathurapur, Bareilly',
    allergies: patient.allergies || 'No Known Allergies',
    profile_photo: patient.profile_photo || ''
  })

  // Format age & gender display
  const ageValue = patient.age || (patient.date_of_birth ? calculateAgeNumber(patient.date_of_birth) : 19)
  const ageDisplay = `${ageValue} Yrs`

  const genderDisplay = 
    patient.gender === 'M' || patient.gender === 'Male' ? 'Male' :
    patient.gender === 'F' || patient.gender === 'Female' ? 'Female' : 'Other'

  // Location display
  const locationDisplay = 
    patient.address || 
    [patient.district, patient.state].filter(Boolean).join(', ') || 
    'Mathurapur, Bareilly'

  // Phone masking helper: e.g. "+91 98••• ••210 (Masked)"
  const formatMaskedPhone = (phoneStr?: string): { formatted: string; maskedNote: string } => {
    if (!phoneStr) return { formatted: '+91 98••• ••210', maskedNote: 'Masked' }
    const digits = phoneStr.replace(/\D/g, '')
    const cleanDigits = digits.startsWith('91') && digits.length > 10 ? digits.slice(2) : digits

    if (cleanDigits.length >= 10) {
      const first2 = cleanDigits.slice(0, 2)
      const last3 = cleanDigits.slice(-3)
      return {
        formatted: `+91 ${first2}••• ••${last3}`,
        maskedNote: 'Masked'
      }
    }
    return { formatted: '+91 98••• ••210', maskedNote: 'Masked' }
  }

  const { formatted: maskedPhone, maskedNote } = formatMaskedPhone(patient.mobile_number)

  // Calculate dynamic completion percentage:
  // (Base fields = 85%, adding custom photo completes to 100%)
  const calculateCompletion = (p: PatientInfo): number => {
    let score = 0
    if (p.full_name?.trim()) score += 10
    if (p.age || p.date_of_birth) score += 10
    if (p.gender) score += 10
    if (p.address || p.district || p.state) score += 10
    if (p.mobile_number) score += 10
    if (p.abha_address || p.abha_number) score += 15
    if (p.blood_group) score += 10
    if (p.allergies) score += 10
    if (p.profile_photo) score += 15
    return Math.min(100, Math.max(10, score))
  }

  const completionPercentage = calculateCompletion(patient)

  // Copy ABHA ID
  const handleCopyAbha = () => {
    const textToCopy = patient.abha_address || patient.abha_number || 'hasan.m@abdm'
    navigator.clipboard.writeText(textToCopy)
    setCopiedAbha(true)
    setTimeout(() => setCopiedAbha(false), 2000)
  }

  // Handle Photo Upload
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (uploadEvent) => {
      const base64Data = uploadEvent.target?.result as string
      if (base64Data) {
        const updated: PatientInfo = {
          ...patient,
          profile_photo: base64Data
        }
        if (onUpdatePatient) {
          onUpdatePatient(updated)
        }
        setEditForm(prev => ({ ...prev, profile_photo: base64Data }))
      }
    }
    reader.readAsDataURL(file)
  }

  // Save changes from Edit Modal
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault()
    const updated: PatientInfo = {
      ...patient,
      full_name: editForm.full_name,
      age: Number(editForm.age),
      gender: editForm.gender,
      blood_group: editForm.blood_group,
      abha_address: editForm.abha_address,
      mobile_number: editForm.mobile_number,
      address: editForm.location,
      allergies: editForm.allergies,
      profile_photo: editForm.profile_photo || patient.profile_photo
    }

    if (onUpdatePatient) {
      onUpdatePatient(updated)
    }
    setIsEditing(false)
  }

  // Generate initials for avatar fallback
  const getInitials = (name?: string): string => {
    if (!name) return 'HM'
    const parts = name.trim().split(/\s+/)
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase()
    }
    return name.slice(0, 2).toUpperCase()
  }

  return (
    <div className="w-full flex flex-col items-center">
      {/* Hidden file input for photo upload */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handlePhotoUpload} 
        accept="image/*" 
        className="hidden" 
      />

      {/* ========================================================================= */}
      {/* POLISHED CLINICAL PROFILE CARD                                            */}
      {/* ========================================================================= */}
      <div className="w-full max-w-xl bg-slate-900 text-white rounded-2xl sm:rounded-3xl border border-slate-800 shadow-xl sm:shadow-2xl overflow-hidden transition-all">
        
        {/* ===================================================================== */}
        {/* SECTION 1: DEMOGRAPHICS HEADER & PROFILE COMPLETION                  */}
        {/* ===================================================================== */}
        <div className="p-4 sm:p-7 border-b border-slate-800/80 bg-gradient-to-b from-slate-850 to-slate-900">
          <div className="flex items-start gap-3 sm:gap-5">
            
            {/* 1. Profile Photo / Avatar with Interactive Upload Trigger */}
            <div className="relative group shrink-0">
              <div 
                onClick={() => fileInputRef.current?.click()}
                title="Click to Upload / Change Profile Photo"
                className="w-20 h-20 sm:w-28 sm:h-28 rounded-xl sm:rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-sky-500 p-1 shadow-lg shadow-blue-900/30 cursor-pointer overflow-hidden transition-all hover:scale-105 active:scale-95 ring-2 sm:ring-4 ring-slate-800"
              >
                <div className="w-full h-full rounded-lg sm:rounded-xl bg-slate-900 flex items-center justify-center overflow-hidden relative">
                  {patient.profile_photo ? (
                    <img 
                      src={patient.profile_photo} 
                      alt={patient.full_name} 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center">
                      <span className="text-xl sm:text-3xl font-black tracking-wider text-white">
                        {getInitials(patient.full_name)}
                      </span>
                    </div>
                  )}

                  {/* Hover Overlay */}
                  <div className="absolute inset-0 bg-slate-950/70 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white transition-opacity rounded-lg sm:rounded-xl">
                    <Upload className="w-5 h-5 sm:w-6 sm:h-6 text-sky-400 mb-0.5 sm:mb-1" />
                    <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-sky-300">
                      Upload
                    </span>
                  </div>
                </div>
              </div>

              {/* Floating Camera Badge Button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute -bottom-1 -right-1 p-1.5 sm:p-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg sm:rounded-xl shadow-md border-2 border-slate-900 active:scale-90 transition-all"
                title="Change Photo"
              >
                <Camera className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              </button>
            </div>

            {/* Right: Demographics Details */}
            <div className="flex-1 min-w-0 space-y-1.5 sm:space-y-2">
              <div>
                {/* 2. Full Name */}
                <h2 className="text-xl sm:text-3xl font-black text-white tracking-tight leading-tight truncate">
                  {patient.full_name || 'Hasan Mujtaba'}
                </h2>

                {/* 3 & 4. Age • Gender */}
                <div className="flex items-center gap-1.5 sm:gap-2 mt-1 text-slate-300 font-bold text-xs sm:text-base flex-wrap">
                  <span className="bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-700/60 text-slate-200">
                    {ageDisplay}
                  </span>
                  <span className="text-slate-500 font-bold">•</span>
                  <span className="bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-700/60 text-slate-200">
                    {genderDisplay}
                  </span>
                </div>
              </div>

              {/* 8. Location */}
              <div className="flex items-center gap-1.5 text-slate-400 text-xs sm:text-sm font-medium truncate pt-0.5">
                <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-400 shrink-0" />
                <span className="truncate">{locationDisplay}</span>
              </div>
            </div>
          </div>

            {/* Dynamic Profile Completion Widget */}
            <div className="mt-5 p-4 rounded-2xl bg-slate-850 border border-slate-800/90 space-y-2">
              <div className="flex items-center justify-between text-xs sm:text-sm font-bold">
                <span className="text-slate-300 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <span>Profile Completion</span>
                </span>
                <span className="text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20 font-black">
                  {completionPercentage}%
                </span>
              </div>

              {/* Sleek Gradient Animated Progress Bar */}
              <div className="w-full bg-slate-950 rounded-full h-3 p-0.5 border border-slate-800 overflow-hidden shadow-inner">
                <div 
                  className="bg-gradient-to-r from-emerald-500 via-teal-400 to-sky-400 h-full rounded-full transition-all duration-700 ease-out shadow-sm shadow-emerald-500/30"
                  style={{ width: `${completionPercentage}%` }}
                ></div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5">
                <span>
                  {completionPercentage === 100 
                    ? '🎉 Profile 100% complete with photo' 
                    : 'Add a profile photo to reach 100%'}
                </span>
                <button 
                  type="button" 
                  onClick={() => setIsEditing(true)}
                  className="text-sky-400 hover:text-sky-300 font-bold underline"
                >
                  Edit details
                </button>
              </div>
            </div>
        </div>

        {/* ===================================================================== */}
        {/* SECTION 2: CONTACT & IDENTITY                                        */}
        {/* ===================================================================== */}
        <div className="p-4 sm:p-7 border-b border-slate-800/80 space-y-3 sm:space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black tracking-widest text-slate-400 uppercase flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-400" />
              <span>CONTACT & IDENTITY</span>
            </h3>
            <span className="text-[10px] sm:text-[11px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
              <BadgeCheck className="w-3.5 h-3.5" />
              <span>ABDM Verified</span>
            </span>
          </div>

          <div className="space-y-2.5 sm:space-y-3">
            {/* 7. Phone Number */}
            <div className="p-3 sm:p-3.5 rounded-xl sm:rounded-2xl bg-slate-850 border border-slate-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                  <Phone className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                    Phone Number
                  </span>
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <span className="text-xs sm:text-base font-black text-slate-100 tracking-wide font-mono">
                      {maskedPhone}
                    </span>
                    <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 bg-slate-800 px-1.5 sm:px-2 py-0.5 rounded-md border border-slate-700/60">
                      ({maskedNote})
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 text-slate-400 text-xs font-semibold shrink-0">
                <Lock className="w-3.5 h-3.5 text-slate-500" />
                <span className="hidden sm:inline">Protected</span>
              </div>
            </div>

            {/* 6. ABHA ID */}
            <div className="p-3 sm:p-3.5 rounded-xl sm:rounded-2xl bg-slate-850 border border-slate-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                  <CreditCard className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                    ABHA ID / Ayushman Address
                  </span>
                  <span className="text-xs sm:text-base font-black text-emerald-400 tracking-wide font-mono truncate block">
                    {patient.abha_address || 'hasan.m@abdm'}
                  </span>
                </div>
              </div>

              {/* Copy ABHA Button */}
              <button
                type="button"
                onClick={handleCopyAbha}
                title="Copy ABHA ID"
                className="px-2.5 sm:px-3 py-1 sm:py-1.5 hover:bg-slate-800 bg-slate-800/80 rounded-xl text-slate-300 hover:text-white transition-colors text-xs font-bold flex items-center gap-1.5 shrink-0 border border-slate-700 active:scale-95 shadow-sm"
              >
                {copiedAbha ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* ===================================================================== */}
        {/* SECTION 3: CLINICAL SAFETY FLAGS                                     */}
        {/* ===================================================================== */}
        <div className="p-4 sm:p-7 space-y-3 sm:space-y-4 bg-slate-950/50">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black tracking-widest text-slate-400 uppercase flex items-center gap-2">
              <HeartPulse className="w-4 h-4 text-rose-500" />
              <span>CLINICAL SAFETY FLAGS</span>
            </h3>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Triage Priority
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3.5">
            {/* 5. Blood Group */}
            <div className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-rose-950/25 border border-rose-500/30 flex items-center justify-between gap-3 shadow-inner">
              <div className="flex items-center gap-2.5 sm:gap-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center shrink-0">
                  <Droplet className="w-4 h-4 sm:w-5 sm:h-5 text-rose-400 fill-rose-400/20" />
                </div>
                <div>
                  <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-rose-300/80 block">
                    Blood Group
                  </span>
                  <span className="text-xs text-slate-400 font-medium">
                    Verified Type
                  </span>
                </div>
              </div>

              <div className="px-3 sm:px-3.5 py-1 sm:py-1.5 rounded-xl bg-rose-600 text-white font-black text-sm sm:text-lg shadow-lg shadow-rose-900/40 font-mono tracking-wider border border-rose-400/30">
                {patient.blood_group || 'B+'}
              </div>
            </div>

            {/* 9. Allergies */}
            <div className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-amber-950/20 border border-amber-500/30 flex items-center justify-between gap-3 shadow-inner">
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-amber-300/80 block">
                    Allergies
                  </span>
                  <span className="text-xs font-bold text-amber-200 truncate block">
                    {patient.allergies || 'No Known Allergies'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ACTION CONTROLS & UTILITIES                                               */}
      {/* ========================================================================= */}
      <div className="w-full max-w-xl mt-4 sm:mt-5 space-y-2.5 sm:space-y-3">
        {/* Primary Action Button: Proceed to Consultation */}
        {onProceed && (
          <button
            type="button"
            onClick={onProceed}
            className="w-full h-12 sm:h-14 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-black text-base sm:text-lg rounded-xl sm:rounded-2xl flex items-center justify-center gap-2 sm:gap-3 shadow-xl shadow-emerald-900/30 transition-all border border-emerald-500/50"
          >
            <span>
              {language === 'hi' ? 'चिकित्सा परामर्श शुरू करें' : 'Proceed to Medical Consultation'}
            </span>
            <ArrowRight className="w-5 h-5" />
          </button>
        )}

        {/* Secondary Action Toolbar */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          {/* Edit Profile */}
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="py-2.5 sm:py-3 px-2 sm:px-3 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold text-slate-800 flex items-center justify-center gap-1.5 sm:gap-2 transition-all shadow-sm active:scale-95"
          >
            <Edit3 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600" />
            <span>{language === 'hi' ? 'संपादित करें' : 'Edit Profile'}</span>
          </button>

          {/* Toggle Official ABDM Card View */}
          <button
            type="button"
            onClick={() => setShowAbhaCardModal(prev => !prev)}
            className="py-2.5 sm:py-3 px-2 sm:px-3 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold text-slate-800 flex items-center justify-center gap-1.5 sm:gap-2 transition-all shadow-sm active:scale-95"
          >
            <CreditCard className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600" />
            <span>{showAbhaCardModal ? (language === 'hi' ? 'कार्ड बंद करें' : 'Hide Card') : (language === 'hi' ? 'एबीएचए कार्ड' : 'ABHA Card')}</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* EXPANDABLE OFFICIAL ABDM HEALTH CARD VIEW                                 */}
      {/* ========================================================================= */}
      {showAbhaCardModal && (
        <div className="w-full max-w-xl mt-4 sm:mt-6 p-3.5 sm:p-5 bg-white rounded-2xl sm:rounded-3xl border-2 border-slate-200 shadow-xl space-y-3 sm:space-y-4 animate-fadeIn">
          <div className="flex items-center justify-between pb-2.5 sm:pb-3 border-b border-slate-100">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600" />
              <h4 className="text-sm sm:text-base font-black text-slate-900">
                {language === 'hi' ? 'आधिकारिक एबीएचए स्वास्थ्य कार्ड' : 'Official ABDM Health Card'}
              </h4>
            </div>
            <button
              type="button"
              onClick={() => setShowAbhaCardModal(false)}
              className="p-1 sm:p-1.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-700 transition-colors"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>

          <AbhaCard 
            patient={patient}
            language={language}
            compact={false}
          />
        </div>
      )}

      {/* ========================================================================= */}
      {/* EDIT PROFILE MODAL                                                        */}
      {/* ========================================================================= */}
      {isEditing && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl sm:rounded-3xl max-w-md w-full p-4 sm:p-7 shadow-2xl border border-slate-200 space-y-3 sm:space-y-4 my-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 sm:pb-3">
              <h3 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                <Edit3 className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                <span>{language === 'hi' ? 'प्रोफ़ाइल विवरण संपादित करें' : 'Edit Profile Details'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 text-slate-800">
              {/* Full Name */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={editForm.full_name}
                  onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                  className="w-full p-3 text-sm font-semibold border-2 border-slate-200 rounded-xl focus:border-blue-600 focus:outline-none"
                />
              </div>

              {/* Age & Gender */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Age (Years)</label>
                  <input
                    type="number"
                    min={1}
                    max={120}
                    required
                    value={editForm.age}
                    onChange={(e) => setEditForm({ ...editForm, age: Number(e.target.value) })}
                    className="w-full p-3 text-sm font-semibold border-2 border-slate-200 rounded-xl focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Gender</label>
                  <select
                    value={editForm.gender}
                    onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}
                    className="w-full p-3 text-sm font-semibold border-2 border-slate-200 rounded-xl focus:border-blue-600 focus:outline-none"
                  >
                    <option value="M">Male (M)</option>
                    <option value="F">Female (F)</option>
                    <option value="O">Other (O)</option>
                  </select>
                </div>
              </div>

              {/* Blood Group */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1 flex items-center gap-1">
                  <Droplet className="w-3.5 h-3.5 text-rose-600" />
                  <span>Blood Group</span>
                </label>
                <select
                  value={editForm.blood_group}
                  onChange={(e) => setEditForm({ ...editForm, blood_group: e.target.value })}
                  className="w-full p-3 text-sm font-semibold border-2 border-slate-200 rounded-xl focus:border-blue-600 focus:outline-none font-mono font-bold text-rose-700"
                >
                  <option value="B+">B+ (Positive)</option>
                  <option value="B-">B- (Negative)</option>
                  <option value="O+">O+ (Positive)</option>
                  <option value="O-">O- (Negative)</option>
                  <option value="A+">A+ (Positive)</option>
                  <option value="A-">A- (Negative)</option>
                  <option value="AB+">AB+ (Positive)</option>
                  <option value="AB-">AB- (Negative)</option>
                </select>
              </div>

              {/* Location */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Location / Address</label>
                <input
                  type="text"
                  value={editForm.location}
                  onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                  placeholder="e.g. Mathurapur, Bareilly"
                  className="w-full p-3 text-sm font-semibold border-2 border-slate-200 rounded-xl focus:border-blue-600 focus:outline-none"
                />
              </div>

              {/* Allergies */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                  <span>Clinical Allergies</span>
                </label>
                <input
                  type="text"
                  value={editForm.allergies}
                  onChange={(e) => setEditForm({ ...editForm, allergies: e.target.value })}
                  placeholder="e.g. No Known Allergies or Penicillin, Dust"
                  className="w-full p-3 text-sm font-semibold border-2 border-slate-200 rounded-xl focus:border-blue-600 focus:outline-none"
                />
              </div>

              {/* Photo Upload Trigger */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-3 px-4 bg-slate-100 hover:bg-slate-200 rounded-2xl text-xs font-bold text-slate-700 flex items-center justify-center gap-2 transition-colors border border-slate-200"
                >
                  <Camera className="w-4 h-4 text-slate-600" />
                  <span>{patient.profile_photo ? 'Replace Profile Photo' : 'Upload Profile Photo'}</span>
                </button>
              </div>

              {/* Submit / Cancel Buttons */}
              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 rounded-2xl text-xs font-bold text-slate-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-black shadow-md transition-colors flex items-center justify-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
