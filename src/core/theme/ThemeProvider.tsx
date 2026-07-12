/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"

export type Theme = "dark" | "light" | "system"

interface ThemeContextValue {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const STORAGE_KEY = "speech-up:theme"
const COLOR_SCHEME_QUERY = "(prefers-color-scheme: dark)"

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

const isTheme = (v: string | null): v is Theme =>
  v === "dark" || v === "light" || v === "system"

function resolve(theme: Theme): "dark" | "light" {
  if (theme !== "system") return theme
  return window.matchMedia(COLOR_SCHEME_QUERY).matches ? "dark" : "light"
}

// Swapping the palette mid-session must not animate every themed property
function withTransitionsDisabled(apply: () => void) {
  const style = document.createElement("style")
  style.textContent = "*,*::before,*::after{transition:none!important}"
  document.head.appendChild(style)
  apply()
  window.getComputedStyle(document.body)
  requestAnimationFrame(() => requestAnimationFrame(() => style.remove()))
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    return isTheme(stored) ? stored : "system"
  })

  const setTheme = useCallback((next: Theme) => {
    localStorage.setItem(STORAGE_KEY, next)
    setThemeState(next)
  }, [])

  useEffect(() => {
    const apply = () =>
      withTransitionsDisabled(() =>
        document.documentElement.classList.toggle(
          "dark",
          resolve(theme) === "dark"
        )
      )
    apply()
    if (theme !== "system") return
    const mq = window.matchMedia(COLOR_SCHEME_QUERY)
    mq.addEventListener("change", apply)
    return () => mq.removeEventListener("change", apply)
  }, [theme])

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)
  if (!context) throw new Error("useTheme must be used within a ThemeProvider")
  return context
}
