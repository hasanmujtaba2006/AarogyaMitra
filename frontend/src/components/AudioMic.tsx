'use client'

import { useState, useEffect, useRef } from 'react'
import { Mic, MicOff, Send, MessageSquare, AlertCircle, Volume2 } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant';
  message: string;
  translated_message?: string;
}

interface AudioMicProps {
  language: string;
  messages: Message[];
  onSendMessage: (text: string) => void;
  isProcessing: boolean;
}

export default function AudioMic({ language, messages, onSendMessage, isProcessing }: AudioMicProps) {
  const [isListening, setIsListening] = useState(false)
  const [textInput, setTextInput] = useState('')
  const [speechError, setSpeechError] = useState('')
  const [voices, setVoices] = useState<any[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  
  const recognitionRef = useRef<any>(null)
  const activeAudioRef = useRef<HTMLAudioElement | null>(null)

  // Track and update available speech synthesis voices
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const updateVoices = () => {
        setVoices(window.speechSynthesis.getVoices())
      }
      updateVoices()
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = updateVoices
      }
    }
  }, [])

  // Multi-lingual UI translations
  const t = (en: string, hi: string, ta: string, te: string) => {
    if (language === 'hi') return hi
    if (language === 'ta') return ta
    if (language === 'te') return te
    return en
  }

  // Scroll chat to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Initialize Speech Recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition()
        recognition.continuous = false
        recognition.interimResults = false
        
        // Map local languages to BCP-47 speech recognition locales
        let locale = 'en-IN'
        if (language === 'hi') locale = 'hi-IN'
        if (language === 'ta') locale = 'ta-IN'
        if (language === 'te') locale = 'te-IN'
        
        recognition.lang = locale

        recognition.onstart = () => {
          setIsListening(true)
          setSpeechError('')
        }

        recognition.onerror = (event: any) => {
          console.error('Speech recognition error', event.error)
          if (event.error === 'no-speech') {
            setSpeechError(t('No speech detected. Try again.', 'कोई आवाज़ नहीं सुनी गई। फिर से प्रयास करें।', 'பேச்சு எதுவும் கண்டறியப்படவில்லை. மீண்டும் முயற்சிக்கவும்.', 'మాటలేవీ గుర్తించబడలేదు. మళ్లీ ప్రయత్నించండి.'))
          } else {
            setSpeechError(t('Voice input failed. Try manual typing.', 'आवाज़ इनपुट विफल रहा। कृपया टाइप करें।', 'குரல் உள்ளீடு தோல்வியடைந்தது. தட்டச்சு செய்யவும்.', 'వాయిస్ ఇన్‌పుట్ విఫలమైంది. దయచేసి టైప్ చేయండి.'))
          }
          setIsListening(false)
        }

        recognition.onend = () => {
          setIsListening(false)
        }

        recognition.onresult = (event: any) => {
          const transcriptResult = event.results[0][0].transcript
          if (transcriptResult) {
            setTextInput(transcriptResult)
            // Auto submit speech results
            onSendMessage(transcriptResult)
            setTextInput('')
          }
        }

        recognitionRef.current = recognition
      }
    }
  }, [language])

  const toggleListening = () => {
    if (!recognitionRef.current) {
      setSpeechError(t('Speech recognition not supported in this browser.', 'इस ब्राउज़र में स्पीच रिकग्निशन समर्थित नहीं है।', 'இந்த உலாவியில் பேச்சு அங்கீகாரம் ஆதரிக்கப்படவில்லை.', 'ఈ బ్రౌజర్‌లో స్పీచ్ రికగ్నిషన్ సపోర్ట్ లేదు.'))
      return
    }

    if (isListening) {
      recognitionRef.current.stop()
    } else {
      setSpeechError('')
      recognitionRef.current.start()
    }
  }

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault()
    if (!textInput.trim() || isProcessing) return
    onSendMessage(textInput)
    setTextInput('')
  }

  // Fallback to online translation TTS when native locale voice is not installed
  const speakOnline = (text: string, lang: string) => {
    const chunks: string[] = []
    if (text.length <= 200) {
      chunks.push(text)
    } else {
      const sentences = text.split(/([.?!।|\n]+)/g)
      let currentChunk = ""
      for (let part of sentences) {
        if ((currentChunk + part).length > 200) {
          if (currentChunk.trim()) chunks.push(currentChunk.trim())
          currentChunk = part
        } else {
          currentChunk += part
        }
      }
      if (currentChunk.trim()) chunks.push(currentChunk.trim())
    }

    let index = 0
    const playNext = () => {
      if (index < chunks.length) {
        const url = `/api/chat/tts?lang=${lang}&text=${encodeURIComponent(chunks[index])}`
        const audio = new Audio(url)
        activeAudioRef.current = audio
        audio.onended = () => {
          index++
          playNext()
        }
        audio.onerror = (err) => {
          console.error("Online TTS playback error:", err)
          index++
          playNext()
        }
        audio.play().catch(err => {
          console.error("Online TTS play failed:", err)
        })
      } else {
        activeAudioRef.current = null
      }
    }
    playNext()
  }

  // Synthesize Text-to-Speech (TTS) for accessibility fallback
  const handleSpeak = (text: string) => {
    // 1. Stop any active speech synthesis
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }

    // 2. Stop any active online audio fallback
    if (activeAudioRef.current) {
      activeAudioRef.current.pause()
      activeAudioRef.current = null
    }

    let voiceLocale = 'en-IN'
    if (language === 'hi') voiceLocale = 'hi-IN'
    if (language === 'ta') voiceLocale = 'ta-IN'
    if (language === 'te') voiceLocale = 'te-IN'

    // Get latest voices if the state is empty
    const availableVoices = voices.length > 0 ? voices : (typeof window !== 'undefined' ? window.speechSynthesis.getVoices() : [])
    const targetLang = voiceLocale.toLowerCase().replace('_', '-')

    // 1. Try to find an exact match for targetLang (e.g. 'hi-in')
    let matchedVoice = availableVoices.find(voice => {
      const vLang = voice.lang.toLowerCase().replace('_', '-')
      return vLang === targetLang
    })

    // 2. Fallback: Try to find a voice matching the language prefix (e.g. 'hi')
    if (!matchedVoice) {
      matchedVoice = availableVoices.find(voice => {
        const vLang = voice.lang.toLowerCase().replace('_', '-')
        return vLang.startsWith(language.toLowerCase())
      })
    }

    // Use browser speech synthesis if a matched native voice exists OR if language is English
    if (matchedVoice || language === 'en') {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text)
        utterance.lang = voiceLocale
        if (matchedVoice) {
          utterance.voice = matchedVoice
        }
        window.speechSynthesis.speak(utterance)
      }
    } else {
      // Otherwise, use online fallback TTS for regional language
      speakOnline(text, language)
    }
  }

  return (
    <div className="flex-1 flex flex-col w-full max-w-4xl mx-auto bg-white rounded-3xl border-4 border-blue-900 shadow-2xl overflow-hidden min-h-[600px] my-6">
      {/* Dialogue Header */}
      <div className="bg-blue-900 text-white px-6 py-4 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-3">
          <MessageSquare className="w-8 h-8" />
          <span className="text-2xl font-extrabold">
            {t('Consulting Doctor (AI)', 'डॉक्टर से परामर्श (AI)', 'மருத்துவரிடம் ஆலோசனை (AI)', 'వైద్యునితో సంప్రదింపులు (AI)')}
          </span>
        </div>
        <div className="bg-blue-800 text-sm px-4 py-1.5 rounded-full font-bold uppercase">
          {t('Intake Phase', 'जानकारी चरण', 'தகவல் சேகரிப்பு', 'సమాచార దశ')}
        </div>
      </div>

      {/* Message History */}
      <div className="flex-1 overflow-y-auto p-6 bg-slate-50 flex flex-col gap-6">
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col justify-center items-center text-slate-400 text-center py-12">
            <Volume2 className="w-16 h-16 mb-4 text-slate-300" />
            <p className="text-2xl font-bold">
              {t('Press the Microphone below to speak', 'बोलने के लिए नीचे दिए गए माइक्रोफ़ोन को दबाएं', 'பேசுவதற்கு கீழே உள்ள மைக்ரோஃபோனை அழுத்தவும்', 'మాట్లాడటానికి క్రింది మైక్రోఫోన్‌ను నొక్కండి')}
            </p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isUser = msg.role === 'user'
            // In bilingual mode, display the native translated message primarily, and English version below it.
            const primaryText = msg.translated_message || msg.message
            const secondaryText = msg.translated_message ? msg.message : null

            return (
              <div
                key={index}
                className={`flex flex-col max-w-[85%] ${isUser ? 'self-end items-end' : 'self-start items-start'}`}
              >
                <div
                  className={`p-5 rounded-3xl text-xl md:text-2xl font-semibold shadow-md ${
                    isUser
                      ? 'bg-blue-800 text-white rounded-tr-none'
                      : 'bg-white text-slate-900 border-2 border-slate-200 rounded-tl-none'
                  }`}
                >
                  <p>{primaryText}</p>
                  {secondaryText && (
                    <p className={`text-sm mt-2 font-medium border-t pt-1.5 ${isUser ? 'border-blue-700 text-blue-200' : 'border-slate-100 text-slate-500'}`}>
                      {secondaryText}
                    </p>
                  )}
                </div>
                
                {/* Audio assist button for LLM assistant messages */}
                {!isUser && (
                  <button
                    onClick={() => handleSpeak(primaryText)}
                    className="mt-2 text-blue-700 hover:text-blue-900 flex items-center gap-1.5 text-base font-bold bg-white px-3 py-1 rounded-full border border-blue-200 shadow-sm"
                  >
                    <Volume2 className="w-5 h-5" />
                    <span>{t('Listen', 'सुनें', 'கேளுங்கள்', 'వినండి')}</span>
                  </button>
                )}
              </div>
            )
          })
        )}
        {isProcessing && (
          <div className="self-start bg-white text-slate-900 border-2 border-slate-200 p-5 rounded-3xl rounded-tl-none max-w-[85%] shadow-md flex items-center gap-3">
            <span className="flex gap-1">
              <span className="h-3 w-3 bg-blue-800 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
              <span className="h-3 w-3 bg-blue-800 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
              <span className="h-3 w-3 bg-blue-800 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
            </span>
            <span className="text-lg font-bold text-slate-500">
              {t('Processing...', 'प्रक्रिया जारी है...', 'செயலாக்குகிறது...', 'ప్రక్రియ జరుగుతోంది...')}
            </span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Interaction panel: Big Microphone and Text input */}
      <div className="border-t-4 border-slate-200 p-6 bg-white shrink-0 flex flex-col gap-4">
        {speechError && (
          <div className="bg-amber-50 border-2 border-amber-500 text-amber-800 px-4 py-3 rounded-xl flex items-center gap-2 text-lg font-bold">
            <AlertCircle className="w-6 h-6 shrink-0" />
            <span>{speechError}</span>
          </div>
        )}

        <div className="flex flex-col md:flex-row items-center gap-6 justify-center">
          {/* Microphone & Bhashini Badge Container */}
          <div className="flex flex-col items-center gap-3 shrink-0">
            {/* Big pulsing mic toggle */}
            <button
              onClick={toggleListening}
              disabled={isProcessing}
              className={`w-28 h-28 rounded-full flex justify-center items-center text-white shadow-xl transition-all active:scale-90 ${
                isListening
                  ? 'bg-rose-600 animate-pulse-mic'
                  : 'bg-blue-800 hover:bg-blue-900'
              }`}
            >
              {isListening ? (
                <Mic className="w-14 h-14" />
              ) : (
                <MicOff className="w-14 h-14" />
              )}
            </button>

            {/* Bhashini Pill Badge */}
            <div className="flex items-center gap-2 bg-gray-100 text-gray-600 text-xs font-bold rounded-full px-4 py-2 border border-gray-200 shadow-sm">
              <img
                src="/logos/bhashini-logo.jpg"
                alt="Bhashini Logo"
                className="h-5 w-auto object-contain rounded"
              />
              <span>Powered by Bhashini</span>
            </div>
          </div>

          {/* Text input fallback form */}
          <form onSubmit={handleSend} className="flex-1 w-full flex gap-3">
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder={
                isListening
                  ? t('Listening... speak now', 'सुन रहे हैं... कृपया बोलें', 'கேட்கிறது... இப்போது பேசுங்கள்', 'వింటున్నాము... ఇప్పుడు మాట్లాడండి')
                  : t('Type a message or press mic...', 'संदेश लिखें या माइक दबाएं...', 'செய்தியைத் தட்டச்சு செய்யவும்...', 'సందేశాన్ని టైప్ చేయండి...')
              }
              className="flex-1 text-xl px-5 py-4 border-4 border-slate-300 rounded-2xl focus:border-blue-800 outline-none font-semibold"
              disabled={isProcessing}
            />
            <button
              type="submit"
              disabled={!textInput.trim() || isProcessing}
              className="w-20 bg-blue-800 hover:bg-blue-900 text-white rounded-2xl flex justify-center items-center active:scale-95 disabled:bg-slate-300 disabled:scale-100 transition-all shadow-md"
            >
              <Send className="w-8 h-8" />
            </button>
          </form>
        </div>
        
        <p className="text-center text-sm font-bold text-slate-500">
          {t('Voice recording matches local dialect input (Bhashini compatible)', 'आवाज़ रिकॉर्डिंग स्थानीय भाषा के अनुकूल है', 'உள்ளூர் மொழி குரல் பதிவு', 'వాయిస్ రికార్డింగ్ స్థానిక భాషకు అనుకూలంగా ఉంటుంది')}
        </p>
      </div>
    </div>
  )
}
