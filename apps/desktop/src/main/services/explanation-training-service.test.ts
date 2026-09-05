import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { openAppDatabase } from '../database'
import { CapabilityCatalogService } from './capability-catalog-service'
import { DemoDataService } from './demo-data-service'
import { ExplanationTrainingService } from './explanation-training-service'

const directories: string[] = []
afterEach(() => directories.splice(0).forEach((path) => rmSync(path, { recursive: true })))

describe('ExplanationTrainingService', () => {
  it('按持久化契约验收并安排间隔复测', () => {
    const directory = mkdtempSync(join(tmpdir(), 'devreplay-explanation-'))
    directories.push(directory)
    const database = openAppDatabase(join(directory, 'app.sqlite'))
    try {
      new CapabilityCatalogService(database).ensureInitialSkeleton()
      new DemoDataService(database).load()
      let sequence = 0
      const service = new ExplanationTrainingService(
        database,
        () => '2026-09-04T00:00:00.000Z',
        () => `generated-${++sequence}`
      )
      expect(service.getTask('demo-training')).toMatchObject({ requiredPointCount: 3 })
      const result = service.submit(
        'demo-training',
        '一次宏任务结束后清空微任务，然后浏览器进行渲染。'
      )
      expect(result).toMatchObject({
        passed: true,
        capabilityState: 'pending',
        retestDueDate: '2026-09-11'
      })
      expect(
        database.sqlite
          .prepare("SELECT status FROM training_tasks WHERE id = 'demo-training'")
          .get()
      ).toEqual({ status: 'completed' })
    } finally {
      database.close()
    }
  })
})
