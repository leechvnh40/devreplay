import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createCompositionRoot } from './composition-root'
import { handleIpcRequest } from './ipc'
import { AssessmentContractService } from './services/assessment-contract-service'

const directories: string[] = []
afterEach(() => directories.splice(0).forEach((path) => rmSync(path, { recursive: true })))

describe('公共 IPC 代码训练流程', () => {
  it('通过白名单协议读取、运行和提交且不暴露隐藏测试', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'devreplay-ipc-code-'))
    directories.push(directory)
    const root = createCompositionRoot(
      join(directory, 'devreplay.sqlite'),
      join(directory, 'secrets.json')
    )
    const now = '2026-09-04T00:00:00.000Z'
    try {
      root.database.sqlite
        .prepare(
          `INSERT INTO training_tasks
           (id, capability_id, type, status, priority_json, created_at, updated_at)
           VALUES ('task-ipc', 'frontend-javascript', 'code', 'active', ?, ?, ?)`
        )
        .run(
          JSON.stringify({
            title: '加倍',
            prompt: '实现 double',
            starterCode: 'function double(x) {}'
          }),
          now,
          now
        )
      new AssessmentContractService(
        root.database,
        () => now,
        () => 'contract-ipc'
      ).persistInitial('task-ipc', {
        type: 'code',
        objective: '实现加倍',
        functionName: 'double',
        language: 'javascript',
        publicTests: [{ name: '正数示例', args: [2], expected: 4 }],
        hiddenTests: [{ name: '隐藏零值源码', args: [0], expected: 0 }],
        passRule: 'all_tests'
      })

      const task = await handleIpcRequest(root, {
        channel: 'training.get-code-task',
        payload: { trainingTaskId: 'task-ipc' }
      })
      expect(task.ok).toBe(true)
      expect(JSON.stringify(task)).not.toContain('隐藏零值源码')

      const submitted = await handleIpcRequest(root, {
        channel: 'training.submit-code',
        payload: {
          trainingTaskId: 'task-ipc',
          source: 'function double(value) { return value * 2 }'
        }
      })
      expect(submitted).toMatchObject({ ok: true, data: { passed: true } })
      expect(
        root.database.sqlite.prepare('SELECT count(*) AS count FROM training_attempts').get()
      ).toEqual({
        count: 1
      })
    } finally {
      root.dispose()
    }
  })
})
