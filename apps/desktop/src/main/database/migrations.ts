import type Database from 'better-sqlite3'
import versionOneSql from './migrations/0000_v1.sql?raw'

export interface DatabaseMigration {
  readonly version: number
  readonly name: string
  readonly sql: string
}

export const DATABASE_MIGRATIONS: readonly DatabaseMigration[] = Object.freeze([
  Object.freeze({ version: 1, name: 'initial_schema', sql: versionOneSql })
])

const MIGRATION_BREAKPOINT = '--> statement-breakpoint'

function ensureMigrationJournal(sqlite: Database.Database): void {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    )
  `)
}

export function applyMigrations(
  sqlite: Database.Database,
  migrations: readonly DatabaseMigration[] = DATABASE_MIGRATIONS,
  now: () => string = () => new Date().toISOString()
): void {
  ensureMigrationJournal(sqlite)

  const applied = new Set(
    sqlite
      .prepare('SELECT version FROM schema_migrations ORDER BY version')
      .all()
      .map((row) => (row as { version: number }).version)
  )

  for (const migration of [...migrations].sort((left, right) => left.version - right.version)) {
    if (applied.has(migration.version)) continue

    sqlite.transaction(() => {
      for (const statement of migration.sql.split(MIGRATION_BREAKPOINT)) {
        const sql = statement.trim()
        if (sql) sqlite.exec(sql)
      }

      sqlite
        .prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)')
        .run(migration.version, migration.name, now())
    })()
  }
}
