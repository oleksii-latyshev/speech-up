import {
  Briefcase,
  Coffee,
  MessagesSquare,
  Users,
  type LucideIcon,
} from "lucide-react"
import type { Difficulty, ScenarioId } from "./contract"

export const DIFFICULTIES: {
  id: Difficulty
  label: string
  description: string
}[] = [
  {
    id: "easy",
    label: "Easy",
    description:
      "Suggested replies appear every turn — read one aloud to get going.",
  },
  {
    id: "medium",
    label: "Medium",
    description:
      "No automatic help, but you can ask for a hint when you're stuck.",
  },
  {
    id: "hard",
    label: "Hard",
    description:
      "No hints, natural speech with idioms — just like a real conversation.",
  },
]

export interface InterviewRole {
  id: ScenarioId
  label: string
}

export interface ScenarioCard {
  id: ScenarioId | "interview"
  title: string
  description: string
  icon: LucideIcon
  iconTile: string
  roles?: InterviewRole[]
}

export const SCENARIOS: ScenarioCard[] = [
  {
    id: "interview",
    title: "Job Interview",
    description:
      "A realistic interview — one question at a time, with follow-ups. Pick your track:",
    icon: Briefcase,
    iconTile: "bg-violet-500/12 text-violet-600 dark:text-violet-400",
    roles: [
      { id: "interview-frontend", label: "Frontend" },
      { id: "interview-backend", label: "Backend" },
      { id: "interview-fullstack", label: "Fullstack" },
      { id: "interview-general", label: "General / HR" },
    ],
  },
  {
    id: "standup",
    title: "Daily Standup",
    description:
      "Yesterday, today, blockers — report to a teammate who asks real follow-ups.",
    icon: Users,
    iconTile: "bg-sky-500/12 text-sky-600 dark:text-sky-400",
  },
  {
    id: "tech-discussion",
    title: "Technical Discussion",
    description:
      "Debate architecture, tools and trade-offs with a peer who challenges your reasoning.",
    icon: MessagesSquare,
    iconTile: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
  },
  {
    id: "casual",
    title: "Casual Conversation",
    description:
      "Relaxed small talk — weekends, travel, movies, life. No pressure, just flow.",
    icon: Coffee,
    iconTile: "bg-amber-500/12 text-amber-600 dark:text-amber-400",
  },
]

export const scenarioCardFor = (id: ScenarioId): ScenarioCard =>
  SCENARIOS.find((s) => s.id === id || s.roles?.some((r) => r.id === id)) ??
  SCENARIOS[0]

const SCENARIO_TITLES: Record<ScenarioId, string> = {
  "interview-frontend": "Interview · Frontend",
  "interview-backend": "Interview · Backend",
  "interview-fullstack": "Interview · Fullstack",
  "interview-general": "Interview · General",
  standup: "Daily Standup",
  "tech-discussion": "Tech Discussion",
  casual: "Casual Chat",
}

export const scenarioTitle = (id: ScenarioId) => SCENARIO_TITLES[id]
