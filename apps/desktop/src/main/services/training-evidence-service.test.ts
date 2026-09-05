import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { openAppDatabase } from '../database'
import { CapabilityCatalogService } from './capability-catalog-service'
import { TrainingEvidenceService } from './training-evidence-service'

const directories: string[] = []
afterEach(() => directories.splice(0).forEach((path) => rmSync(path, { recursive: true })))

describe('训练证据与复测计划', () => {
  it('首次通过至多基本可靠，安排复测；复测通过后才稳定', () => {
    const directory = mkdtempSync(join(tmpdir(), 'devreplay-evidence-training-'))
    directories.push(directory)
    const database = openAppDatabase(join(directory, 'devreplay.sqlite'))
    let sequence = 0
    const now = (): string => '2026-09-04T00:00:00.000Z'
    try {
      new CapabilityCatalogService(database).ensureInitialSkeleton()
      database.sqlite
        .prepare(
          `INSERT INTO training_tasks
           (id, capability_id, type, status, priority_json, created_at, updated_at)
           VALUES ('task-1', 'frontend-javascript', 'explanation', 'active', '{}', ?, ?)`
        )
        .run(now(), now())
      const service = new TrainingEvidenceService(database, now, () => `evidence-${++sequence}`)

      expect(
        service.record({
          trainingTaskId: 'task-1',
          sourceId: 'attempt-1',
          kind: 'initial_training',
          passed: true,
          retestAfterDays: 7
        }).state
      ).toBe('basic')
      expect(
        database.sqlite.prepare('SELECT due_date, status FROM review_schedules').get()
      ).toEqual({
        due_date: '2026-09-11',
        status: 'scheduled'
      })
      expect(
        service.record({
          trainingTaskId: 'task-1',
          sourceId: 'retest-1',
          kind: 'spaced_retest',
          passed: true
        }).state
      ).toBe('stable')
      expect(database.sqlite.prepare('SELECT status FROM review_schedules').get()).toEqual({
        status: 'completed'
      })
    } finally {
      database.close()
    }
  })
})
