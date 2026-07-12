import { useCallback, useEffect, useRef, useState } from "react"
import { synthesizeSpeech } from "@/core/api"
import { splitSentences } from "./helpers/splitSentences"

export interface TtsPlayer {
  isPlaying: boolean
  play: (text: string, voice: string) => Promise<void>
  stop: () => void
}

export function useTtsPlayer(): TtsPlayer {
  const [isPlaying, setIsPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  // Bumping the generation counter invalidates any in-flight playback queue
  const seqRef = useRef(0)

  const stop = useCallback(() => {
    seqRef.current++
    audioRef.current?.pause()
    audioRef.current = null
    setIsPlaying(false)
  }, [])

  const playBlob = (blob: Blob) =>
    new Promise<void>((resolve) => {
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audioRef.current = audio
      const finish = () => {
        URL.revokeObjectURL(url)
        resolve()
      }
      audio.onended = finish
      audio.onerror = finish
      audio.play().catch(finish)
    })

  // Plays sentence-by-sentence, synthesizing the next one while the current
  // plays, so audio starts as soon as the first sentence is ready.
  const play = useCallback(
    async (text: string, voice: string) => {
      stop()
      const gen = ++seqRef.current
      const sentences = splitSentences(text)

      setIsPlaying(true)
      try {
        let next = synthesizeSpeech(sentences[0], voice)
        for (let i = 0; i < sentences.length; i++) {
          const blob = await next
          if (seqRef.current !== gen) return
          if (i + 1 < sentences.length)
            next = synthesizeSpeech(sentences[i + 1], voice)
          await playBlob(blob)
          if (seqRef.current !== gen) return
        }
      } catch {
        // playback is best-effort; text is already on screen
      } finally {
        if (seqRef.current === gen) {
          audioRef.current = null
          setIsPlaying(false)
        }
      }
    },
    [stop]
  )

  useEffect(() => stop, [stop])

  return { isPlaying, play, stop }
}
