// The browser's own speech recognition (Chrome, Edge, Safari). The mic is hidden where it doesn't exist.
import { useCallback, useEffect, useRef, useState } from "react"

interface SpeechResultList {
  length: number
  [index: number]: { 0: { transcript: string }; isFinal: boolean }
}

interface Recognition {
  lang: string
  interimResults: boolean
  continuous: boolean
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((event: { results: SpeechResultList }) => void) | null
  onend: (() => void) | null
  onerror: ((event: { error: string }) => void) | null
}

type RecognitionCtor = new () => Recognition

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export interface Speech {
  supported: boolean
  listening: boolean
  error: string | null
  start: (lang: string) => void
  stop: () => void
}

/** Speak into the text box: `onText` gets the transcript so far, interim results included. */
export function useSpeech(onText: (text: string) => void): Speech {
  const [Ctor] = useState(recognitionCtor)
  const [listening, setListening] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const current = useRef<Recognition | null>(null)
  const latest = useRef(onText)

  useEffect(() => {
    latest.current = onText
  }, [onText])

  useEffect(() => () => current.current?.abort(), [])

  const start = useCallback(
    (lang: string) => {
      if (!Ctor || current.current) return
      const rec = new Ctor()
      rec.lang = lang
      rec.interimResults = true
      rec.continuous = false
      rec.onresult = (event) => {
        let text = ""
        for (let i = 0; i < event.results.length; i++) text += event.results[i][0].transcript
        latest.current(text)
      }
      rec.onerror = (event) => setError(event.error)
      rec.onend = () => {
        current.current = null
        setListening(false)
      }
      current.current = rec
      setError(null)
      setListening(true)
      try {
        rec.start()
      } catch (err: unknown) {
        current.current = null
        setListening(false)
        setError(err instanceof Error ? err.message : "not-allowed")
      }
    },
    [Ctor],
  )

  const stop = useCallback(() => current.current?.stop(), [])

  return { supported: Ctor !== null, listening, error, start, stop }
}
