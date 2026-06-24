import { useState, useRef, useEffect, useCallback } from "react"

export type CaptureStatus = "idle" | "listening" | "speaking" | "processing"

interface UseVoiceCaptureOptions {
  onAudioReady: (blob: Blob) => Promise<void>
  // RMS amplitude below this value counts as silence (0–1). Tune per environment.
  silenceThreshold?: number
  // Milliseconds of continuous silence after speech before auto-stop fires.
  silenceDuration?: number
}

export function useVoiceCapture({
  onAudioReady,
  silenceThreshold = 0.015,
  silenceDuration = 2500,
}: UseVoiceCaptureOptions) {
  const [status, setStatus] = useState<CaptureStatus>("idle")

  const streamRef   = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef   = useRef<Blob[]>([])
  const audioCtxRef = useRef<AudioContext | null>(null)
  const rafRef      = useRef<number | null>(null)

  // Called by recorder.onstop in both modes
  const finalise = useCallback(
    async (recorder: MediaRecorder) => {
      const blob = new Blob(chunksRef.current, {
        type: recorder.mimeType || "audio/webm",
      })
      chunksRef.current = []
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
      setStatus("processing")
      await onAudioReady(blob)
      setStatus("idle")
    },
    [onAudioReady],
  )

  const getStream = () =>
    navigator.mediaDevices.getUserMedia({ audio: true, video: false })

  const makeRecorder = (stream: MediaStream) => {
    const recorder = new MediaRecorder(stream)
    chunksRef.current = []
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }
    recorder.onstop = () => void finalise(recorder)
    streamRef.current = stream
    recorderRef.current = recorder
    return recorder
  }

  // ── Auto mode ──────────────────────────────────────────────────────────────

  const startAuto = useCallback(async () => {
    if (status !== "idle") return
    try {
      const stream = await getStream()
      const recorder = makeRecorder(stream)

      // Amplitude analyser — runs in an rAF loop on the main thread
      const ctx = new AudioContext()
      audioCtxRef.current = ctx
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 512
      ctx.createMediaStreamSource(stream).connect(analyser)

      recorder.start()
      setStatus("listening")

      const buf = new Float32Array(analyser.fftSize)
      let speechStarted = false
      let silenceAt: number | null = null

      const tick = () => {
        analyser.getFloatTimeDomainData(buf)
        const rms = Math.sqrt(buf.reduce((s, x) => s + x * x, 0) / buf.length)

        if (rms > silenceThreshold) {
          silenceAt = null
          if (!speechStarted) {
            speechStarted = true
            setStatus("speaking")
          }
        } else if (speechStarted) {
          silenceAt ??= Date.now()
          if (Date.now() - silenceAt >= silenceDuration) {
            ctx.close()
            recorder.stop()
            return
          }
        }

        rafRef.current = requestAnimationFrame(tick)
      }
      rafRef.current = requestAnimationFrame(tick)
    } catch {
      setStatus("idle")
    }
  }, [status, finalise, silenceThreshold, silenceDuration])

  const stopAuto = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    audioCtxRef.current?.close()
    audioCtxRef.current = null
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop() // triggers onstop → finalise
    } else {
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
      setStatus("idle")
    }
  }, [])

  // ── Push-to-talk ───────────────────────────────────────────────────────────

  const pttStart = useCallback(async () => {
    if (status !== "idle") return
    try {
      const stream = await getStream()
      const recorder = makeRecorder(stream)
      recorder.start()
      setStatus("speaking")
    } catch {
      setStatus("idle")
    }
  }, [status, finalise])

  const pttStop = useCallback(() => {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop()
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
      audioCtxRef.current?.close()
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  return { status, startAuto, stopAuto, pttStart, pttStop }
}
