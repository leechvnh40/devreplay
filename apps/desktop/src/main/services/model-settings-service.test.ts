import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { openAppDatabase } from '../database'
import { SecretStore, type SecretCipher } from '../secrets/secret-store'
import { ModelSettingsService } from './model-settings-service'

class TestCipher implements SecretCipher {
  isAvailable(): boolean {
    return true
  }

  encrypt(value: string): Buffer {
    return Buffer.from([...Buffer.from(value)].map((byte) => byte ^ 0xa5))
  }

  decrypt(value: Buffer): string {
    return Buffer.from([...value].map((byte) => byte ^ 0xa5)).toString('utf8')
  }
}

const directories: string[] = []

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe('ModelSettingsService', () => {
  it('keeps the API key out of SQLite, logs, and renderer serialization', () => {
    const directory = mkdtempSync(join(tmpdir(), 'devreplay-secrets-'))
    directories.push(directory)
    const database = openAppDatabase(join(directory, 'devreplay.sqlite'))
    const secretsPath = join(directory, 'secrets.json')
    const log = { info: vi.fn() }
    const service = new ModelSettingsService(
      database,
      new SecretStore(secretsPath, new TestCipher()),
      log,
      () => '2026-09-04T10:00:00.000Z'
    )
    const apiKey = 'sk-sensitive-deepseek-key'

    try {
      const rendererState = service.saveSettings({ modelId: 'deepseek-chat', apiKey })
      const sqliteText = JSON.stringify(
        database.sqlite.prepare('SELECT key, value_json FROM settings').all()
      )
      const logText = JSON.stringify(log.info.mock.calls)
      const secretsText = readFileSync(secretsPath, 'utf8')

      expect(rendererState).toEqual({
        provider: 'deepseek',
        modelId: 'deepseek-chat',
        keyConfigured: true,
        cloudNotice: expect.stringContaining('DeepSeek 云端')
      })
      expect(JSON.stringify(rendererState)).not.toContain(apiKey)
      expect(sqliteText).not.toContain(apiKey)
      expect(logText).not.toContain(apiKey)
      expect(secretsText).not.toContain(apiKey)
      expect(service.getApiKeyForModelRequest()).toBe(apiKey)
    } finally {
      database.close()
    }
  })

  it('requires a key on first configuration but permits model-only updates later', () => {
    const directory = mkdtempSync(join(tmpdir(), 'devreplay-secrets-'))
    directories.push(directory)
    const database = openAppDatabase(join(directory, 'devreplay.sqlite'))
    const service = new ModelSettingsService(
      database,
      new SecretStore(join(directory, 'secrets.json'), new TestCipher())
    )

    try {
      expect(() => service.saveSettings({ modelId: 'deepseek-chat', apiKey: '' })).toThrow(
        '首次配置必须提供'
      )
      service.saveSettings({ modelId: 'deepseek-chat', apiKey: 'sk-first' })
      expect(service.saveSettings({ modelId: 'deepseek-reasoner', apiKey: '' }).modelId).toBe(
        'deepseek-reasoner'
      )
    } finally {
      database.close()
    }
  })
})
