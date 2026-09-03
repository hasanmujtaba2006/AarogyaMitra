'use client'

import { useState, useRef } from 'react'
import { Camera, Upload, Check, RefreshCw, X, ShieldAlert, Sparkles } from 'lucide-react'

interface PrescScannerProps {
  language: string;
  onScanComplete: (extractedText: string, details?: any) => void;
}

export default function PrescScanner({ language, onScanComplete }: PrescScannerProps) {
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [photoData, setPhotoData] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState('')
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Multi-lingual UI text helper
  const t = (en: string, hi: string, ta: string, te: string) => {
    if (language === 'hi') return hi
    if (language === 'ta') return ta
    if (language === 'te') return te
    return en
  }

  // Request camera access and start live preview
  const startCamera = async () => {
    setError('')
    setPhotoData(null)
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }, // Back camera on mobile
        audio: false
      })
      setStream(mediaStream)
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
        videoRef.current.play()
      }
    } catch (err) {
      console.error(err)
      setError(t('Camera access denied. Please upload a file instead.', 'कैमरा एक्सेस नहीं मिला। कृपया फाइल अपलोड करें।', 'கேமரா அணுகல் மறுக்கப்பட்டது. கோப்பை பதிவேற்றவும்.', 'కెమెరా యాక్సెస్ నిరాకరించబడింది. దయచేసి ఫైల్ అప్‌లోడ్ చేయండి.'))
    }
  }

  // Stop camera stream
  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop())
      setStream(null)
    }
  }

  // Snap photo from the video element and write to canvas
  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current
      const canvas = canvasRef.current
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const dataUrl = canvas.toDataURL('image/jpeg')
        setPhotoData(dataUrl)
        stopCamera()
      }
    }
  }

  // Handle local file uploads
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setPhotoData(reader.result as string)
        stopCamera()
      }
      reader.readAsDataURL(file)
    }
  }

  // Send the base64 photo data to the backend API for OCR processing
  const submitScan = async () => {
    if (!photoData) return
    setScanning(true)
    setError('')
    try {
      const res = await fetch('/api/ocr/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: photoData })
      })

      if (!res.ok) {
        throw new Error('OCR API returned an error')
      }

      const data = await res.json()
      onScanComplete(data.extracted_text, data.details)
      setPhotoData(null)
    } catch (err: any) {
      setError(t('Failed to process prescription image.', 'पर्चे को स्कैन करने में विफल।', 'மருந்துச்சீட்டை ஸ்கேன் செய்ய முடியவில்லை.', 'ప్రిస్క్రిప్షన్ ఇమేజ్ ప్రాసెస్ చేయడంలో విఫలమైంది.'))
    } finally {
      setScanning(false)
    }
  }

  const cancelPhoto = () => {
    setPhotoData(null)
    setError('')
  }

  return (
    <div className="w-full max-w-2xl mx-auto bg-white rounded-2xl sm:rounded-3xl border-2 sm:border-4 border-blue-900 shadow-xl sm:shadow-2xl p-4 sm:p-8 my-3 sm:my-6">
      <h2 className="text-xl sm:text-3xl font-extrabold text-blue-900 mb-1.5 sm:mb-2">
        {t('Scan Old Prescription', 'पुराना पर्चा स्कैन करें', 'பழைய மருந்துச்சீட்டை ஸ்கேன் செய்யவும்', 'పాత ప్రిస్క్రిప్షన్ స్కాన్ చేయండి')}
      </h2>
      <p className="text-slate-500 text-xs sm:text-lg mb-4 sm:mb-6">
        {t('Capture or upload past doctor prescriptions to extract medical history automatically.', 'पुरानी बीमारी और दवाइयों की जानकारी के लिए पर्चा स्कैन करें।', 'கடந்த கால மருத்துவ விவரங்களை தானாகவே பிரித்தெடுக்க பழைய மருந்துச்சீட்டை பதிவேற்றவும்.', 'స్వయంచాలకంగా గత వైద్య సమాచారాన్ని సేకరించడానికి పాత ప్రిస్క్రిప్షన్‌ను క్యాప్చర్ చేయండి లేదా అప్‌లోడ్ చేయండి.')}
      </p>

      {error && (
        <div className="bg-red-50 border-2 border-red-500 text-red-700 p-3 sm:p-4 rounded-xl mb-4 sm:mb-6 flex items-center gap-2 sm:gap-3 font-bold text-xs sm:text-lg">
          <ShieldAlert className="w-5 h-5 sm:w-8 sm:h-8 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* VIEWPORT FOR CAMERA FEED */}
      {stream && !photoData && (
        <div className="relative rounded-xl sm:rounded-2xl overflow-hidden bg-black border-2 sm:border-4 border-slate-700 aspect-video mb-4 sm:mb-6">
          <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
          <button
            onClick={capturePhoto}
            className="absolute bottom-3 sm:bottom-6 left-1/2 -translate-x-1/2 h-11 sm:h-20 px-4 sm:px-8 bg-blue-800 hover:bg-blue-900 text-white rounded-full flex items-center gap-2 sm:gap-3 font-bold text-xs sm:text-xl active:scale-95 shadow-2xl border-2 sm:border-4 border-white whitespace-nowrap"
          >
            <Camera className="w-4 h-4 sm:w-8 sm:h-8" />
            <span>{t('Capture Prescription', 'फ़ोटो खींचे', 'படம் பிடிக்கவும்', 'ఫోటో తీయండి')}</span>
          </button>
          <button
            onClick={stopCamera}
            className="absolute top-2.5 sm:top-4 right-2.5 sm:right-4 bg-slate-800/80 p-2 sm:p-3 rounded-full text-white hover:bg-slate-800"
          >
            <X className="w-4 h-4 sm:w-6 sm:h-6" />
          </button>
        </div>
      )}

      {/* CAPTURED PHOTO CONFIRMATION SCREEN */}
      {photoData && (
        <div className="flex flex-col items-center mb-4 sm:mb-6">
          <div className="relative rounded-xl sm:rounded-2xl overflow-hidden bg-slate-100 border-2 sm:border-4 border-slate-300 max-h-80 w-full flex justify-center mb-4 sm:mb-6">
            <img src={photoData} alt="Captured Prescription" className="object-contain max-h-80" />
            <button
              onClick={cancelPhoto}
              className="absolute top-2.5 sm:top-4 right-2.5 sm:right-4 bg-red-600 text-white p-2 sm:p-3 rounded-full hover:bg-red-700 shadow-lg"
              disabled={scanning}
            >
              <X className="w-4 h-4 sm:w-6 sm:h-6" />
            </button>
          </div>

          <div className="flex gap-2.5 sm:gap-4 w-full">
            <button
              onClick={startCamera}
              disabled={scanning}
              className="w-1/2 h-12 sm:h-20 bg-slate-100 border-2 sm:border-4 border-slate-300 hover:bg-slate-200 text-slate-700 font-extrabold text-xs sm:text-xl rounded-xl sm:rounded-2xl flex justify-center items-center gap-1.5 sm:gap-2 active:scale-95 transition-all"
            >
              <RefreshCw className="w-4 h-4 sm:w-6 sm:h-6" />
              <span>{t('Retake Photo', 'दोबारा खींचे', 'மீண்டும் எடுக்கவும்', 'మళ్లీ తీయండి')}</span>
            </button>
            <button
              onClick={submitScan}
              disabled={scanning}
              className="flex-1 h-12 sm:h-20 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs sm:text-2xl rounded-xl sm:rounded-2xl flex justify-center items-center gap-1.5 sm:gap-3 active:scale-95 transition-all shadow-lg"
            >
              {scanning ? (
                <span className="animate-pulse">{t('Reading Prescription...', 'पर्चा पढ़ रहे हैं...', 'பரிசீலிக்கிறது...', 'ప్రిస్క్రిప్షన్ చదువుతోంది...')}</span>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 sm:w-8 sm:h-8" />
                  <span>{t('Submit Prescription', 'पर्चा जमा करें', 'சமர்ப்பிக்கவும்', 'ప్రిస్క్రిప్షన్ సమర్పించండి')}</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* CHOOSE MODE / DEFAULT INTERFACE */}
      {!stream && !photoData && (
        <div className="flex flex-col gap-3 sm:gap-4">
          <button
            onClick={startCamera}
            className="h-14 sm:h-24 bg-blue-800 hover:bg-blue-900 text-white border-2 sm:border-4 border-blue-900 rounded-xl sm:rounded-2xl flex justify-center items-center gap-2.5 sm:gap-4 active:scale-95 transition-all shadow-lg"
          >
            <Camera className="w-6 h-6 sm:w-10 sm:h-10" />
            <span className="text-base sm:text-2xl font-black">{t('Use Kiosk Camera', 'कियोस्क कैमरा चालू करें', 'கேமராவை பயன்படுத்தவும்', 'కియోస్క్ కెమెరా ఉపయోగించండి')}</span>
          </button>

          <div className="relative flex py-2 sm:py-3 items-center">
            <div className="flex-grow border-t-2 border-slate-300"></div>
            <span className="flex-shrink mx-3 sm:mx-4 text-slate-400 font-bold text-sm sm:text-lg">{t('OR', 'या', 'அல்லது', 'లేదా')}</span>
            <div className="flex-grow border-t-2 border-slate-300"></div>
          </div>

          <label className="h-14 sm:h-20 bg-slate-100 hover:bg-slate-200 text-slate-700 border-2 sm:border-4 border-slate-300 border-dashed rounded-xl sm:rounded-2xl flex justify-center items-center gap-2 sm:gap-3 cursor-pointer active:scale-95 transition-all">
            <Upload className="w-5 h-5 sm:w-8 sm:h-8" />
            <span className="text-xs sm:text-xl font-bold">{t('Upload Prescription Image', 'पर्चे की फोटो अपलोड करें', 'கோப்பை பதிவேற்றவும்', 'ప్రిస్క్రిప్షన్ చిత్రాన్ని అప్‌లోడ్ చేయండి')}</span>
            <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
          </label>
        </div>
      )}

      {/* Hidden canvas for drawing snapshots */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  )
}
