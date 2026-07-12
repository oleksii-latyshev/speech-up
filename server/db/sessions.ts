import { and, count, desc, eq, isNotNull, isNull } from "drizzle-orm"
import type {
  Difficulty,
  ReviewData,
  ScenarioId,
  SessionSummary,
  Turn,
} from "../../src/core/session/contract"
import type { ProgressRows } from "../helpers/progress"
import { db } from "./index"
import { corrections, reviews, sessions, turns, vocabulary } from "./schema"

export async function createSession(
  scenario: ScenarioId,
  difficulty: Difficulty
): Promise<number> {
  const [row] = await db
    .insert(sessions)
    .values({ scenario, difficulty, startedAt: Date.now() })
    .returning({ id: sessions.id })
  return row.id
}

export async function addTurn(sessionId: number, turn: Turn): Promise<void> {
  await db.insert(turns).values({ sessionId, ...turn, createdAt: Date.now() })
}

export async function endSession(sessionId: number): Promise<void> {
  await db
    .update(sessions)
    .set({ endedAt: Date.now() })
    .where(and(eq(sessions.id, sessionId), isNull(sessions.endedAt)))
}

export async function saveReview(
  sessionId: number,
  review: ReviewData
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(reviews).where(eq(reviews.sessionId, sessionId))
    await tx.delete(corrections).where(eq(corrections.sessionId, sessionId))
    await tx.delete(vocabulary).where(eq(vocabulary.sessionId, sessionId))
    await tx.insert(reviews).values({
      sessionId,
      overview: review.overview,
      praise: review.praise,
      createdAt: Date.now(),
    })
    if (review.corrections.length) {
      await tx
        .insert(corrections)
        .values(review.corrections.map((c) => ({ sessionId, ...c })))
    }
    if (review.vocabulary.length) {
      await tx
        .insert(vocabulary)
        .values(review.vocabulary.map((phrase) => ({ sessionId, phrase })))
    }
  })
  await endSession(sessionId)
}

export async function loadProgressRows(): Promise<ProgressRows> {
  const [sessionRows, turnRows, tagRows] = await Promise.all([
    db
      .select({
        id: sessions.id,
        startedAt: sessions.startedAt,
        endedAt: sessions.endedAt,
      })
      .from(sessions),
    db
      .select({
        sessionId: turns.sessionId,
        transcript: turns.transcript,
        createdAt: turns.createdAt,
      })
      .from(turns),
    db
      .select({ tag: corrections.tag })
      .from(corrections)
      .where(isNotNull(corrections.tag)),
  ])
  return {
    sessions: sessionRows,
    turns: turnRows,
    tags: tagRows.flatMap((r) => (r.tag ? [r.tag] : [])),
  }
}

export async function listSessions(): Promise<SessionSummary[]> {
  return db
    .select({
      id: sessions.id,
      scenario: sessions.scenario,
      difficulty: sessions.difficulty,
      startedAt: sessions.startedAt,
      endedAt: sessions.endedAt,
      turnCount: count(turns.id),
    })
    .from(sessions)
    .leftJoin(turns, eq(turns.sessionId, sessions.id))
    .groupBy(sessions.id)
    .orderBy(desc(sessions.startedAt))
}
