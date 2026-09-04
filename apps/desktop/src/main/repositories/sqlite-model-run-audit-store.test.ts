import {
  AuditedModelRunner,
  ModelProviderError,
  getPromptVersion,
  type ModelProvider,
  type ModelResult
} from '@devreplay/agent'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { openAppDatabase } from '../database'
import { SqliteModelRunAuditStore } from './sqlite-model-run-audit-store'

const directories: string[] = []

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

function createHarness(provider: ModelProvider): {
  database: ReturnType<typeof openAppDatabase>
  runner: AuditedModelRunner
} {
  const directory = mkdtempSync(join(tmpdir(), 'devreplay-model-run-'))
  directories.push(directory)
  const database = openAppDatabase(join(directory, 'devreplay.sqlite'))
  return {
    database,
    runner: new AuditedModelRunner(
      provider,
      new SqliteModelRunAuditStore(database),
      () => '2026-09-04T11:00:00.000Z'
    )
  }
}

const baseRequest = {
  modelId: 'deepseek-chat',
  messages: [{ role: 'user' as const, content: '复盘内容' }]
}

describe('SQLite model run audit', () => {
  it('redacts authorization and preserves raw plus structured results', async () => {
    const result: ModelResult = {
      provider: 'deepseek',
      requestId: 'request-1',
      modelId: 'deepseek-chat',
      content: '{"items":["event loop"]}',
      finishReason: 'stop',
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      rawResponse: { id: 'raw-1', choices: [{ message: { content: 'raw content' } }] }
    }
    const provider: ModelProvider = { complete: vi.fn().mockResolvedValue(result) }
    const harness = createHarness(provider)

    try {
      await expect(
        harness.runner.run(
          {
            runId: 'run-1',
            prompt: getPromptVersion('interview-extract-v1'),
            request: baseRequest,
            requestMetadata: {
              headers: { Authorization: 'Bearer sk-never-store', 'x-trace': 'trace-1' }
            }
          },
          (content) => JSON.parse(content) as unknown
        )
      ).resolves.toEqual({ items: ['event loop'] })

      const row = harness.database.sqlite.prepare('SELECT * FROM model_runs').get() as Record<
        string,
        string
      >
      expect(row.status).toBe('succeeded')
      expect(row.request_json).toContain('[REDACTED]')
      expect(row.request_json).not.toContain('sk-never-store')
      expect(JSON.parse(row.response_json)).toMatchObject({ id: 'raw-1' })
      expect(JSON.parse(row.result_json)).toEqual({ items: ['event loop'] })
      expect(JSON.parse(row.usage_json)).toEqual({
        inputTokens: 10,
        outputTokens: 5,
        totalTokens: 15
      })
      expect(
        harness.database.sqlite.prepare('SELECT count(*) AS count FROM prompt_versions').get()
      ).toEqual({ count: 1 })
    } finally {
      harness.database.close()
    }
  })

  it('keeps failed runs traceable', async () => {
    const failure = new ModelProviderError('rate_limit', '请求频率受限', 429)
    const provider: ModelProvider = { complete: vi.fn().mockRejectedValue(failure) }
    const harness = createHarness(provider)

    try {
      await expect(
        harness.runner.run(
          {
            runId: 'run-failed',
            prompt: getPromptVersion('interview-extract-v1'),
            request: baseRequest
          },
          JSON.parse
        )
      ).rejects.toBe(failure)

      const row = harness.database.sqlite
        .prepare('SELECT status, error_json FROM model_runs WHERE id = ?')
        .get('run-failed') as { status: string; error_json: string }
      expect(row.status).toBe('failed')
      expect(JSON.parse(row.error_json)).toMatchObject({ kind: 'rate_limit' })
    } finally {
      harness.database.close()
    }
  })
})
