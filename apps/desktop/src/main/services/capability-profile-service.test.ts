import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { calculateTrainingPriority } from '@devreplay/domain'
import { openAppDatabase } from '../database'
import { CapabilityCatalogService } from './capability-catalog-service'
import { CapabilityProfileService } from './capability-profile-service'

const directories: string[] = []
afterEach(() => directories.splice(0).forEach((path) => rmSync(path, { recursive: true })))

describe('CapabilityProfileService', () => {
  it('切换岗位只重排训练，不修改能力事实和证据时间线', () => {
    const directory = mkdtempSync(join(tmpdir(), 'devreplay-profile-'))
    directories.push(directory)
    const database = openAppDatabase(join(directory, 'app.sqlite'))
    try {
      new CapabilityCatalogService(database).ensureInitialSkeleton()
      const now = '2026-09-04T00:00:00.000Z'
      const insertTarget = database.sqlite.prepare(
        `INSERT INTO target_profiles (id, title, direction, active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      insertTarget.run('frontend', '前端工程师', '前端', 1, now, now)
      insertTarget.run('ai', 'AI 应用工程师', 'AI', 0, now, now)
      const insertWeight = database.sqlite.prepare(
        'INSERT INTO target_capability_weights (target_profile_id, capability_id, weight, updated_at) VALUES (?, ?, ?, ?)'
      )
      insertWeight.run('frontend', 'frontend-javascript', 100, now)
      insertWeight.run('ai', 'frontend-javascript', 20, now)
      database.sqlite
        .prepare(
          `INSERT INTO evidence_entries
         (id, capability_id, source_type, polarity, strength, content_json, created_at)
         VALUES ('evidence-1', 'frontend-javascript', 'real_interview', 'negative', 2, '{"summary":"事件循环回答不完整"}', ?)`
        )
        .run(now)
      database.sqlite
        .prepare(
          `INSERT INTO capability_projection
         (capability_id, state, reason_json, rebuilt_at)
         VALUES ('frontend-javascript', 'weak', '{"reason":"存在反驳证据"}', ?)`
        )
        .run(now)
      const priorityInput = {
        targetRelevance: 100,
        evidenceStrength: 2,
        recurrenceCount: 1,
        impact: 2,
        daysSinceVerified: 30,
        estimatedMinutes: 20
      }
      database.sqlite
        .prepare(
          `INSERT INTO training_tasks
         (id, capability_id, type, status, priority_json, created_at, updated_at)
         VALUES ('task-1', 'frontend-javascript', 'explanation', 'active', ?, ?, ?)`
        )
        .run(
          JSON.stringify({
            role: 'main',
            priorityInput,
            priority: calculateTrainingPriority(priorityInput)
          }),
          now,
          now
        )

      const service = new CapabilityProfileService(database, () => now)
      const before = service
        .getProfile()
        .capabilities.find((item) => item.id === 'frontend-javascript')
      const beforeScore = JSON.parse(
        (
          database.sqlite
            .prepare('SELECT priority_json FROM training_tasks WHERE id = ?')
            .get('task-1') as { priority_json: string }
        ).priority_json
      ).priority.score
      const afterProfile = service.switchTarget('ai')
      const after = afterProfile.capabilities.find((item) => item.id === 'frontend-javascript')
      const afterScore = JSON.parse(
        (
          database.sqlite
            .prepare('SELECT priority_json FROM training_tasks WHERE id = ?')
            .get('task-1') as { priority_json: string }
        ).priority_json
      ).priority.score

      expect(after).toMatchObject({
        state: before?.state,
        reason: before?.reason,
        targetWeight: 20
      })
      expect(after?.evidence).toEqual(before?.evidence)
      expect(afterScore).toBeLessThan(beforeScore)
    } finally {
      database.close()
    }
  })
})
