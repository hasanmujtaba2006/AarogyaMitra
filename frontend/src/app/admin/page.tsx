'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  Users, UserPlus, Stethoscope, AlertTriangle, Clock, 
  Activity, ShieldCheck, LogOut, Edit3, Trash2, CheckCircle2, 
  Search, RefreshCw, X, Eye, EyeOff, Plus, ChevronRight,
  Building2, KeyRound, Phone, Sparkles
} from 'lucide-react'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { extractErrorMessage } from '@/lib/errorUtils'

interface DoctorItem {
  id: string;
  full_name: string;
  username: string;
  password?: string;
  profile_photo?: string;
  qualifications: string;
  specialization: string;
  department: string;
  room_number: string;
  fee: string;
  consultation_time: string;
  status: 'Consulting' | 'On Break' | 'Emergency Duty';
  experience?: string;
  post?: string;
  waiting_count: number;
  called_count: number;
  attended_count: number;
  total_queue: number;
}

interface AdminStats {
  active_doctors: number;
  total_doctors: number;
  active_patients: number;
  waiting_patients: number;
  emergency_patients: number;
}

export default function AdminDashboardPage() {
  const router = useRouter()
  const [adminUser, setAdminUser] = useState<any>(null)
  const [stats, setStats] = useState<AdminStats>({
    active_doctors: 0,
    total_doctors: 0,
    active_patients: 0,
    waiting_patients: 0,
    emergency_patients: 0
  })
  const [doctors, setDoctors] = useState<DoctorItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('all')

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false)
  const [addStep, setAddStep] = useState<1 | 2>(1) // Step 1: Profile Info, Step 2: Credentials
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [selectedDoctor, setSelectedDoctor] = useState<DoctorItem | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  // Feedback notifications
  const [actionSuccess, setActionSuccess] = useState('')
  const [actionError, setActionError] = useState('')

  // Add Doctor Form state
  const [newDoc, setNewDoc] = useState({
    full_name: '',
    profile_photo: '👨‍⚕️',
    qualifications: '',
    specialization: '',
    department: 'General Medicine',
    room_number: '',
    fee: '₹0 (Free Govt Kiosk Service)',
    consultation_time: '09:00 AM - 02:00 PM',
    experience: '10 Years',
    post: 'Senior Consultant',
    username: '',
    password: ''
  })

  // Edit Doctor Form state
  const [editDoc, setEditDoc] = useState<Partial<DoctorItem>>({})

  // Authentication check
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const authStr = localStorage.getItem('aarogya_admin_auth')
      if (!authStr) {
        router.push('/admin/login')
        return
      }
      try {
        const parsed = JSON.parse(authStr)
        setAdminUser(parsed.user)
      } catch (e) {
        router.push('/admin/login')
      }
    }
  }, [router])

  const fetchDashboardData = async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    setActionError('')

    try {
      // 1. Fetch KPI stats
      const statsRes = await fetch('/api/opd/admin/stats')
      if (statsRes.ok) {
        const statsData = await statsRes.json()
        setStats(statsData)
      }

      // 2. Fetch doctors list
      const docsRes = await fetch('/api/opd/doctors')
      if (docsRes.ok) {
        const docsData = await docsRes.json()
        setDoctors(docsData.doctors || [])
      }
    } catch (err: any) {
      setActionError('Failed to synchronize admin metrics with server.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchDashboardData()
    const timer = setInterval(() => fetchDashboardData(true), 12000)
    return () => clearInterval(timer)
  }, [])

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('aarogya_admin_auth')
    }
    router.push('/admin/login')
  }

  // Handle Add Doctor Step 1 to Step 2
  const handleProceedToCredentials = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newDoc.full_name || !newDoc.qualifications || !newDoc.specialization || !newDoc.room_number) {
      setActionError('Please fill all required profile fields.')
      return
    }

    // Auto-suggest username if empty
    if (!newDoc.username) {
      const cleanName = newDoc.full_name.toLowerCase().replace('dr.', '').trim().split(' ')[0] || 'doctor'
      setNewDoc(prev => ({
        ...prev,
        username: `dr.${cleanName}${prev.room_number ? `@opd${prev.room_number}` : ''}`,
        password: 'Doctor@123'
      }))
    }
    setActionError('')
    setAddStep(2)
  }

  // Handle Save New Doctor
  const handleCreateDoctor = async (e: React.FormEvent) => {
    e.preventDefault()
    setActionError('')
    setActionSuccess('')

    if (!newDoc.username || !newDoc.password) {
      setActionError('Please provide both Username and Password for the doctor.')
      return
    }

    try {
      const res = await fetch('/api/opd/doctors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newDoc)
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(extractErrorMessage(data, 'Failed to create doctor profile'))
      }

      setActionSuccess(`Doctor profile for ${newDoc.full_name} created successfully!`)
      setShowAddModal(false)
      setAddStep(1)
      setNewDoc({
        full_name: '',
        profile_photo: '👨‍⚕️',
        qualifications: '',
        specialization: '',
        department: 'General Medicine',
        room_number: '',
        fee: '₹0 (Free Govt Kiosk Service)',
        consultation_time: '09:00 AM - 02:00 PM',
        experience: '10 Years',
        post: 'Senior Consultant',
        username: '',
        password: ''
      })
      fetchDashboardData(true)
    } catch (err: any) {
      setActionError(extractErrorMessage(err, 'Error adding doctor profile. Please verify input fields.'))
    }
  }

  // Handle Open Edit Modal
  const handleOpenEdit = (doc: DoctorItem) => {
    setSelectedDoctor(doc)
    setEditDoc({ ...doc })
    setShowEditModal(true)
    setActionError('')
    setActionSuccess('')
  }

  // Handle Save Edited Doctor
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedDoctor) return
    setActionError('')

    try {
      const res = await fetch(`/api/opd/doctors/${selectedDoctor.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editDoc)
      })

      const data = await res.json()
      if (!res.ok) throw new Error(extractErrorMessage(data, 'Failed to update doctor profile'))

      setActionSuccess(`Updated doctor profile for ${editDoc.full_name || selectedDoctor.full_name}!`)
      setShowEditModal(false)
      fetchDashboardData(true)
    } catch (err: any) {
      setActionError(extractErrorMessage(err, 'Error updating doctor profile. Please check details.'))
    }
  }

  // Handle Open Delete Modal
  const handleOpenDelete = (doc: DoctorItem) => {
    setSelectedDoctor(doc)
    setShowDeleteModal(true)
  }

  // Handle Confirm Delete Doctor
  const handleConfirmDelete = async () => {
    if (!selectedDoctor) return
    try {
      const res = await fetch(`/api/opd/doctors/${selectedDoctor.id}`, {
        method: 'DELETE'
      })
      if (!res.ok) throw new Error('Failed to delete doctor profile')

      setActionSuccess(`Doctor ${selectedDoctor.full_name} has been removed from OPD roster.`)
      setShowDeleteModal(false)
      setSelectedDoctor(null)
      fetchDashboardData(true)
    } catch (err: any) {
      setActionError(extractErrorMessage(err, 'Error removing doctor. Please try again.'))
    }
  }

  // Filtered Doctors list
  const filteredDoctors = doctors.filter(doc => {
    const q = searchQuery.toLowerCase()
    const matchesQuery = 
      doc.full_name.toLowerCase().includes(q) ||
      doc.specialization.toLowerCase().includes(q) ||
      doc.department.toLowerCase().includes(q) ||
      doc.room_number.toLowerCase().includes(q) ||
      doc.username.toLowerCase().includes(q)

    const matchesDept = departmentFilter === 'all' || doc.department.toLowerCase() === departmentFilter.toLowerCase()
    return matchesQuery && matchesDept
  })

  // Unique departments for filter
  const departments = Array.from(new Set(doctors.map(d => d.department))).filter(Boolean)

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between font-sans">
      <Header />

      <main className="container mx-auto px-4 py-6 sm:py-8 flex-1 max-w-7xl">
        
        {/* Top Header Banner */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-sm mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-indigo-900 text-white rounded-2xl shadow-md">
              <ShieldCheck className="w-7 h-7 text-indigo-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  Hospital Admin OPD Control Center
                </h1>
                <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 text-[10px] font-extrabold uppercase rounded-md tracking-wider">
                  Super Admin
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Logged in as: <strong className="text-slate-800 font-bold">{adminUser?.full_name || 'Lokesh Patel'}</strong> ({adminUser?.email || 'lokeshpatel@aarogyamitra'})
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-start sm:justify-end">
            <button
              onClick={() => fetchDashboardData(true)}
              disabled={refreshing}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5 transition"
              title="Refresh Data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              onClick={() => {
                setAddStep(1)
                setShowAddModal(true)
              }}
              className="px-3.5 sm:px-4 py-2 bg-indigo-900 hover:bg-indigo-800 text-white text-xs sm:text-sm font-bold rounded-xl shadow flex items-center gap-1.5 transition"
            >
              <UserPlus className="w-4 h-4" />
              <span>+ Add New Doctor</span>
            </button>
            <button
              onClick={handleLogout}
              className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-xl flex items-center gap-1.5 transition"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>
          </div>
        </div>

        {/* Global Notifications */}
        {actionSuccess && (
          <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs sm:text-sm text-emerald-800 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2 font-medium">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{actionSuccess}</span>
            </div>
            <button onClick={() => setActionSuccess('')} className="text-emerald-700 hover:text-emerald-900">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {actionError && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs sm:text-sm text-rose-800 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2 font-medium">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
              <span>{actionError}</span>
            </div>
            <button onClick={() => setActionError('')} className="text-rose-700 hover:text-rose-900">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Real-time KPI Stats Grid (Requirement 5) */}
        <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5 mb-6 sm:mb-8">
          
          {/* Active Doctors */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Active Doctors
              </span>
              <div className="p-2 bg-blue-50 text-blue-700 rounded-xl">
                <Stethoscope className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-slate-900">
                {stats.active_doctors}
              </span>
              <span className="text-xs text-slate-500 font-medium">
                / {stats.total_doctors} Registered
              </span>
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-emerald-700 font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Available for Consultations</span>
            </div>
          </div>

          {/* Active Patients */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Active Patients Today
              </span>
              <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl">
                <Users className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-slate-900">
                {stats.active_patients}
              </span>
              <span className="text-xs text-slate-500 font-medium">Kiosk Intakes</span>
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-500 font-semibold">
              <Clock className="w-3 h-3 text-slate-400" />
              <span>Today's Total OPD Footfall</span>
            </div>
          </div>

          {/* Waiting in Queue */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Patients in Queue
              </span>
              <div className="p-2 bg-amber-50 text-amber-700 rounded-xl">
                <Clock className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-amber-700">
                {stats.waiting_patients}
              </span>
              <span className="text-xs text-slate-500 font-medium">Waiting</span>
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-amber-800 font-semibold">
              <span>Avg Wait: ~{Math.max(5, stats.waiting_patients * 7)} mins</span>
            </div>
          </div>

          {/* Emergency Patients */}
          <div className="bg-white border border-red-200 rounded-2xl p-4 sm:p-5 shadow-sm relative overflow-hidden bg-gradient-to-br from-white to-red-50/40">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-red-700">
                Emergency Patients
              </span>
              <div className="p-2 bg-red-100 text-red-700 rounded-xl animate-pulse">
                <AlertTriangle className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-red-600">
                {stats.emergency_patients}
              </span>
              <span className="text-xs text-red-600 font-semibold">Red Triage Alerts</span>
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-red-700 font-bold">
              <span>🚨 Immediate Clinical Priority</span>
            </div>
          </div>

        </div>

        {/* Doctor Management Section Header & Filters */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-sm mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
            <div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                <Stethoscope className="w-5 h-5 text-indigo-900" />
                <span>Doctor OPD Directory & Digital Credentials</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Add new doctors, assign login credentials, manage cabin numbers, consultation timings and availability.
              </p>
            </div>
            <button
              onClick={() => {
                setAddStep(1)
                setShowAddModal(true)
              }}
              className="px-3.5 py-2 bg-indigo-900 hover:bg-indigo-800 text-white text-xs font-bold rounded-xl shadow flex items-center gap-1.5 self-start sm:self-auto transition"
            >
              <UserPlus className="w-4 h-4" />
              <span>Register Doctor Profile</span>
            </button>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by doctor name, specialization, cabin room, or username..."
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white transition"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-600 transition w-full sm:w-auto"
              >
                <option value="all">All Departments</option>
                {departments.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Doctor Profiles List (Cards / Table) */}
        {loading ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
            <div className="w-8 h-8 border-4 border-indigo-900/20 border-t-indigo-900 rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-sm font-bold text-slate-600">Loading Doctor Roster...</p>
          </div>
        ) : filteredDoctors.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
            <Stethoscope className="w-10 h-10 text-slate-400 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800">No Doctors Found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {searchQuery ? 'No doctor profiles matched your search term.' : 'Click "Add New Doctor" above to register your first doctor in the OPD system.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {filteredDoctors.map(doc => {
              const statusColor = 
                doc.status === 'Consulting' 
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-200' 
                  : doc.status === 'On Break'
                  ? 'bg-amber-100 text-amber-800 border-amber-200'
                  : 'bg-rose-100 text-rose-800 border-rose-200'

              return (
                <div 
                  key={doc.id}
                  className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div>
                    {/* Top Doctor Row: Avatar, Name & Status */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-2xl shrink-0 shadow-inner">
                          {doc.profile_photo || '👨‍⚕️'}
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-900 text-base leading-tight">
                            {doc.full_name}
                          </h3>
                          <p className="text-xs font-semibold text-indigo-900 mt-0.5">
                            {doc.qualifications}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {doc.specialization}
                          </p>
                        </div>
                      </div>

                      <span className={`px-2.5 py-1 text-[10px] font-black uppercase rounded-full border shrink-0 ${statusColor}`}>
                        {doc.status}
                      </span>
                    </div>

                    {/* Department & Cabin details */}
                    <div className="grid grid-cols-2 gap-2 my-3 p-2.5 bg-slate-50/80 rounded-xl border border-slate-100 text-xs">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Cabin / OPD Room</span>
                        <span className="font-extrabold text-slate-800 text-sm">Room {doc.room_number}</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Consultation Fee</span>
                        <span className="font-bold text-slate-700">{doc.fee}</span>
                      </div>
                      <div className="col-span-2 pt-1 border-t border-slate-200/60">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Consultation Hours</span>
                        <span className="font-bold text-slate-700 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          {doc.consultation_time}
                        </span>
                      </div>
                    </div>

                    {/* Digital OPD Credentials Box (Requirement 3 & 4) */}
                    <div className="p-2.5 bg-indigo-50/50 border border-indigo-100 rounded-xl text-xs mb-3 space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-extrabold text-indigo-900 uppercase">
                        <span className="flex items-center gap-1">
                          <KeyRound className="w-3 h-3" /> Digital OPD Credentials
                        </span>
                        <span className="text-slate-400">Doctor Login</span>
                      </div>
                      <div className="font-mono text-[11px] text-slate-800 flex items-center justify-between">
                        <span>User: <strong className="font-bold text-indigo-950">{doc.username}</strong></span>
                        <span className="text-slate-400">Pass: {doc.password || '••••••••'}</span>
                      </div>
                    </div>

                    {/* Queue Statistics */}
                    <div className="flex items-center justify-between text-xs py-1.5 px-3 bg-slate-100/70 rounded-xl text-slate-600 mb-4">
                      <span>Waiting in Queue: <strong className="text-slate-900">{doc.waiting_count}</strong></span>
                      <span>Attended Today: <strong className="text-emerald-700">{doc.attended_count}</strong></span>
                    </div>
                  </div>

                  {/* Actions: Edit & Remove */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button
                      onClick={() => handleOpenEdit(doc)}
                      className="flex-1 py-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center justify-center gap-1 transition"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit Doctor</span>
                    </button>
                    <button
                      onClick={() => handleOpenDelete(doc)}
                      className="py-1.5 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-xl flex items-center justify-center gap-1 transition"
                      title="Remove Doctor"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove</span>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

      </main>

      {/* =========================================================
          ADD DOCTOR 2-STEP MODAL (Requirement 3 & 4)
         ========================================================= */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden max-h-[90vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="p-5 bg-indigo-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-black text-lg">
                  {addStep === 1 ? 'Step 1 of 2: Doctor Profile Information' : 'Step 2 of 2: Digital OPD Credentials'}
                </h3>
                <p className="text-xs text-indigo-200 mt-0.5">
                  {addStep === 1 ? 'Fill the doctor\'s medical credentials and OPD room details' : 'Create Username and Password for the doctor to access Digital OPD'}
                </p>
              </div>
              <button 
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-full text-indigo-300 hover:text-white hover:bg-indigo-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1">
              
              {/* STEP 1: Profile Information */}
              {addStep === 1 && (
                <form onSubmit={handleProceedToCredentials} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Doctor Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={newDoc.full_name}
                      onChange={(e) => setNewDoc({ ...newDoc, full_name: e.target.value })}
                      placeholder="e.g. Dr. Rajesh Sharma"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Qualifications *
                      </label>
                      <input
                        type="text"
                        required
                        value={newDoc.qualifications}
                        onChange={(e) => setNewDoc({ ...newDoc, qualifications: e.target.value })}
                        placeholder="e.g. MBBS, MD, DM"
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Experience
                      </label>
                      <input
                        type="text"
                        value={newDoc.experience}
                        onChange={(e) => setNewDoc({ ...newDoc, experience: e.target.value })}
                        placeholder="e.g. 15 Years"
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Specialization *
                      </label>
                      <input
                        type="text"
                        required
                        value={newDoc.specialization}
                        onChange={(e) => setNewDoc({ ...newDoc, specialization: e.target.value })}
                        placeholder="e.g. Gastroenterology & Liver"
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Department *
                      </label>
                      <input
                        type="text"
                        required
                        value={newDoc.department}
                        onChange={(e) => setNewDoc({ ...newDoc, department: e.target.value })}
                        placeholder="e.g. Gastroenterology"
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        OPD Room / Cabin Number *
                      </label>
                      <input
                        type="text"
                        required
                        value={newDoc.room_number}
                        onChange={(e) => setNewDoc({ ...newDoc, room_number: e.target.value })}
                        placeholder="e.g. 104"
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Consultation Fees
                      </label>
                      <input
                        type="text"
                        value={newDoc.fee}
                        onChange={(e) => setNewDoc({ ...newDoc, fee: e.target.value })}
                        placeholder="e.g. ₹0 (Free Govt Kiosk Service)"
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Time (Daily Patient Consultation Hours) *
                    </label>
                    <input
                      type="text"
                      required
                      value={newDoc.consultation_time}
                      onChange={(e) => setNewDoc({ ...newDoc, consultation_time: e.target.value })}
                      placeholder="e.g. 09:00 AM - 02:00 PM"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Profile Avatar / Photo
                    </label>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-1.5 xs:gap-2">
                        {['👨‍⚕️', '👩‍⚕️', '🩺', '👨🏽‍⚕️', '👩🏽‍⚕️'].map(emoji => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => setNewDoc({ ...newDoc, profile_photo: emoji })}
                            className={`w-9 h-9 xs:w-10 xs:h-10 rounded-xl border text-lg xs:text-xl flex items-center justify-center transition ${newDoc.profile_photo === emoji ? 'border-indigo-600 bg-indigo-50 shadow-sm scale-105' : 'border-slate-200 hover:bg-slate-50'}`}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                      <input
                        type="text"
                        value={newDoc.profile_photo}
                        onChange={(e) => setNewDoc({ ...newDoc, profile_photo: e.target.value })}
                        placeholder="Or image URL"
                        className="flex-1 min-w-[140px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                      />
                    </div>
                  </div>

                  <div className="pt-4 flex justify-end gap-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setShowAddModal(false)}
                      className="px-4 py-2.5 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-100"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2.5 bg-indigo-900 hover:bg-indigo-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow"
                    >
                      <span>Next: Create Credentials</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </form>
              )}

              {/* STEP 2: Digital OPD Credentials (Requirement 4) */}
              {addStep === 2 && (
                <form onSubmit={handleCreateDoctor} className="space-y-4">
                  <div className="p-3.5 bg-indigo-50/70 border border-indigo-100 rounded-xl text-xs text-indigo-900">
                    <p className="font-bold flex items-center gap-1.5">
                      <KeyRound className="w-4 h-4 text-indigo-700" />
                      Set Digital OPD Access for {newDoc.full_name}
                    </p>
                    <p className="text-slate-600 mt-0.5">
                      The doctor will use these credentials to log into their OPD Queue and access patient records.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Doctor Login Username *
                    </label>
                    <input
                      type="text"
                      required
                      value={newDoc.username}
                      onChange={(e) => setNewDoc({ ...newDoc, username: e.target.value })}
                      placeholder="e.g. dr.rajesh@opd104"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-600"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
                      Must be unique across the hospital system.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Doctor Password *
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={newDoc.password}
                        onChange={(e) => setNewDoc({ ...newDoc, password: e.target.value })}
                        placeholder="••••••••"
                        className="w-full px-3.5 py-2.5 pr-10 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-600"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="pt-4 flex justify-between gap-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setAddStep(1)}
                      className="px-4 py-2.5 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-100"
                    >
                      ← Back to Profile
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-2.5 bg-indigo-900 hover:bg-indigo-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Complete & Create Doctor</span>
                    </button>
                  </div>
                </form>
              )}

            </div>

          </div>
        </div>
      )}

      {/* =========================================================
          EDIT DOCTOR MODAL (Requirement 6)
         ========================================================= */}
      {showEditModal && selectedDoctor && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-5 bg-indigo-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-black text-lg">Edit Doctor Profile</h3>
                <p className="text-xs text-indigo-200 mt-0.5">Modifying {selectedDoctor.full_name}</p>
              </div>
              <button 
                onClick={() => setShowEditModal(false)}
                className="p-1 rounded-full text-indigo-300 hover:text-white hover:bg-indigo-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-6 overflow-y-auto flex-1 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Full Name</label>
                <input
                  type="text"
                  value={editDoc.full_name || ''}
                  onChange={(e) => setEditDoc({ ...editDoc, full_name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Qualifications</label>
                  <input
                    type="text"
                    value={editDoc.qualifications || ''}
                    onChange={(e) => setEditDoc({ ...editDoc, qualifications: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Room / Cabin</label>
                  <input
                    type="text"
                    value={editDoc.room_number || ''}
                    onChange={(e) => setEditDoc({ ...editDoc, room_number: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Department</label>
                  <input
                    type="text"
                    value={editDoc.department || ''}
                    onChange={(e) => setEditDoc({ ...editDoc, department: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Specialization</label>
                  <input
                    type="text"
                    value={editDoc.specialization || ''}
                    onChange={(e) => setEditDoc({ ...editDoc, specialization: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Consultation Time</label>
                  <input
                    type="text"
                    value={editDoc.consultation_time || ''}
                    onChange={(e) => setEditDoc({ ...editDoc, consultation_time: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Availability Status</label>
                  <select
                    value={editDoc.status || 'Consulting'}
                    onChange={(e) => setEditDoc({ ...editDoc, status: e.target.value as any })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold"
                  >
                    <option value="Consulting">🟢 Consulting</option>
                    <option value="On Break">🟡 On Break</option>
                    <option value="Emergency Duty">🔴 Emergency Duty</option>
                  </select>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                  Credentials Update
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-slate-500 block mb-1">Username</label>
                    <input
                      type="text"
                      value={editDoc.username || ''}
                      onChange={(e) => setEditDoc({ ...editDoc, username: e.target.value })}
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 block mb-1">Password</label>
                    <input
                      type="text"
                      value={editDoc.password || ''}
                      onChange={(e) => setEditDoc({ ...editDoc, password: e.target.value })}
                      placeholder="New password"
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-900 hover:bg-indigo-800 text-white rounded-xl text-xs font-bold shadow"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================
          DELETE DOCTOR CONFIRMATION MODAL (Requirement 6)
         ========================================================= */}
      {showDeleteModal && selectedDoctor && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md p-6 text-center">
            <div className="w-14 h-14 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-black text-slate-900">Remove Doctor Profile?</h3>
            <p className="text-xs text-slate-500 mt-2">
              Are you sure you want to remove <strong className="text-slate-800 font-bold">{selectedDoctor.full_name}</strong> (Room {selectedDoctor.room_number}) from the active OPD roster?
            </p>
            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2.5 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow"
              >
                Yes, Remove Doctor
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  )
}
