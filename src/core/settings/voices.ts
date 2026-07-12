export const VOICE_GROUPS = [
  {
    label: "American Female",
    voices: [
      "af_heart",
      "af_bella",
      "af_nova",
      "af_jessica",
      "af_sarah",
      "af_sky",
      "af_nicole",
      "af_alloy",
      "af_aoede",
      "af_jadzia",
      "af_kore",
      "af_river",
    ],
  },
  {
    label: "American Male",
    voices: [
      "am_michael",
      "am_adam",
      "am_echo",
      "am_liam",
      "am_eric",
      "am_fenrir",
      "am_onyx",
      "am_puck",
    ],
  },
  {
    label: "British Female",
    voices: ["bf_alice", "bf_emma", "bf_lily"],
  },
  {
    label: "British Male",
    voices: ["bm_george", "bm_daniel", "bm_lewis", "bm_fable"],
  },
] as const

export const DEFAULT_VOICE = "af_heart"

export const VOICE_PREVIEW_TEXT =
  "Hello! I'm your English conversation partner. Let's practice together."

export function formatVoiceName(v: string) {
  const name = v.split("_").slice(1).join("_")
  return name.charAt(0).toUpperCase() + name.slice(1)
}
