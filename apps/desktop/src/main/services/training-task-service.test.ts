import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { calculateTrainingPriority, type TrainingCandidate } from '@devreplay/domain'
import { openAppDatabase } from '../database'
import { CapabilityCatalogService } from './capability-catalog-service'
import { TrainingTaskService } from './training-task-service'

const directories: string[] = []
afterEach(() => directories.splice(0).forEach((path) => rmSync(path, { recursive: true })))

describe('训练任务事务限制', () => {
  it('并发请求也不会创建第四个活跃任务', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'devreplay-training-task-'))
    directories.push(directory)
    const database = openAppDatabase(join(directory, 'devreplay.sqlite'))
    let sequence = 0
    const service = new TrainingTaskService(
      database,
      () => '2026-09-04T00:00:00.000Z',
      () => `task-${++sequence}`
    )

    try {
      new CapabilityCatalogService(database).ensureInitialSkeleton()
      const makeCandidate = (): TrainingCandidate => ({
        capabilityId: 'frontend-javascript',
        type: 'explanation' as const,
        priority: calculateTrainingPriority({
          targetRelevance: 100,
          evidenceStrength: 3,
          recurrenceCount: 2,
          impact: 2,
          daysSinceVerified: 30,
          estimatedMinutes: 20
        })
      })
      await Promise.all(
        Array.from({ length: 4 }, async () => service.createFromReview([makeCandidate()]))
      )
      expect(service.activeCount()).toBe(3)
      expect(
        database.sqlite
          .prepare("SELECT count(*) AS count FROM training_tasks WHERE status = 'queued'")
          .get()
      ).toEqual({ count: 1 })
    } finally {
      database.close()
    }
  })
})
