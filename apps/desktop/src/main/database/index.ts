import Database from 'better-sqlite3'
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { applyMigrations } from './migrations'
import { schema } from './schema'

export interface AppDatabase {
  readonly sqlite: Database.Database
  readonly orm: BetterSQLite3Database<typeof schema>
  close(): void
}

export function openAppDatabase(filename: string): AppDatabase {
  const sqlite = new Database(filename)

  try {
    sqlite.pragma('foreign_keys = ON')
    sqlite.pragma('journal_mode = WAL')
    applyMigrations(sqlite)
  } catch (error) {
    sqlite.close()
    throw error
  }

  return {
    sqlite,
    orm: drizzle(sqlite, { schema }),
    close: () => sqlite.close()
  }
}

export function runInTransaction<T>(sqlite: Database.Database, operation: () => T): T {
  return sqlite.transaction(operation)()
}

export { applyMigrations, type DatabaseMigration } from './migrations'
export * from './schema'
