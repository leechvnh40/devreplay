import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { openAppDatabase } from '../database'
import { SecretStore, type SecretCipher } from '../secrets/secret-store'
import { CapabilityCatalogService } from './capability-catalog-service'
import { DataLifecycleService } from './data-lifecycle-service'
import { ModelSettingsService } from './model-settings-service'

const directories: string[] = []
const cipher: SecretCipher = {
  isAvailable: () => true,
  encrypt: (value) => Buffer.from(value, 'utf8'),
  decrypt: (value) => value.toString('utf8')
}

function setup(): {
  database: ReturnType<typeof openAppDatabase>
  secretsPath: string
  modelSettings: ModelSettingsService
  service: DataLifecycleService
} {
  const directory = mkdtempSync(join(tmpdir(), 'devreplay-lifecycle-'))
  directories.push(directory)
  const database = openAppDatabase(join(directory, 'app.sqlite'))
  const secretsPath = join(directory, 'secrets.json')
  const modelSettings = new ModelSettingsService(database, new SecretStore(secretsPath, cipher))
  return {
    database,
    secretsPath,
    modelSettings,
    service: new DataLifecycleService(database, modelSettings, () => '2026-09-04T00:00:00.000Z')
  }
}

afterEach(() => directories.splice(0).forEach((path) => rmSync(path, { recursive: true })))

describe('DataLifecycleService', () => {
  it('版本化导出不含 API Key，并保持关联完整地导入', () => {
    const source = setup()
    const target = setup()
    try {
      new CapabilityCatalogService(source.database).ensureInitialSkeleton()
      source.modelSettings.saveSettings({
        modelId: 'deepseek-chat',
        apiKey: 'secret-value-never-export'
      })
      source.database.sqlite
        .prepare(
          `INSERT INTO resume_snapshots (id, label, content, captured_at) VALUES ('r1', '合成', '内容', 'now')`
        )
        .run()
      const content = source.service.exportJson()
      expect(content).toContain('"version":1')
      expect(content).not.toContain('secret-value-never-export')
      expect(content).not.toContain('deepseekApiKey')

      const result = target.service.importJson(content)
      expect(result.rowCount).toBeGreaterThan(0)
      expect(
        target.database.sqlite.prepare("SELECT content FROM resume_snapshots WHERE id = 'r1'").get()
      ).toEqual({ content: '内容' })
      expect(target.modelSettings.getSettings()).toMatchObject({
        modelId: 'deepseek-chat',
        keyConfigured: false
      })
    } finally {
      source.database.close()
      target.database.close()
    }
  })

  it('错误文件事务回滚，不产生部分写入', () => {
    const target = setup()
    try {
      const document = JSON.parse(target.service.exportJson()) as {
        tables: Record<string, unknown[]>
      }
      document.tables.resume_snapshots = [
        { id: 'would-be-partial', label: 'x', content: 'x', captured_at: 'now' }
      ]
      document.tables.interviews = [{ id: 'broken-reference' }]
      expect(() => target.service.importJson(JSON.stringify(document))).toThrow()
      expect(
        target.database.sqlite
          .prepare("SELECT count(*) AS count FROM resume_snapshots WHERE id = 'would-be-partial'")
          .get()
      ).toEqual({ count: 0 })
    } finally {
      target.database.close()
    }
  })

  it('错误确认等同取消且无副作用，正确确认删除业务数据和凭据', () => {
    const target = setup()
    try {
      target.modelSettings.saveSettings({ modelId: 'deepseek-chat', apiKey: 'local-secret' })
      target.database.sqlite
        .prepare(
          `INSERT INTO resume_snapshots (id, label, content, captured_at) VALUES ('r1', '合成', '内容', 'now')`
        )
        .run()
      expect(() => target.service.clearAll('取消')).toThrow('清除确认文字不匹配')
      expect(
        target.database.sqlite
          .prepare("SELECT count(*) AS count FROM resume_snapshots WHERE id = 'r1'")
          .get()
      ).toEqual({ count: 1 })
      expect(existsSync(target.secretsPath)).toBe(true)
      expect(readFileSync(target.secretsPath, 'utf8')).not.toContain('local-secret')

      target.service.clearAll(target.service.clearPlan().confirmation)
      expect(
        target.database.sqlite.prepare('SELECT count(*) AS count FROM resume_snapshots').get()
      ).toEqual({ count: 0 })
      expect(existsSync(target.secretsPath)).toBe(false)
    } finally {
      target.database.close()
    }
  })
})
