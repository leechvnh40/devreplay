import {
  ModelProviderError,
  type ModelProvider,
  type ModelRequest,
  type ModelResult
} from '@devreplay/agent'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { openAppDatabase } from '../database'
import { SqliteInterviewRepository } from '../repositories/sqlite-interview-repository'
import { SecretStore, type SecretCipher } from '../secrets/secret-store'
import { CapabilityCatalogService } from './capability-catalog-service'
import { InterviewReviewService } from './interview-review-service'
import { ModelSettingsService } from './model-settings-service'
import { OnboardingService } from './onboarding-service'
import { ReviewAnalysisService } from './review-analysis-service'
import { ReviewFlowService } from './review-flow-service'

class TestCipher implements SecretCipher {
  isAvailable(): boolean {
    return true
  }
  encrypt(value: string): Buffer {
    return Buffer.from(value)
  }
  decrypt(value: Buffer): string {
    return value.toString('utf8')
  }
}

const directories: string[] = []
afterEach(() =>
  directories.splice(0).forEach((directory) => rmSync(directory, { recursive: true, force: true }))
)

function modelResult(content: string): ModelResult {
  return {
    provider: 'deepseek',
    requestId: crypto.randomUUID(),
    modelId: 'deepseek-chat',
    content,
    finishReason: 'stop',
    usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
    rawResponse: { content }
  }
}

function createHarness(provider: ModelProvider): {
  database: ReturnType<typeof openAppDatabase>
  databasePath: string
  interviewId: string
  service: ReviewAnalysisService
} {
  const directory = mkdtempSync(join(tmpdir(), 'devreplay-analysis-failure-'))
  directories.push(directory)
  const databasePath = join(directory, 'devreplay.sqlite')
  const database = openAppDatabase(databasePath)
  let sequence = 0
  const nextId = (): string => `failure-${++sequence}`
  const now = (): string => '2026-09-04T17:00:00.000Z'
  const interviews = new SqliteInterviewRepository(database)
  new CapabilityCatalogService(database, now, nextId).ensureInitialSkeleton()
  const onboarding = new OnboardingService(database, interviews, now, nextId)
  onboarding.save({
    targetRole: '前端工程师',
    riskAccepted: true,
    resumeLabel: '简历',
    resumeContent: 'TypeScript'
  })
  const { interviewId } = onboarding.createInterview({
    company: '示例科技',
    role: '前端工程师',
    occurredAt: now(),
    round: '一面',
    jobDescription: '',
    confirmWithoutJobDescription: true
  })
  new InterviewReviewService(database, interviews, now).saveFreeRecall(
    interviewId,
    '用户已完成的自由回忆不会因为模型失败而丢失。'
  )
  const settings = new ModelSettingsService(
    database,
    new SecretStore(join(directory, 'secrets.json'), new TestCipher()),
    undefined,
    now
  )
  settings.saveSettings({ modelId: 'deepseek-chat', apiKey: 'sk-test' })
  return {
    database,
    databasePath,
    interviewId,
    service: new ReviewAnalysisService(database, settings, () => provider, now, nextId)
  }
}

describe('review analysis failure recovery', () => {
  it.each([
    ['network', '离线'],
    ['authentication', '鉴权失败'],
    ['rate_limit', '请求受限'],
    ['timeout', '请求超时']
  ] as const)('preserves input and marks %s failures retryable', async (kind, message) => {
    const provider: ModelProvider = {
      complete: vi.fn().mockRejectedValue(new ModelProviderError(kind, message))
    }
    const harness = createHarness(provider)
    try {
      await expect(harness.service.analyze(harness.interviewId, [])).rejects.toMatchObject({ kind })
      const state = new ReviewFlowService(harness.database).getState(harness.interviewId)
      expect(state).toMatchObject({
        stage: 'extract_review',
        operationStatus: 'retryable_error',
        lastError: message,
        freeRecall: '用户已完成的自由回忆不会因为模型失败而丢失。'
      })
    } finally {
      harness.database.close()
    }
  })

  it('repairs structured output once and keeps a second failure retryable', async () => {
    const complete = vi
      .fn<(request: ModelRequest) => Promise<ModelResult>>()
      .mockResolvedValueOnce(modelResult('not json'))
      .mockResolvedValueOnce(modelResult('{"questions":"still invalid"}'))
    const harness = createHarness({ complete })
    try {
      await expect(harness.service.analyze(harness.interviewId, [])).rejects.toThrow(
        '两次输出均不符合'
      )
      expect(complete).toHaveBeenCalledTimes(2)
      expect(new ReviewFlowService(harness.database).getState(harness.interviewId)).toMatchObject({
        operationStatus: 'retryable_error'
      })
      expect(harness.database.sqlite.prepare('SELECT status FROM model_runs').get()).toEqual({
        status: 'failed'
      })
    } finally {
      harness.database.close()
    }
  })

  it('cancels an active request and keeps the review retryable', async () => {
    const started = vi.fn()
    const provider: ModelProvider = {
      complete: (_request, options) =>
        new Promise((_resolve, reject) => {
          started()
          options?.signal?.addEventListener(
            'abort',
            () => reject(new ModelProviderError('cancelled', '请求已取消')),
            { once: true }
          )
        })
    }
    const harness = createHarness(provider)
    try {
      const pending = harness.service.analyze(harness.interviewId, [])
      await vi.waitFor(() => expect(started).toHaveBeenCalled())
      expect(harness.service.cancel(harness.interviewId)).toBe(true)
      await expect(pending).rejects.toMatchObject({ kind: 'cancelled' })
      expect(new ReviewFlowService(harness.database).getState(harness.interviewId)).toMatchObject({
        operationStatus: 'retryable_error',
        lastError: '请求已取消'
      })
    } finally {
      harness.database.close()
    }
  })

  it('recovers an operation interrupted by application exit', () => {
    const provider: ModelProvider = {
      complete: vi.fn().mockRejectedValue(new ModelProviderError('network', 'unused'))
    }
    const harness = createHarness(provider)
    const session = harness.database.sqlite
      .prepare('SELECT id, draft_json FROM review_sessions WHERE interview_id = ?')
      .get(harness.interviewId) as { id: string; draft_json: string }
    const draft = JSON.parse(session.draft_json) as Record<string, unknown>
    harness.database.sqlite
      .prepare("UPDATE review_sessions SET stage = 'extract_review', draft_json = ? WHERE id = ?")
      .run(JSON.stringify({ ...draft, operationStatus: 'running' }), session.id)
    harness.database.close()

    const reopened = openAppDatabase(harness.databasePath)
    try {
      const flow = new ReviewFlowService(reopened)
      flow.recoverInterruptedOperations()
      expect(flow.getState(harness.interviewId)).toMatchObject({
        operationStatus: 'retryable_error',
        lastError: expect.stringContaining('应用退出')
      })
    } finally {
      reopened.close()
    }
  })
})
