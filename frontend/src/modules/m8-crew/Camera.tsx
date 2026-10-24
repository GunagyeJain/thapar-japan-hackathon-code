// QR camera (qr-scanner, loaded on demand). The payload is the bare item id; the manual code always works too.
import { Camera as CameraIcon, CameraOff } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { Button } from "@/ui"
import { COPY } from "@/modules/m8-crew/i18n"

interface CameraProps {
  onCode: (code: string) => void
}

const SAME_CODE_COOLDOWN_MS = 2500

export function Camera({ onCode }: CameraProps) {
  const video = useRef<HTMLVideoElement>(null)
  const [on, setOn] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const last = useRef<{ code: string; at: number } | null>(null)
  const handler = useRef(onCode)
  handler.current = onCode

  useEffect(() => {
    if (!on || !video.current) return
    let scanner: { start: () => Promise<void>; stop: () => void; destroy: () => void } | null = null
    let cancelled = false
    void import("qr-scanner").then(async ({ default: QrScanner }) => {
      if (cancelled || !video.current) return
      scanner = new QrScanner(
        video.current,
        (result) => {
          const now = Date.now()
          if (last.current && last.current.code === result.data && now - last.current.at < SAME_CODE_COOLDOWN_MS) return
          last.current = { code: result.data, at: now }
          handler.current(result.data)
        },
        { returnDetailedScanResult: true, highlightScanRegion: true, preferredCamera: "environment" },
      )
      try {
        await scanner.start()
        setError(null)
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : String(e))
        setOn(false)
      }
    })
    return () => {
      cancelled = true
      scanner?.stop()
      scanner?.destroy()
    }
  }, [on])

  return (
    <div className="flex flex-col gap-2">
      <Button size="lg" variant={on ? "outline" : "secondary"} className="h-12" onClick={() => setOn((v) => !v)}>
        {on ? <CameraOff /> : <CameraIcon />}
        {on ? `${COPY.stopCamera.ja} · ${COPY.stopCamera.en}` : `${COPY.camera.ja} · ${COPY.camera.en}`}
      </Button>
      {on && <video ref={video} className="aspect-video w-full max-w-md rounded-lg bg-black object-cover" muted playsInline />}
      {error && <p className="text-sm text-warn">Camera unavailable ({error}). Type the 6-character code instead.</p>}
    </div>
  )
}
