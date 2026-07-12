import { X } from "lucide-react"
import type { TtsPlayer } from "@/core/audio"
import {
  MAX_SILENCE_MS,
  MIN_SILENCE_MS,
  VOICE_GROUPS,
  VOICE_PREVIEW_TEXT,
  formatVoiceName,
  type Settings,
} from "@/core/settings"
import { useTheme, type Theme } from "@/core/theme"
import { cn } from "@/shared/lib/utils"

interface SettingsPanelProps {
  settings: Settings
  player: TtsPlayer
  onClose: () => void
}

const THEMES: Theme[] = ["system", "light", "dark"]

export function SettingsPanel({
  settings,
  player,
  onClose,
}: SettingsPanelProps) {
  const { theme, setTheme } = useTheme()

  const handleVoiceClick = (v: string) => {
    settings.setVoice(v)
    void player.play(VOICE_PREVIEW_TEXT, v)
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <header className="flex shrink-0 items-center justify-between border-b border-border/60 bg-background/80 px-4 py-3 backdrop-blur-md">
        <h2 className="font-semibold">Settings</h2>
        <button
          onClick={onClose}
          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Close settings"
        >
          <X className="size-4" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-xl space-y-4">
          <section className="space-y-3 rounded-2xl bg-card p-4 shadow-xs ring-1 ring-border">
            <h3 className="text-sm font-medium">Theme</h3>
            <div className="flex gap-2">
              {THEMES.map((t) => (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  className={cn(
                    "flex-1 rounded-lg border px-3 py-2 text-xs font-medium capitalize transition-colors",
                    theme === t
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-3 rounded-2xl bg-card p-4 shadow-xs ring-1 ring-border">
            <div className="flex items-baseline justify-between">
              <h3 className="text-sm font-medium">Pause before sending</h3>
              <span className="text-xs font-semibold text-primary tabular-nums">
                {settings.silenceMs / 1000} s
              </span>
            </div>
            <input
              type="range"
              min={MIN_SILENCE_MS}
              max={MAX_SILENCE_MS}
              step={250}
              value={settings.silenceMs}
              onChange={(e) => settings.setSilenceMs(Number(e.target.value))}
              className="w-full accent-primary"
              aria-label="Pause before sending, seconds"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>1 s — fast turns</span>
              <span>5 s — long pauses</span>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              How long Speech Up waits in silence before deciding you finished
              your thought (Auto mode). Take your time — it will never cut you
              off.
            </p>
          </section>

          <section className="flex items-center justify-between gap-4 rounded-2xl bg-card p-4 shadow-xs ring-1 ring-border">
            <div>
              <h3 className="text-sm font-medium">Speak replies aloud</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Turn off to read replies as text only — the fastest way to keep
                the conversation flowing. Suggestion chips still play when
                tapped.
              </p>
            </div>
            <button
              role="switch"
              aria-checked={settings.voiceEnabled}
              aria-label="Speak replies aloud"
              onClick={() => {
                settings.setVoiceEnabled(!settings.voiceEnabled)
                if (settings.voiceEnabled) player.stop()
              }}
              className={cn(
                "relative h-6 w-10 shrink-0 rounded-full transition-colors",
                "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                settings.voiceEnabled ? "bg-primary" : "bg-muted-foreground/30"
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow-sm transition-transform",
                  settings.voiceEnabled && "translate-x-4"
                )}
              />
            </button>
          </section>

          <section className="space-y-4 rounded-2xl bg-card p-4 shadow-xs ring-1 ring-border">
            <div>
              <h3 className="text-sm font-medium">AI Voice</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Click any voice to select and preview it.
              </p>
            </div>

            {VOICE_GROUPS.map((group) => (
              <div key={group.label} className="space-y-1.5">
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {group.label}
                </p>
                <div className="grid grid-cols-3 gap-1.5">
                  {group.voices.map((v) => (
                    <button
                      key={v}
                      onClick={() => handleVoiceClick(v)}
                      className={cn(
                        "rounded-lg border px-3 py-2 text-left text-xs font-medium transition-colors",
                        settings.voice === v
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground",
                        player.isPlaying && settings.voice === v && "opacity-60"
                      )}
                    >
                      {formatVoiceName(v)}
                      {player.isPlaying && settings.voice === v && " ♪"}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </section>
        </div>
      </div>
    </div>
  )
}
