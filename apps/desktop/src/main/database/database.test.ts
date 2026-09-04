import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { afterEach, describe, expect, it } from 'vitest'
import { applyMigrations, openAppDatabase, runInTransaction, type DatabaseMigration } from './index'

const temporaryDirectories: string[] = []

function temporaryDatabasePath(): string {
  const directory = mkdtempSync(join(tmpdir(), 'devreplay-db-'))
  temporaryDirectories.push(directory)
  return join(directory, 'devreplay.sqlite')
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe('SQLite schema version 1', () => {
  it('initializes all tables with foreign keys and WAL enabled', () => {
    const database = openAppDatabase(temporaryDatabasePath())

    try {
      const tables = database.sqlite
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
        .all()
        .map((row) => (row as { name: string }).name)

      expect(tables).toContain('interviews')
      expect(tables).toContain('evidence_entries')
      expect(tables).toContain('model_runs')
      expect(database.sqlite.pragma('foreign_keys', { simple: true })).toBe(1)
      expect(database.sqlite.pragma('journal_mode', { simple: true })).toBe('wal')
      expect(() =>
        database.sqlite
          .prepare(
            `INSERT INTO interviews
             (id, company, role, occurred_at, round, resume_snapshot_id, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .run('i-1', '公司', '岗位', 'now', '一面', 'missing', 'now', 'now')
      ).toThrow()
    } finally {
      database.close()
    }
  })

  it('rolls back aggregate writes and applies migrations only once', () => {
    const database = openAppDatabase(temporaryDatabasePath())

    try {
      expect(() =>
        runInTransaction(database.sqlite, () => {
          database.sqlite
            .prepare(
              'INSERT INTO resume_snapshots (id, label, content, captured_at) VALUES (?, ?, ?, ?)'
            )
            .run('resume-1', '简历', '内容', 'now')
          throw new Error('abort')
        })
      ).toThrow('abort')

      expect(
        database.sqlite.prepare('SELECT count(*) AS count FROM resume_snapshots').get()
      ).toEqual({ count: 0 })

      applyMigrations(database.sqlite)
      expect(
        database.sqlite.prepare('SELECT count(*) AS count FROM schema_migrations').get()
      ).toEqual({ count: 1 })
    } finally {
      database.close()
    }
  })

  it('does not leave a partially applied failed migration', () => {
    const sqlite = new Database(temporaryDatabasePath())
    const brokenMigration: DatabaseMigration = {
      version: 1,
      name: 'broken',
      sql: 'CREATE TABLE partial_write (id TEXT);--> statement-breakpoint\nINVALID SQL'
    }

    try {
      expect(() => applyMigrations(sqlite, [brokenMigration])).toThrow()
      expect(
        sqlite
          .prepare("SELECT count(*) AS count FROM sqlite_master WHERE name = 'partial_write'")
          .get()
      ).toEqual({ count: 0 })
      expect(sqlite.prepare('SELECT count(*) AS count FROM schema_migrations').get()).toEqual({
        count: 0
      })
    } finally {
      sqlite.close()
    }
  })
})
