'use client'

import { useState, useEffect, useRef } from 'react'
import { Mic, MicOff, Send, MessageSquare, AlertCircle, Volume2, VolumeX, Square, Globe } from 'lucide-react'
import { LanguageCode } from '@/context/LanguageContext'

interface Message {
  role: 'user' | 'assistant';
  message: string;
  translated_message?: string;
  spoken_language?: string;
}

interface AudioMicProps {
  language: string;
  messages: Message[];
  onSendMessage: (text: string) => void;
  isProcessing: boolean;
  onLanguageChange?: (lang: LanguageCode) => void;
}

export default function AudioMic({ language, messages, onSendMessage, isProcessing, onLanguageChange }: AudioMicProps) {
  const [isListening, setIsListening] = useState(false)
  const [textInput, setTextInput] = useState('')
  const [speechError, setSpeechError] = useState('')
  const [voices, setVoices] = useState<any[]>([])
  const [autoSpeak, setAutoSpeak] = useState(true)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [currentSpeakingMsgIndex, setCurrentSpeakingMsgIndex] = useState<number | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<any>(null)
  const activeAudioRef = useRef<HTMLAudioElement | null>(null)
  const lastSpokenIndexRef = useRef<number>(-1)

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
          console.warn('Speech recognition notice:', event.error)
          if (event.error === 'no-speech') {
            setSpeechError(t('No speech detected. Press the mic again to speak.', 'कोई आवाज़ नहीं सुनी गई। बोलने के लिए पुनः माइक दबाएं।', 'பேச்சு எதுவும் கண்டறியப்படவில்லை. மீண்டும் மைக் அழுத்தவும்.', 'మాటలేవీ గుర్తించబడలేదు. మళ్లీ మైక్ నొక్కండి.'))
          } else if (event.error === 'not-allowed') {
            setSpeechError(t('Microphone access denied. Please allow microphone in browser.', 'माइक्रोफ़ोन की अनुमति नहीं है। कृपया ब्राउज़र में अनुमति दें।', 'மைக்ரோஃபோன் அனுமதி தேவை.', 'మైక్రోఫోన్ అనుమతి అవసరం.'))
          } else {
            setSpeechError(t('Voice input stopped. Press mic to try again.', 'आवाज़ इनपुट रुक गया। पुनः प्रयास करने के लिए माइक दबाएं।', 'குரல் உள்ளீடு நின்றது.', 'వాయిస్ ఇన్‌పుట్ ఆగింది.'))
          }
          setIsListening(false)

          // Auto-clear notice after 3.5 seconds so patient is not stuck with warning banner
          setTimeout(() => {
            setSpeechError('')
          }, 3500)
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

  const stopSpeaking = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
    if (activeAudioRef.current) {
      activeAudioRef.current.pause()
      activeAudioRef.current.currentTime = 0
      activeAudioRef.current = null
    }
    setIsSpeaking(false)
    setCurrentSpeakingMsgIndex(null)
  }

  const toggleListening = () => {
    // Silence assistant speech before patient starts speaking
    stopSpeaking()

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
    stopSpeaking()
    onSendMessage(textInput)
    setTextInput('')
  }

  // High-fidelity online audio playback via backend Google TTS proxy
  const speakOnline = (text: string, lang: string, msgIdx?: number) => {
    stopSpeaking()
    setIsSpeaking(true)
    if (msgIdx !== undefined) {
      setCurrentSpeakingMsgIndex(msgIdx)
    }

    const cleanedText = text.replace(/[*_#`~]/g, '').trim()
    if (!cleanedText) {
      setIsSpeaking(false)
      setCurrentSpeakingMsgIndex(null)
      return
    }

    // Split text into <= 180 char sentences for Google TTS
    const chunks: string[] = []
    if (cleanedText.length <= 180) {
      chunks.push(cleanedText)
    } else {
      const sentences = cleanedText.split(/([.?!।|\n]+)/g)
      let currentChunk = ""
      for (const part of sentences) {
        if ((currentChunk + part).length > 180) {
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
        const url = `/api/chat/tts?lang=${encodeURIComponent(lang)}&text=${encodeURIComponent(chunks[index])}`
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
          console.warn("Online TTS play blocked (user gesture required):", err)
          setIsSpeaking(false)
          setCurrentSpeakingMsgIndex(null)
        })
      } else {
        setIsSpeaking(false)
        setCurrentSpeakingMsgIndex(null)
        activeAudioRef.current = null
      }
    }
    playNext()
  }

  // Synthesize Text-to-Speech in preferred / spoken language
  const handleSpeak = (text: string, targetLang?: string, msgIdx?: number) => {
    if (!text) return

    stopSpeaking()

    const cleanedText = text.replace(/[*_#`~]/g, '').trim()

    // Determine voice language: if text contains Devanagari, Tamil, or Telugu Unicode, lock to that language
    let lang = targetLang || language || 'en'
    if (/[\u0900-\u097F]/.test(cleanedText)) {
      lang = 'hi'
    } else if (/[\u0B80-\u0BFF]/.test(cleanedText)) {
      lang = 'ta'
    } else if (/[\u0C00-\u0C7F]/.test(cleanedText)) {
      lang = 'te'
    }

    let voiceLocale = 'en-IN'
    if (lang === 'hi') voiceLocale = 'hi-IN'
    if (lang === 'ta') voiceLocale = 'ta-IN'
    if (lang === 'te') voiceLocale = 'te-IN'

    const availableVoices = voices.length > 0 ? voices : (typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis.getVoices() : [])
    const targetCode = voiceLocale.toLowerCase().replace('_', '-')

    let matchedVoice = availableVoices.find(voice => {
      const vLang = voice.lang.toLowerCase().replace('_', '-')
      return vLang === targetCode
    })

    if (!matchedVoice) {
      matchedVoice = availableVoices.find(voice => {
        const vLang = voice.lang.toLowerCase().replace('_', '-')
        return vLang.startsWith(lang.toLowerCase())
      })
    }

    // If an authentic native regional voice exists in browser, use SpeechSynthesis
    if (matchedVoice && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        const utterance = new SpeechSynthesisUtterance(cleanedText)
        utterance.lang = voiceLocale
        utterance.voice = matchedVoice
        utterance.rate = 0.95
        utterance.onstart = () => {
          setIsSpeaking(true)
          if (msgIdx !== undefined) setCurrentSpeakingMsgIndex(msgIdx)
        }
        utterance.onend = () => {
          setIsSpeaking(false)
          setCurrentSpeakingMsgIndex(null)
        }
        utterance.onerror = () => {
          setIsSpeaking(false)
          setCurrentSpeakingMsgIndex(null)
          speakOnline(cleanedText, lang, msgIdx)
        }
        window.speechSynthesis.speak(utterance)
      } catch (e) {
        speakOnline(cleanedText, lang, msgIdx)
      }
    } else {
      // High-quality regional voice via backend Google TTS proxy
      speakOnline(cleanedText, lang, msgIdx)
    }
  }

  // Automatic Voice Output: Triggered immediately when a new AI response arrives
  useEffect(() => {
    if (!messages || messages.length === 0) return

    const lastIdx = messages.length - 1
    const lastMsg = messages[lastIdx]

    if (lastMsg.role === 'assistant' && lastIdx > lastSpokenIndexRef.current) {
      lastSpokenIndexRef.current = lastIdx
      if (autoSpeak) {
        const textToSpeak = lastMsg.translated_message || lastMsg.message
        const langToUse = lastMsg.spoken_language || language || 'en'
        const timer = setTimeout(() => {
          handleSpeak(textToSpeak, langToUse, lastIdx)
        }, 200)
        return () => clearTimeout(timer)
      }
    }
  }, [messages, autoSpeak, language])

  return (
    <div className="flex-1 flex flex-col w-full max-w-4xl mx-auto bg-white rounded-2xl sm:rounded-3xl border-2 sm:border-4 border-blue-900 shadow-xl sm:shadow-2xl overflow-hidden min-h-[480px] sm:min-h-[600px] my-2 sm:my-6">
      {/* Dialogue Header */}
      <div className="bg-blue-900 text-white px-3.5 sm:px-6 py-2.5 sm:py-4 flex justify-between items-center shrink-0 gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <MessageSquare className="w-5 h-5 sm:w-8 sm:h-8 shrink-0 text-blue-300" />
          <span className="text-sm sm:text-2xl font-extrabold truncate">
            {t('Consulting Doctor (AI)', 'डॉक्टर से परामर्श (AI)', 'மருத்துவரிடம் ஆலோசனை (AI)', 'వైద్యునితో సంప్రదింపులు (AI)')}
          </span>
        </div>

        {/* Header Controls: Auto-voice toggle & Stop button */}
        <div className="flex items-center gap-2 shrink-0">
          {isSpeaking && (
            <button
              onClick={stopSpeaking}
              type="button"
              className="bg-rose-600 hover:bg-rose-700 text-white text-[10px] sm:text-xs px-2.5 sm:px-3 py-1 rounded-full font-black flex items-center gap-1.5 shadow-sm transition-all animate-pulse"
              title={t('Stop Speaking', 'आवाज़ रोकें', 'நிறுத்து', 'ఆపండి')}
            >
              <Square className="w-3 h-3 fill-current" />
              <span>{t('Stop', 'रोकें', 'நிறுத்து', 'ఆపు')}</span>
            </button>
          )}

          <button
            onClick={() => {
              if (autoSpeak && isSpeaking) stopSpeaking()
              setAutoSpeak(!autoSpeak)
            }}
            type="button"
            className={`text-[10px] sm:text-xs px-2.5 sm:px-3 py-1 rounded-full font-bold flex items-center gap-1.5 transition-all border ${
              autoSpeak
                ? 'bg-emerald-600 text-white border-emerald-400 shadow-sm'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
            title={autoSpeak ? t('Auto-Voice ON (AI will speak responses)', 'स्वचालित आवाज़ चालू', 'தானியங்கி குரல் ஆன்', 'ఆటో వాయిస్ ఆన్') : t('Auto-Voice OFF', 'स्वचालित आवाज़ बंद', 'தானியங்கி குரல் ஆஃப்', 'ఆటో వాయిస్ ఆఫ్')}
          >
            {autoSpeak ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5 text-slate-400" />}
            <span className="hidden xs:inline">
              {autoSpeak
                ? t('Voice: ON', 'आवाज़: चालू', 'குரல்: ஆன்', 'వాయిస్: ఆన్')
                : t('Voice: OFF', 'आवाज़: बंद', 'குரல்: ஆஃப்', 'వాయిస్: ఆఫ్')}
            </span>
          </button>

          <div className="bg-blue-800 text-[10px] sm:text-xs px-2 sm:px-3 py-1 rounded-full font-bold uppercase shrink-0">
            {t('Intake Phase', 'जानकारी चरण', 'தகவல் சேகரிப்பு', 'సమాచార దశ')}
          </div>
        </div>
      </div>

      {/* Quick Language Switcher Bar: Visible right on the consultation interface */}
      <div className="bg-blue-950 text-white px-3 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-2 border-b border-blue-800">
        <div className="flex items-center gap-1.5 text-xs text-blue-200 font-bold">
          <Globe className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>{t('Speaking / Consultation Language:', 'बातचीत की भाषा:', 'பேசும் மொழி:', 'మాట్లాడే భాష:')}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {[
            { code: 'hi', label: 'हिन्दी (Hindi)' },
            { code: 'en', label: 'English' },
            { code: 'ta', label: 'தமிழ் (Tamil)' },
            { code: 'te', label: 'తెలుగు (Telugu)' }
          ].map((l) => {
            const isSelected = language === l.code
            return (
              <button
                key={l.code}
                type="button"
                onClick={() => {
                  stopSpeaking()
                  if (onLanguageChange) onLanguageChange(l.code as LanguageCode)
                }}
                className={`px-2.5 sm:px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  isSelected
                    ? 'bg-emerald-500 text-slate-950 shadow-md font-extrabold scale-105 ring-2 ring-emerald-300'
                    : 'bg-blue-900/70 text-slate-200 hover:bg-blue-800 hover:text-white'
                }`}
              >
                {l.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Message History */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-6 bg-slate-50 flex flex-col gap-3 sm:gap-6 max-h-[450px] sm:max-h-[550px]">
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col justify-center items-center text-slate-400 text-center py-8 sm:py-12">
            <Volume2 className="w-10 h-10 sm:w-16 sm:h-16 mb-2 sm:mb-4 text-slate-300 animate-pulse" />
            <p className="text-base sm:text-2xl font-bold px-4">
              {t('Press the Microphone below to speak', 'बोलने के लिए नीचे दिए गए माइक्रोफ़ोन को दबाएं', 'பேசுவதற்கு கீழே உள்ள மைக்ரோஃபோனை அழுத்தவும்', 'మాట్లాడటానికి క్రింది మైక్రోఫోన్‌ను నొక్కండి')}
            </p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isUser = msg.role === 'user'
            const primaryText = msg.translated_message || msg.message
            const secondaryText = msg.translated_message && msg.message !== msg.translated_message ? msg.message : null
            const isMsgSpeaking = isSpeaking && currentSpeakingMsgIndex === index

            return (
              <div
                key={index}
                className={`flex flex-col max-w-[90%] sm:max-w-[85%] ${isUser ? 'self-end items-end' : 'self-start items-start'}`}
              >
                <div
                  className={`p-3 sm:p-5 rounded-2xl sm:rounded-3xl text-sm sm:text-xl md:text-2xl font-semibold shadow-sm sm:shadow-md ${
                    isUser
                      ? 'bg-blue-800 text-white rounded-tr-none'
                      : 'bg-white text-slate-900 border sm:border-2 border-slate-200 rounded-tl-none'
                  }`}
                >
                  <p>{primaryText}</p>
                  {secondaryText && (
                    <p className={`text-xs sm:text-sm mt-1.5 sm:mt-2 font-medium border-t pt-1 sm:pt-1.5 ${isUser ? 'border-blue-700 text-blue-200' : 'border-slate-100 text-slate-500'}`}>
                      {secondaryText}
                    </p>
                  )}
                </div>

                {/* Audio assist button for LLM assistant messages */}
                {!isUser && (
                  <div className="mt-1.5 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (isMsgSpeaking) {
                          stopSpeaking()
                        } else {
                          handleSpeak(primaryText, msg.spoken_language || language, index)
                        }
                      }}
                      className={`flex items-center gap-1 sm:gap-1.5 text-xs sm:text-sm font-bold px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full border shadow-sm transition-all ${
                        isMsgSpeaking
                          ? 'bg-rose-50 text-rose-700 border-rose-300'
                          : 'bg-white text-blue-700 hover:text-blue-900 border-blue-200'
                      }`}
                    >
                      {isMsgSpeaking ? (
                        <>
                          <Square className="w-3 h-3 fill-current text-rose-600" />
                          <span>{t('Stop', 'रोकें', 'நிறுத்து', 'ఆపు')}</span>
                        </>
                      ) : (
                        <>
                          <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600" />
                          <span>{t('Listen', 'सुनें', 'கேளுங்கள்', 'వినండి')}</span>
                        </>
                      )}
                    </button>

                    {isMsgSpeaking && (
                      <span className="flex items-center gap-1 text-[11px] sm:text-xs font-bold text-blue-800 animate-pulse">
                        <span className="inline-block w-1 h-2.5 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                        <span className="inline-block w-1 h-3.5 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                        <span className="inline-block w-1 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                        <span className="ml-1 text-slate-600">{t('Speaking...', 'बोल रहे हैं...', 'பேசுகிறது...', 'మాట్లాడుతోంది...')}</span>
                      </span>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
        {isProcessing && (
          <div className="self-start bg-white text-slate-900 border border-slate-200 p-3 sm:p-5 rounded-2xl sm:rounded-3xl rounded-tl-none max-w-[90%] sm:max-w-[85%] shadow-sm sm:shadow-md flex items-center gap-2 sm:gap-3">
            <span className="flex gap-1">
              <span className="h-2 sm:h-3 w-2 sm:w-3 bg-blue-800 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
              <span className="h-2 sm:h-3 w-2 sm:w-3 bg-blue-800 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
              <span className="h-2 sm:h-3 w-2 sm:w-3 bg-blue-800 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
            </span>
            <span className="text-xs sm:text-lg font-bold text-slate-500">
              {t('Processing...', 'प्रक्रिया जारी है...', 'செயலாக்குகிறது...', 'ప్రక్రియ జరుగుతోంది...')}
            </span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Interaction panel: Big Microphone and Text input */}
      <div className="border-t-2 sm:border-t-4 border-slate-200 p-3 sm:p-6 bg-white shrink-0 flex flex-col gap-3 sm:gap-4">
        {speechError && (
          <div className="bg-amber-50 border-2 border-amber-500 text-amber-800 px-3 sm:px-4 py-2 sm:py-3 rounded-xl flex items-center gap-2 text-xs sm:text-lg font-bold">
            <AlertCircle className="w-4 h-4 sm:w-6 sm:h-6 shrink-0" />
            <span>{speechError}</span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-6 justify-center">
          {/* Microphone & Bhashini Badge Container */}
          <div className="flex sm:flex-col items-center gap-2 sm:gap-3 shrink-0">
            {/* Big pulsing mic toggle */}
            <button
              onClick={toggleListening}
              disabled={isProcessing}
              className={`w-16 h-16 sm:w-28 sm:h-28 rounded-full flex justify-center items-center text-white shadow-lg sm:shadow-xl transition-all active:scale-90 ${
                isListening
                  ? 'bg-rose-600 animate-pulse-mic'
                  : 'bg-blue-800 hover:bg-blue-900'
              }`}
            >
              {isListening ? (
                <Mic className="w-8 h-8 sm:w-14 sm:h-14" />
              ) : (
                <MicOff className="w-8 h-8 sm:w-14 sm:h-14" />
              )}
            </button>

            {/* Bhashini Pill Badge */}
            <div className="flex items-center gap-1.5 sm:gap-2 bg-gray-100 text-gray-600 text-[10px] sm:text-xs font-bold rounded-full px-2.5 sm:px-4 py-1 sm:py-2 border border-gray-200 shadow-sm">
              <img
                src="/logos/bhashini-logo.jpg"
                alt="Bhashini Logo"
                className="h-4 sm:h-5 w-auto object-contain rounded"
              />
              <span>Powered by Bhashini</span>
            </div>
          </div>

          {/* Text input fallback form */}
          <form onSubmit={handleSend} className="flex-1 w-full flex gap-2 sm:gap-3">
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder={
                isListening
                  ? t('Listening... speak now', 'सुन रहे हैं... कृपया बोलें', 'கேட்கிறது... இப்போது பேசுங்கள்', 'వింటున్నాము... ఇప్పుడు మాట్లాడండి')
                  : t('Type a message or press mic...', 'संदेश लिखें या माइक दबाएं...', 'செய்தியைத் தட்டச்சு செய்யவும்...', 'సందేశాన్ని టైప్ చేయండి...')
              }
              className="flex-1 text-sm sm:text-xl px-3 sm:px-5 py-2.5 sm:py-4 border-2 sm:border-4 border-slate-300 rounded-xl sm:rounded-2xl focus:border-blue-800 outline-none font-semibold"
              disabled={isProcessing}
            />
            <button
              type="submit"
              disabled={!textInput.trim() || isProcessing}
              className="w-12 sm:w-20 bg-blue-800 hover:bg-blue-900 text-white rounded-xl sm:rounded-2xl flex justify-center items-center active:scale-95 disabled:bg-slate-300 disabled:scale-100 transition-all shadow-md shrink-0"
            >
              <Send className="w-4 h-4 sm:w-8 sm:h-8" />
            </button>
          </form>
        </div>
        
        <p className="text-center text-[11px] sm:text-sm font-bold text-slate-500">
          {t('Voice recording matches local dialect input (Bhashini compatible)', 'आवाज़ रिकॉर्डिंग स्थानीय भाषा के अनुकूल है', 'உள்ளூர் மொழி குரல் பதிவு', 'వాయిస్ రికార్డింగ్ స్థానిక భాషకు అనుకూలంగా ఉంటుంది')}
        </p>
      </div>
    </div>
  )
}
