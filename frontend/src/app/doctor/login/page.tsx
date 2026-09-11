'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Stethoscope, Lock, User, AlertCircle, CheckCircle2, ArrowRight
} from 'lucide-react'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { extractErrorMessage } from '@/lib/errorUtils'

export default function DoctorLoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      const res = await fetch('/api/opd/doctor/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password: password.trim() })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(extractErrorMessage(data, 'Invalid doctor login credentials'))
      }

      setSuccess(`Welcome, ${data.doctor.full_name}! Launching your OPD Cabin...`)
      if (typeof window !== 'undefined') {
        localStorage.setItem('aarogya_doctor_auth', JSON.stringify({
          token: data.token,
          doctor: data.doctor,
          loginTime: new Date().toISOString()
        }))
      }

      setTimeout(() => {
        router.push('/doctor')
      }, 700)
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Login failed. Please check credentials or contact Admin.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between font-sans">
      <Header />

      <main className="container mx-auto px-3 sm:px-4 py-6 sm:py-12 flex-1 flex items-center justify-center">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 p-4 xs:p-6 sm:p-8">
          
          {/* Top Stethoscope Header */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center p-3.5 bg-[#002F6C] text-white rounded-2xl shadow-md mb-3">
              <Stethoscope className="w-8 h-8 text-blue-200" />
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Doctor OPD Login
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">
              Digital OPD Queue & Patient Consultation Portal
            </p>
          </div>

          {/* Alert Messages */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Doctor Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. dr.rajesh"
                  className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#002F6C] focus:bg-white transition font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#002F6C] focus:bg-white transition font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 bg-[#002F6C] hover:bg-blue-900 text-white font-bold rounded-xl shadow-md transition flex items-center justify-center gap-2 text-sm disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"></span>
                  Connecting to OPD Cabin...
                </span>
              ) : (
                <>
                  <span>Sign In to OPD</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </main>

      <Footer />
    </div>
  )
}
