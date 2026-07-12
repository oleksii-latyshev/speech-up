import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core"
import type {
  Difficulty,
  ErrorTag,
  ScenarioId,
} from "../../src/core/session/contract"

export const sessions = sqliteTable("sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  scenario: text("scenario").$type<ScenarioId>().notNull(),
  difficulty: text("difficulty").$type<Difficulty>().notNull(),
  startedAt: integer("started_at").notNull(),
  endedAt: integer("ended_at"),
})

export const turns = sqliteTable("turns", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionId: integer("session_id")
    .notNull()
    .references(() => sessions.id, { onDelete: "cascade" }),
  transcript: text("transcript").notNull(),
  response: text("response").notNull(),
  coaching: text("coaching").notNull(),
  createdAt: integer("created_at").notNull(),
})

export const reviews = sqliteTable("reviews", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionId: integer("session_id")
    .notNull()
    .unique()
    .references(() => sessions.id, { onDelete: "cascade" }),
  overview: text("overview").notNull(),
  praise: text("praise").notNull(),
  createdAt: integer("created_at").notNull(),
})

export const corrections = sqliteTable("corrections", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionId: integer("session_id")
    .notNull()
    .references(() => sessions.id, { onDelete: "cascade" }),
  you: text("you").notNull(),
  better: text("better").notNull(),
  tag: text("tag").$type<ErrorTag>(),
})

export const vocabulary = sqliteTable("vocabulary", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionId: integer("session_id")
    .notNull()
    .references(() => sessions.id, { onDelete: "cascade" }),
  phrase: text("phrase").notNull(),
})
