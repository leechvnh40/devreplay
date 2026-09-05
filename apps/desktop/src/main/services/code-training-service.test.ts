import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { AssessmentContractContent } from '@devreplay/domain'
import { openAppDatabase } from '../database'
import { CapabilityCatalogService } from './capability-catalog-service'
import { AssessmentContractService } from './assessment-contract-service'
import { CodeTrainingService } from './code-training-service'

const directories: string[] = []
afterEach(() => directories.splice(0).forEach((path) => rmSync(path, { recursive: true })))

describe('代码训练纵向流程', () => {
  it('公开测试可见、隐藏源码不出 DTO，隐藏失败不能被模型评价推翻', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'devreplay-code-training-'))
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
           VALUES ('task-1', 'frontend-javascript', 'code', 'active', ?, ?, ?)`
        )
        .run(
          JSON.stringify({
            title: '加倍',
            prompt: '实现 double',
            starterCode: 'function double(x) {}'
          }),
          now(),
          now()
        )
      const hiddenName = '零值边界内部测试'
      new AssessmentContractService(database, now, () => 'contract-1').persistInitial('task-1', {
        type: 'code',
        objective: '实现加倍',
        functionName: 'double',
        language: 'javascript',
        publicTests: [{ name: '正数', args: [2], expected: 4 }],
        hiddenTests: [{ name: hiddenName, args: [0], expected: 0 }],
        passRule: 'all_tests'
      } satisfies AssessmentContractContent)
      const service = new CodeTrainingService(database, now, () => `attempt-${++sequence}`)

      expect(JSON.stringify(service.getTask('task-1'))).not.toContain(hiddenName)
      const result = await service.submit(
        'task-1',
        'function double(value) { return value === 0 ? 1 : value * 2 }',
        '实现思路很好，建议通过'
      )
      expect(result.passed).toBe(false)
      expect(result.testResult.hiddenResults).toEqual([
        { passed: false, category: 'assertion_failed' }
      ])
      const stored = database.sqlite
        .prepare('SELECT result_json FROM training_attempts WHERE id = ?')
        .get(result.attemptId) as { result_json: string }
      expect(JSON.parse(stored.result_json).initial).toMatchObject({
        passed: false,
        reason: '至少一个必需测试失败'
      })
    } finally {
      database.close()
    }
  })
})
