import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { AssessmentContractContent } from '@devreplay/domain'
import { openAppDatabase } from '../database'
import { CapabilityCatalogService } from './capability-catalog-service'
import { AssessmentContractService } from './assessment-contract-service'
import { TrainingAttemptService } from './training-attempt-service'

const directories: string[] = []
afterEach(() => directories.splice(0).forEach((path) => rmSync(path, { recursive: true })))

describe('训练评分复核', () => {
  it('同时保留原评分、一次复核结果和双方理由', () => {
    const directory = mkdtempSync(join(tmpdir(), 'devreplay-attempt-'))
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
      const contract = new AssessmentContractService(
        database,
        now,
        () => 'contract-1'
      ).persistInitial('task-1', {
        type: 'explanation',
        objective: '解释事件循环',
        requiredPoints: ['微任务'],
        allowedVariants: [],
        commonMisconceptions: [],
        passRule: '覆盖必备点',
        maxFollowUps: 2
      } satisfies AssessmentContractContent)
      const service = new TrainingAttemptService(database, now, () => `attempt-${++sequence}`)
      const attempt = service.record('task-1', contract.id, 'Promise 回调进入微任务队列', {
        passed: false,
        evidence: ['未识别等价表述'],
        reason: '未覆盖微任务'
      })
      const reviewed = service.review(attempt.id, '回答中已经描述了微任务', {
        passed: true,
        evidence: ['“进入微任务队列”是等价表述'],
        reason: '复核后满足冻结契约'
      })

      expect(reviewed.initial).toMatchObject({ passed: false, reason: '未覆盖微任务' })
      expect(reviewed.review).toMatchObject({
        requestedReason: '回答中已经描述了微任务',
        result: { passed: true, reason: '复核后满足冻结契约' }
      })
      expect(() => service.review(attempt.id, '再次复核', reviewed.initial)).toThrow('只能复核一次')
    } finally {
      database.close()
    }
  })
})
