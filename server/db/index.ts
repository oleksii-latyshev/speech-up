import { mkdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { Database } from "bun:sqlite"
import { drizzle } from "drizzle-orm/bun-sqlite"
import { migrate } from "drizzle-orm/bun-sqlite/migrator"
import { config } from "../config"
import * as schema from "./schema"

mkdirSync(dirname(config.db.path), { recursive: true })

const sqlite = new Database(config.db.path)
sqlite.exec("PRAGMA journal_mode = WAL;")
sqlite.exec("PRAGMA foreign_keys = ON;")

export const db = drizzle(sqlite, { schema })

export const runMigrations = () =>
  migrate(db, { migrationsFolder: join(import.meta.dir, "migrations") })

export * from "./plans"
export * from "./sessions"
