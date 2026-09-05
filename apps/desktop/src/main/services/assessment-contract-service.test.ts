import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { AssessmentContractContent } from '@devreplay/domain'
import { openAppDatabase } from '../database'
import { CapabilityCatalogService } from './capability-catalog-service'
import { AssessmentContractService } from './assessment-contract-service'

const directories: string[] = []
afterEach(() => directories.splice(0).forEach((path) => rmSync(path, { recursive: true })))

const content: AssessmentContractContent = {
  type: 'explanation',
  objective: '解释事件循环',
  requiredPoints: ['调用栈', '微任务'],
  allowedVariants: [],
  commonMisconceptions: ['Promise 回调同步执行'],
  passRule: '覆盖全部必备点',
  maxFollowUps: 2
}

describe('验收契约持久化', () => {
  it('契约保存前不能作答，修订创建新版本且不覆盖原版本', () => {
    const directory = mkdtempSync(join(tmpdir(), 'devreplay-contract-'))
    directories.push(directory)
    const database = openAppDatabase(join(directory, 'devreplay.sqlite'))
    let sequence = 0
    const service = new AssessmentContractService(
      database,
      () => '2026-09-04T00:00:00.000Z',
      () => `contract-${++sequence}`
    )

    try {
      new CapabilityCatalogService(database).ensureInitialSkeleton()
      database.sqlite
        .prepare(
          `INSERT INTO training_tasks
           (id, capability_id, type, status, priority_json, created_at, updated_at)
           VALUES ('task-1', 'frontend-javascript', 'explanation', 'active', '{}', ?, ?)`
        )
        .run('2026-09-04T00:00:00.000Z', '2026-09-04T00:00:00.000Z')

      expect(() => service.getForAnswering('task-1')).toThrow('不能开始作答')
      const first = service.persistInitial('task-1', content)
      database.sqlite
        .prepare(
          `INSERT INTO training_attempts
           (id, training_task_id, assessment_contract_id, answer, result_json, created_at)
           VALUES ('attempt-1', 'task-1', ?, '回答', '{}', ?)`
        )
        .run(first.id, '2026-09-04T00:01:00.000Z')
      const second = service.revise('task-1', { ...content, passRule: '覆盖必备点并给出例子' })

      expect(second.version).toBe(2)
      expect(service.listVersions('task-1').map((item) => item.content.passRule)).toEqual([
        '覆盖全部必备点',
        '覆盖必备点并给出例子'
      ])
      expect(
        database.sqlite.prepare('SELECT assessment_contract_id FROM training_attempts').get()
      ).toEqual({ assessment_contract_id: first.id })
    } finally {
      database.close()
    }
  })
})
