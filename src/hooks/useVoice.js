import { useState, useRef, useCallback } from 'react'

export function useVoiceRecognition({ onResult, onError }) {
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const recognitionRef = useRef(null)
  const finalTranscriptRef = useRef('')
  const interimTranscriptRef = useRef('')

  const startListening = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      onError?.('Il tuo browser non supporta il riconoscimento vocale. Usa Chrome su Android o Safari su iOS.')
      return
    }

    finalTranscriptRef.current = ''
    interimTranscriptRef.current = ''

    const recognition = new SpeechRecognition()
    recognition.lang = 'it-IT'
    recognition.continuous = false
    recognition.interimResults = true
    recognition.maxAlternatives = 1

    recognition.onstart = () => setIsListening(true)

    recognition.onresult = (event) => {
      let interim = ''
      let final = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript
        if (event.results[i].isFinal) final += t
        else interim += t
      }
      if (final) {
        finalTranscriptRef.current += final
        setTranscript(finalTranscriptRef.current)
      } else {
        interimTranscriptRef.current = interim
        setTranscript(finalTranscriptRef.current + interim)
      }
    }

    recognition.onend = () => {
      setIsListening(false)
      // Safari spesso non emette risultati finali — usiamo l'interim come fallback
      const text = finalTranscriptRef.current.trim() || interimTranscriptRef.current.trim()
      if (text) {
        onResult?.(text)
        finalTranscriptRef.current = ''
        interimTranscriptRef.current = ''
        setTranscript('')
      }
    }

    recognition.onerror = (event) => {
      setIsListening(false)
      if (event.error !== 'no-speech') onError?.(event.error)
    }

    recognitionRef.current = recognition
    recognition.start()
  }, [onResult, onError])

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop()
  }, [])

  return { isListening, transcript, startListening, stopListening }
}

// Text-to-speech per leggere le risposte
export function speak(text) {
  if (!window.speechSynthesis) return
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'it-IT'
  utterance.rate = 1.05
  utterance.pitch = 1
  const voices = window.speechSynthesis.getVoices()
  const itVoice = voices.find(v => v.lang.startsWith('it'))
  if (itVoice) utterance.voice = itVoice
  window.speechSynthesis.speak(utterance)
}
