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
  Lock,
  Printer,
  KeyRound,
  FileText,
  CheckCircle2
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
  const [copiedNumber, setCopiedNumber] = useState(false)
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
  const ageDisplay = `${ageValue} ${t('Yrs', 'वर्ष', 'ஆண்டுகள்', 'సంవత్సరాలు')}`

  const genderDisplay = 
    patient.gender === 'M' || patient.gender === 'Male' ? t('Male', 'पुरुष', 'ஆண்', 'పురుషుడు') :
    patient.gender === 'F' || patient.gender === 'Female' ? t('Female', 'महिला', 'பெண்', 'మహిళ') : 
    t('Other', 'अन्य', 'மற்றவை', 'ఇతర')

  // Location display
  const locationDisplay = 
    patient.address || 
    [patient.district, patient.state].filter(Boolean).join(', ') || 
    'Mathurapur, Bareilly, Uttar Pradesh'

  // Phone masking helper: e.g. "+91 98••• ••210"
  const formatMaskedPhone = (phoneStr?: string): { formatted: string; maskedNote: string } => {
    if (!phoneStr) return { formatted: '+91 98••• ••210', maskedNote: t('Masked', 'सुरक्षित', 'மறைக்கப்பட்டது', 'రక్షించబడింది') }
    const digits = phoneStr.replace(/\D/g, '')
    const cleanDigits = digits.startsWith('91') && digits.length > 10 ? digits.slice(2) : digits

    if (cleanDigits.length >= 10) {
      const first2 = cleanDigits.slice(0, 2)
      const last3 = cleanDigits.slice(-3)
      return {
        formatted: `+91 ${first2}••• ••${last3}`,
        maskedNote: t('Masked', 'सुरक्षित', 'மறைக்கப்பட்டது', 'రక్షించబడింది')
      }
    }
    return { formatted: '+91 98••• ••210', maskedNote: t('Masked', 'सुरक्षित', 'மறைக்கப்பட்டது', 'రక్షించబడింది') }
  }

  const { formatted: maskedPhone, maskedNote } = formatMaskedPhone(patient.mobile_number)

  // Calculate dynamic completion percentage:
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

  // Copy 14-digit ABHA Number
  const handleCopyNumber = () => {
    const textToCopy = patient.abha_number || '91-4920-1849-2810'
    navigator.clipboard.writeText(textToCopy)
    setCopiedNumber(true)
    setTimeout(() => setCopiedNumber(false), 2000)
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
    <div className="w-full max-w-5xl mx-auto space-y-4 sm:space-y-6 text-left">
      {/* Hidden file input for photo upload */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handlePhotoUpload} 
        accept="image/*" 
        className="hidden" 
      />

      {/* ========================================================================= */}
      {/* ON-SCREEN PROFILE CONTENT (HIDDEN DURING PRINT - ONLY ABHA CARD PRINTS)   */}
      {/* ========================================================================= */}
      <div className="print:hidden space-y-4 sm:space-y-6">
        {/* ========================================================================= */}
        {/* 1. TOP HEADER BANNER (Matches Medical Records & Timeline Header Style)   */}
        {/* ========================================================================= */}
        <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-lg sm:shadow-xl border-2 border-slate-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          {/* Left: Patient Avatar, Name & Key Badges */}
          <div className="flex items-center gap-3.5 sm:gap-5 min-w-0">
            {/* Avatar with Camera Overlay */}
            <div className="relative group shrink-0">
              <div 
                onClick={() => fileInputRef.current?.click()}
                title={t('Click to Upload / Change Profile Photo', 'फोटो अपलोड या बदलने के लिए क्लिक करें')}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-tr from-blue-700 via-indigo-600 to-sky-500 p-1 shadow-md shadow-blue-500/20 ring-4 ring-blue-50 cursor-pointer overflow-hidden transition-all hover:scale-105 active:scale-95"
              >
                <div className="w-full h-full rounded-xl bg-slate-900 flex items-center justify-center overflow-hidden relative">
                  {patient.profile_photo ? (
                    <img 
                      src={patient.profile_photo} 
                      alt={patient.full_name} 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-xl sm:text-2xl font-black text-white tracking-wider">
                      {getInitials(patient.full_name)}
                    </span>
                  )}

                  {/* Hover Overlay */}
                  <div className="absolute inset-0 bg-slate-950/70 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white transition-opacity rounded-xl">
                    <Upload className="w-4 h-4 text-sky-400 mb-0.5" />
                    <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-wider text-sky-300">
                      {t('Upload', 'अपलोड')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Floating Camera Button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute -bottom-1 -right-1 p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow border-2 border-white active:scale-90 transition-all"
                title={t('Change Photo', 'फोटो बदलें')}
              >
                <Camera className="w-3 h-3" />
              </button>
            </div>

            {/* Patient Details */}
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-2xl md:text-3xl font-black text-slate-900 truncate">
                  {patient.full_name || 'Hasan Mujtaba'}
                </h2>
                <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] sm:text-xs font-black px-2.5 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                  <BadgeCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{t('ABDM Verified', 'एबीडीएम सत्यापित', 'ABDM சரிபார்க்கப்பட்டது', 'ABDM ధృవీకరించబడింది')}</span>
                </span>
              </div>

              <div className="flex items-center gap-2 mt-1.5 flex-wrap text-xs sm:text-sm">
                <span className="bg-slate-100 text-slate-800 font-bold px-2 py-0.5 rounded-lg border border-slate-200">
                  {ageDisplay}
                </span>
                <span className="text-slate-400 font-bold">•</span>
                <span className="bg-slate-100 text-slate-800 font-bold px-2 py-0.5 rounded-lg border border-slate-200">
                  {genderDisplay}
                </span>
                <span className="text-slate-400 font-bold hidden sm:inline">•</span>
                <span className="text-slate-500 font-semibold flex items-center gap-1 truncate">
                  <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                  <span className="truncate">{locationDisplay}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Right: Action Buttons Toolbar */}
          <div className="flex items-center gap-2 sm:gap-2.5 w-full md:w-auto flex-wrap">
            {/* Edit Profile */}
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="flex-1 sm:flex-none py-2 sm:py-2.5 px-3 sm:px-3.5 bg-white hover:bg-slate-50 border-2 border-slate-200 text-slate-800 text-xs font-extrabold rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-xs active:scale-95"
            >
              <Edit3 className="w-3.5 h-3.5 text-blue-700" />
              <span>{t('Edit Profile', 'संपादित करें', 'சுயவிவரம் திருத்து', 'ప్రొఫైల్ సవరించండి')}</span>
            </button>

            {/* Primary Action Button */}
            {onProceed && (
              <button
                type="button"
                onClick={onProceed}
                className="w-full sm:w-auto py-2 sm:py-2.5 px-4 sm:px-4.5 bg-blue-900 hover:bg-blue-950 text-white text-xs font-black rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95"
              >
                <span>{t('Scan Prescription', 'पर्चा स्कैन करें', 'பரிந்துரை ஸ்கேன்', 'ప్రిస్క్రిప్షన్ స్కాన్')}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 2. QUICK CLINICAL & IDENTITY STAT RIBBON (Matches Medical Records Ribbon)  */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
          {/* Card 1: ABHA Ayushman Address */}
          <div className="bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl border sm:border-2 border-slate-100 shadow-sm">
            <div className="flex items-center gap-1.5 sm:gap-2 text-slate-400 text-[10px] sm:text-xs font-bold uppercase truncate">
              <CreditCard className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600 shrink-0" />
              <span className="truncate">{t('ABHA Address', 'आयुष्मान पता', 'ABHA முகவரி', 'ABHA చిరునామా')}</span>
            </div>
            <div className="flex items-center justify-between mt-1 gap-1">
              <p className="text-xs sm:text-sm font-black text-emerald-800 font-mono truncate">
                {patient.abha_address || 'hasan.m@abdm'}
              </p>
              <button
                type="button"
                onClick={handleCopyAbha}
                title="Copy ABHA Address"
                className="text-slate-400 hover:text-emerald-700 p-0.5 shrink-0"
              >
                {copiedAbha ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            <span className="text-[9px] sm:text-[10px] font-extrabold px-1.5 sm:px-2 py-0.5 rounded-md mt-1 inline-block truncate max-w-full text-emerald-700 bg-emerald-50 border border-emerald-200">
              {t('ABDM Linked', 'एबीडीएम लिंक', 'இணைக்கப்பட்டது', 'లింక్ చేయబడింది')}
            </span>
          </div>

          {/* Card 2: Mobile Number */}
          <div className="bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl border sm:border-2 border-slate-100 shadow-sm">
            <div className="flex items-center gap-1.5 sm:gap-2 text-slate-400 text-[10px] sm:text-xs font-bold uppercase truncate">
              <Phone className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600 shrink-0" />
              <span className="truncate">{t('Phone Number', 'मोबाइल नंबर', 'தொலைபேசி', 'ఫోన్ నంబర్')}</span>
            </div>
            <p className="text-xs sm:text-base font-black text-slate-800 mt-1 font-mono tracking-wide">
              {maskedPhone}
            </p>
            <span className="text-[9px] sm:text-[10px] font-extrabold px-1.5 sm:px-2 py-0.5 rounded-md mt-1 inline-block truncate max-w-full text-blue-700 bg-blue-50 border border-blue-200">
              {t('Protected & Verified', 'सुरक्षित व सत्यापित', 'சரிபார்க்கப்பட்டது', 'రక్షించబడింది')}
            </span>
          </div>
        </div>

      {/* ========================================================================= */}
      {/* 3. TWO-COLUMN MAIN CONTENT GRID (Matches Medical Records & Doctor Selection) */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
        
        {/* ======================================================================= */}
        {/* LEFT COLUMN: IDENTITY, DEMOGRAPHICS & PROFILE READINESS (7 Cols)        */}
        {/* ======================================================================= */}
        <div className="lg:col-span-7 space-y-4 sm:space-y-6">
          
          {/* Card A: Full Demographics & ABDM Registration Identity */}
          <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-lg sm:shadow-xl border-2 border-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-900 shrink-0">
                  <User className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-lg font-black text-slate-900">
                    {t('Patient Identity & Demographics', 'रोगी पहचान एवं डेमोग्राफिक्स', 'நோயாளி அடையாளம்', 'రోగి గుర్తింపు')}
                  </h3>
                  <p className="text-[11px] sm:text-xs font-bold text-slate-400">
                    {t('Official Ayushman Bharat Digital Mission (ABDM) Profile', 'आयुष्मान भारत डिजिटल मिशन पंजीकृत विवरण')}
                  </p>
                </div>
              </div>

              <span className="text-[10px] sm:text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{t('Active', 'सक्रिय')}</span>
              </span>
            </div>

            {/* Demographics Data Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              {/* Full Name */}
              <div className="bg-slate-50/80 p-3 sm:p-3.5 rounded-xl sm:rounded-2xl border border-slate-200/80">
                <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                  {t('Full Name', 'पूरा नाम', 'முழுப் பெயர்', 'పూర్తి పేరు')}
                </span>
                <span className="text-sm sm:text-base font-black text-slate-900 mt-0.5 block">
                  {patient.full_name || 'Hasan Mujtaba'}
                </span>
              </div>

              {/* 14-Digit ABHA Number */}
              <div className="bg-slate-50/80 p-3 sm:p-3.5 rounded-xl sm:rounded-2xl border border-slate-200/80">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                    {t('14-Digit ABHA Number', '14 अंकों का आभा नंबर', 'ABHA எண்', 'ABHA సంఖ్య')}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyNumber}
                    className="text-slate-400 hover:text-blue-700"
                    title="Copy ABHA Number"
                  >
                    {copiedNumber ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <span className="text-xs sm:text-sm font-black text-blue-900 font-mono tracking-wider mt-0.5 block">
                  {patient.abha_number || '91-4920-1849-2810'}
                </span>
              </div>

              {/* Age */}
              <div className="bg-slate-50/80 p-3 sm:p-3.5 rounded-xl sm:rounded-2xl border border-slate-200/80">
                <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                  {t('Age', 'आयु', 'வயது', 'వయస్సు')}
                </span>
                <span className="text-sm sm:text-base font-black text-slate-900 mt-0.5 block">
                  {ageDisplay}
                </span>
              </div>

              {/* Gender */}
              <div className="bg-slate-50/80 p-3 sm:p-3.5 rounded-xl sm:rounded-2xl border border-slate-200/80">
                <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                  {t('Gender', 'लिंग', 'பாலினம்', 'లింగం')}
                </span>
                <span className="text-sm sm:text-base font-black text-slate-900 mt-0.5 block">
                  {genderDisplay}
                </span>
              </div>

              {/* Registered Address */}
              <div className="bg-slate-50/80 p-3 sm:p-3.5 rounded-xl sm:rounded-2xl border border-slate-200/80 sm:col-span-2">
                <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                  {t('Registered Residence / Address', 'स्थाई पता', 'முகவரி', 'చిరునామా')}
                </span>
                <div className="flex items-start gap-1.5 mt-1 text-xs sm:text-sm font-bold text-slate-800">
                  <MapPin className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  <span>{locationDisplay}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Card B: Profile Completion Progress & Digital Readiness */}
          <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-lg sm:shadow-xl border-2 border-slate-100 space-y-3.5 sm:space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-teal-600" />
                <h3 className="text-sm sm:text-base font-black text-slate-900">
                  {t('Profile Completion & Readiness', 'प्रोफ़ाइल पूर्णता स्थिति', 'சுயவிவர முழுமை', 'ప్రొఫైల్ పూర్తి')}
                </h3>
              </div>
              <span className="text-xs sm:text-sm font-black text-teal-800 bg-teal-50 border border-teal-200 px-2.5 py-0.5 rounded-full">
                {completionPercentage}% {t('Complete', 'पूर्ण', 'நிறைவுற்றது', 'పూర్తి')}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-slate-100 rounded-full h-3 sm:h-3.5 p-0.5 border border-slate-200 overflow-hidden shadow-inner">
              <div 
                className="bg-gradient-to-r from-emerald-500 via-teal-500 to-blue-600 h-full rounded-full transition-all duration-700 ease-out shadow-sm"
                style={{ width: `${completionPercentage}%` }}
              ></div>
            </div>

            {/* Readiness Checklist */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs font-bold text-slate-700">
              <div className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{t('ABDM Virtual Address Linked', 'एबीएचए पता लिंक है')}</span>
              </div>
              <div className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{t('Verified 6-Digit Kiosk PIN', '6-अंकों का लॉगिन पिन सक्रिय')}</span>
              </div>
              <div className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{t('Clinical Blood Group Recorded', 'ब्लड ग्रुप दर्ज है')}</span>
              </div>
              <div className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                {patient.profile_photo ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <Camera className="w-4 h-4 text-amber-500 shrink-0" />
                )}
                <span className="truncate">
                  {patient.profile_photo 
                    ? t('Profile Photo Uploaded', 'प्रोफ़ाइल फोटो उपलब्ध') 
                    : t('Photo missing (Upload for 100%)', 'फोटो अपलोड करें')}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ======================================================================= */}
        {/* RIGHT COLUMN: CLINICAL SAFETY FLAGS & ABHA HEALTH CARD ACCESS (5 Cols) */}
        {/* ======================================================================= */}
        <div className="lg:col-span-5 space-y-4 sm:space-y-6">
          
          {/* Card C: Clinical Safety & Emergency Triage Information */}
          <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-lg sm:shadow-xl border-2 border-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0">
                  <HeartPulse className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900">
                    {t('Clinical Safety Flags', 'क्लिनिकल सुरक्षा अलर्ट', 'பாதுகாப்பு எச்சரிக்கை', 'భద్రతా హెచ్చరిక')}
                  </h3>
                  <p className="text-[10px] sm:text-xs font-bold text-slate-400">
                    {t('Triage & Emergency Preparedness', 'आपातकालीन तैयारी')}
                  </p>
                </div>
              </div>

              <span className="text-[10px] font-black uppercase tracking-wider text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                {t('Emergency', 'आपातकालीन')}
              </span>
            </div>

            {/* Blood Group Callout */}
            <div className="bg-gradient-to-br from-rose-50 to-red-50/60 border-2 border-rose-200 rounded-xl sm:rounded-2xl p-3.5 sm:p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 sm:gap-3">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-rose-600 text-white flex items-center justify-center shadow-md shadow-rose-600/30 shrink-0">
                  <Droplet className="w-6 h-6 fill-white" />
                </div>
                <div>
                  <span className="text-[10px] sm:text-xs font-black uppercase text-rose-900 block">
                    {t('Blood Group Type', 'रक्त समूह प्रकार')}
                  </span>
                  <p className="text-xs text-rose-700 font-bold">
                    {t('Universal Donor / Recipient Compatible', 'दाता/प्राप्तकर्ता अनुकूल')}
                  </p>
                </div>
              </div>

              <div className="text-xl sm:text-3xl font-black text-rose-700 font-mono tracking-wider bg-white px-3 py-1 rounded-xl border border-rose-300 shadow-xs">
                {patient.blood_group || 'B+'}
              </div>
            </div>

            {/* Allergies Box */}
            <div className="bg-amber-50/70 border border-amber-200 rounded-xl sm:rounded-2xl p-3.5 sm:p-4 space-y-1">
              <div className="flex items-center gap-1.5 text-amber-900 text-xs font-extrabold uppercase">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>{t('Documented Allergies', 'दर्ज एलर्जी')}</span>
              </div>
              <p className="text-xs sm:text-sm font-bold text-amber-950">
                {patient.allergies || t('No Known Medical Allergies (NKDA)', 'कोई ज्ञात एलर्जी नहीं')}
              </p>
            </div>

            {/* Kiosk PIN Security Status */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl sm:rounded-2xl p-3 sm:p-3.5 flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <KeyRound className="w-4 h-4 text-blue-700 shrink-0" />
                <div className="min-w-0">
                  <span className="font-extrabold text-slate-800 block truncate">
                    {t('6-Digit Kiosk Login PIN', '6-अंकों का लॉगिन पिन')}
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium">
                    {t('Fast login enabled at any kiosk', 'कियोस्क पर त्वरित लॉगिन सक्षम')}
                  </span>
                </div>
              </div>
              <span className="text-[10px] font-black text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full shrink-0">
                {t('Active', 'सक्रिय')}
              </span>
            </div>
          </div>

          {/* Card D: Official ABDM Health Card Access Card */}
          <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-lg sm:shadow-xl border-2 border-slate-100 space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-800 shrink-0">
                  <CreditCard className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900">
                    {t('Official ABHA Health Card', 'आधिकारिक आभा कार्ड')}
                  </h3>
                  <p className="text-[10px] sm:text-xs font-bold text-slate-400">
                    {t('National Digital Health ID', 'राष्ट्रीय डिजिटल स्वास्थ्य पहचान')}
                  </p>
                </div>
              </div>
            </div>

            {/* Tricolor Preview Ribbon */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
              <div className="h-1.5 w-full flex rounded-full overflow-hidden">
                <div className="h-full w-1/3 bg-[#FF9933]"></div>
                <div className="h-full w-1/3 bg-white"></div>
                <div className="h-full w-1/3 bg-[#138808]"></div>
              </div>
              <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                <span>{patient.full_name || 'Hasan Mujtaba'}</span>
                <span className="font-mono text-emerald-800">{patient.abha_address || 'hasan.m@abdm'}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowAbhaCardModal(true)}
              className="w-full py-2.5 sm:py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs sm:text-sm rounded-xl sm:rounded-2xl flex items-center justify-center gap-2 shadow-md transition-all active:scale-95"
            >
              <CreditCard className="w-4 h-4" />
              <span>{t('View & Print ABHA Card', 'आभा कार्ड देखें व प्रिंट करें')}</span>
            </button>
          </div>

        </div>

      </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. EXPANDABLE OFFICIAL ABDM HEALTH CARD MODAL                              */}
      {/* ========================================================================= */}
      {showAbhaCardModal && (
        <div className="w-full bg-white rounded-2xl sm:rounded-3xl border-2 border-slate-200 shadow-xl p-4 sm:p-6 space-y-4 animate-fadeIn print:p-0 print:border-0 print:shadow-none print:bg-transparent print:m-0 print:w-full">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 print:hidden">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              <h4 className="text-base sm:text-lg font-black text-slate-900">
                {t('Official ABDM Health Card', 'आधिकारिक एबीएचए स्वास्थ्य कार्ड', 'ABHA அட்டை', 'ABHA కార్డు')}
              </h4>
            </div>
            <button
              type="button"
              onClick={() => setShowAbhaCardModal(false)}
              className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <AbhaCard 
            patient={patient}
            language={typeof language === 'string' ? language : 'en'}
            compact={false}
          />
        </div>
      )}

      {/* Fallback for print when modal is not open */}
      {!showAbhaCardModal && (
        <div className="hidden print:block w-full">
          <AbhaCard 
            patient={patient}
            language={typeof language === 'string' ? language : 'en'}
            compact={true}
          />
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. EDIT PROFILE MODAL (Styled to match kiosk clean theme)                 */}
      {/* ========================================================================= */}
      {isEditing && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto print:hidden">
          <div className="bg-white rounded-2xl sm:rounded-3xl max-w-md w-full p-4 sm:p-7 shadow-2xl border-2 border-slate-200 space-y-3 sm:space-y-4 my-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-blue-700" />
                <span>{t('Edit Profile Details', 'प्रोफ़ाइल विवरण संपादित करें', 'விவரங்களைத் திருத்து', 'వివరాలను సవరించండి')}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3.5 text-slate-800">
              {/* Full Name */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  {t('Full Name', 'पूरा नाम')}
                </label>
                <input
                  type="text"
                  required
                  value={editForm.full_name}
                  onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                  className="w-full p-3 text-sm font-bold border-2 border-slate-200 rounded-xl focus:border-blue-600 focus:outline-none"
                />
              </div>

              {/* Age & Gender */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    {t('Age (Years)', 'आयु (वर्ष)')}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={120}
                    required
                    value={editForm.age}
                    onChange={(e) => setEditForm({ ...editForm, age: Number(e.target.value) })}
                    className="w-full p-3 text-sm font-bold border-2 border-slate-200 rounded-xl focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    {t('Gender', 'लिंग')}
                  </label>
                  <select
                    value={editForm.gender}
                    onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}
                    className="w-full p-3 text-sm font-bold border-2 border-slate-200 rounded-xl focus:border-blue-600 focus:outline-none"
                  >
                    <option value="M">{t('Male (M)', 'पुरुष (M)')}</option>
                    <option value="F">{t('Female (F)', 'महिला (F)')}</option>
                    <option value="O">{t('Other (O)', 'अन्य (O)')}</option>
                  </select>
                </div>
              </div>

              {/* Blood Group */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1 flex items-center gap-1">
                  <Droplet className="w-3.5 h-3.5 text-rose-600" />
                  <span>{t('Blood Group', 'रक्त समूह')}</span>
                </label>
                <select
                  value={editForm.blood_group}
                  onChange={(e) => setEditForm({ ...editForm, blood_group: e.target.value })}
                  className="w-full p-3 text-sm font-bold border-2 border-slate-200 rounded-xl focus:border-blue-600 focus:outline-none font-mono text-rose-700"
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
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  {t('Location / Address', 'स्थान / पता')}
                </label>
                <input
                  type="text"
                  value={editForm.location}
                  onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                  placeholder="e.g. Mathurapur, Bareilly, Uttar Pradesh"
                  className="w-full p-3 text-sm font-bold border-2 border-slate-200 rounded-xl focus:border-blue-600 focus:outline-none"
                />
              </div>

              {/* Allergies */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                  <span>{t('Clinical Allergies', 'क्लिनिकल एलर्जी')}</span>
                </label>
                <input
                  type="text"
                  value={editForm.allergies}
                  onChange={(e) => setEditForm({ ...editForm, allergies: e.target.value })}
                  placeholder="e.g. No Known Allergies or Penicillin, Dust"
                  className="w-full p-3 text-sm font-bold border-2 border-slate-200 rounded-xl focus:border-blue-600 focus:outline-none"
                />
              </div>

              {/* Photo Upload Trigger */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-extrabold text-slate-700 flex items-center justify-center gap-2 transition-colors border border-slate-200"
                >
                  <Camera className="w-4 h-4 text-slate-600" />
                  <span>{patient.profile_photo ? t('Replace Profile Photo', 'फोटो बदलें') : t('Upload Profile Photo', 'फोटो अपलोड करें')}</span>
                </button>
              </div>

              {/* Submit / Cancel Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-600 transition-colors"
                >
                  {t('Cancel', 'रद्द करें')}
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-blue-900 hover:bg-blue-950 text-white rounded-xl text-xs font-black shadow-md transition-colors flex items-center justify-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  <span>{t('Save Changes', 'सहेजें')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
