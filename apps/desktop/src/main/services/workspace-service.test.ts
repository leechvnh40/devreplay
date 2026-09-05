import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { calculateTrainingPriority } from '@devreplay/domain'
import { openAppDatabase } from '../database'
import { CapabilityCatalogService } from './capability-catalog-service'
import { WorkspaceService } from './workspace-service'

const directories: string[] = []
afterEach(() => directories.splice(0).forEach((path) => rmSync(path, { recursive: true })))

describe('WorkspaceService', () => {
  it('今日页只返回一个行动，并让到期复测优先于普通训练', () => {
    const directory = mkdtempSync(join(tmpdir(), 'devreplay-workspace-'))
    directories.push(directory)
    const database = openAppDatabase(join(directory, 'app.sqlite'))
    try {
      new CapabilityCatalogService(database).ensureInitialSkeleton()
      const priority = calculateTrainingPriority({
        targetRelevance: 100,
        evidenceStrength: 3,
        recurrenceCount: 2,
        impact: 3,
        daysSinceVerified: 30,
        estimatedMinutes: 20
      })
      database.sqlite
        .prepare(
          `INSERT INTO training_tasks
         (id, capability_id, type, status, priority_json, created_at, updated_at)
         VALUES (?, ?, 'code', 'active', ?, ?, ?)`
        )
        .run(
          'task-1',
          'frontend-javascript',
          JSON.stringify({ role: 'main', priority }),
          '2026-09-01',
          '2026-09-01'
        )
      database.sqlite
        .prepare(
          `INSERT INTO review_schedules (id, training_task_id, due_date, status, created_at)
         VALUES ('schedule-1', 'task-1', '2026-09-03T00:00:00.000Z', 'scheduled', '2026-09-01')`
        )
        .run()

      const action = new WorkspaceService(database, () => '2026-09-04T00:00:00.000Z').getToday()
      expect(action).toMatchObject({ kind: 'review', trainingTaskId: 'task-1' })
      expect(action.factors[0]).toMatchObject({ label: '目标岗位相关度' })
    } finally {
      database.close()
    }
  })
})
