import { SCENARIOS, type ScenarioCard, type ScenarioId } from "@/core/session"

export const scenarioCardFor = (id: ScenarioId): ScenarioCard =>
  SCENARIOS.find((s) => s.id === id || s.roles?.some((r) => r.id === id)) ??
  SCENARIOS[0]
