import type { ModelProvider, ModelRequest, ModelResult } from '@devreplay/agent'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { CompositionRoot } from './composition-root'
import { WorkspaceService } from './services/workspace-service'
import { CapabilityProfileService } from './services/capability-profile-service'
import { DemoDataService } from './services/demo-data-service'
import { DataLifecycleService } from './services/data-lifecycle-service'
import { ExplanationTrainingService } from './services/explanation-training-service'
import { openAppDatabase } from './database'
import { handleIpcRequest } from './ipc'
import { SqliteInterviewRepository } from './repositories/sqlite-interview-repository'
import { SecretStore, type SecretCipher } from './secrets/secret-store'
import { CapabilityCatalogService } from './services/capability-catalog-service'
import { CodeTrainingService } from './services/code-training-service'
import { InterviewReviewService } from './services/interview-review-service'
import { ModelSettingsService } from './services/model-settings-service'
import { OnboardingService } from './services/onboarding-service'
import { ReviewAnalysisService } from './services/review-analysis-service'
import { ReviewFlowService } from './services/review-flow-service'

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

describe('public IPC review flow', () => {
  it('runs the recorded fixture golden path through validated request envelopes', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'devreplay-ipc-flow-'))
    directories.push(directory)
    const database = openAppDatabase(join(directory, 'devreplay.sqlite'))
    let sequence = 0
    const nextId = (): string => `ipc-${++sequence}`
    const now = (): string => '2026-09-04T18:00:00.000Z'
    const interviews = new SqliteInterviewRepository(database)
    const onboarding = new OnboardingService(database, interviews, now, nextId)
    const reviews = new InterviewReviewService(database, interviews, now)
    const capabilities = new CapabilityCatalogService(database, now, nextId)
    capabilities.ensureInitialSkeleton()
    const modelSettings = new ModelSettingsService(
      database,
      new SecretStore(join(directory, 'secrets.json'), new TestCipher()),
      undefined,
      now
    )
    const provider: ModelProvider = {
      complete: async (request: ModelRequest): Promise<ModelResult> => ({
        provider: 'deepseek',
        requestId: 'recorded-fixture',
        modelId: request.modelId,
        content: JSON.stringify({
          questions: [
            {
              id: 'event-loop',
              question: '解释 event loop',
              answer: { status: 'unknown' },
              interviewerFollowUp: { status: 'unknown' },
              sourceQuote: '面试官让我解释 event loop'
            }
          ],
          overallImpression: { status: 'unknown' },
          uncertainties: []
        }),
        finishReason: 'stop',
        usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 },
        rawResponse: { fixture: true }
      })
    }
    const reviewFlow = new ReviewFlowService(database, now)
    const root: CompositionRoot = {
      database,
      interviews,
      onboarding,
      reviews,
      capabilities,
      modelSettings,
      analysis: new ReviewAnalysisService(database, modelSettings, () => provider, now, nextId),
      reviewFlow,
      codeTraining: new CodeTrainingService(database, now, nextId),
      workspace: new WorkspaceService(database),
      capabilityProfile: new CapabilityProfileService(database),
      demo: new DemoDataService(database),
      dataLifecycle: new DataLifecycleService(database, modelSettings),
      explanationTraining: new ExplanationTrainingService(database, now, nextId),
      dispose: () => database.close()
    }

    try {
      await ok(root, 'onboarding.save', {
        targetRole: '前端工程师',
        riskAccepted: true,
        resumeLabel: '合成简历',
        resumeContent: 'TypeScript'
      })
      await ok(root, 'model.save-settings', {
        modelId: 'deepseek-chat',
        apiKey: 'sk-fixture-only'
      })
      const created = await ok(root, 'interview.create', {
        company: '合成科技',
        role: '前端工程师',
        occurredAt: now(),
        round: '一面',
        jobDescription: '',
        confirmWithoutJobDescription: true
      })
      const interviewId = (created as { interviewId: string }).interviewId
      await ok(root, 'review.save-free-recall', {
        interviewId,
        content: '面试官让我解释 event loop'
      })
      const preview = (await ok(root, 'review.get-analysis-preview', {
        interviewId
      })) as { items: { id: string; required: boolean }[] }
      const analyzed = (await ok(root, 'review.analyze', {
        interviewId,
        includedItemIds: preview.items.filter((item) => item.required).map((item) => item.id)
      })) as {
        items: { id: string }[]
        diagnoses: { id: string }[]
      }
      const itemId = analyzed.items[0]!.id
      await ok(root, 'review.answer-question', {
        interviewId,
        itemId,
        answer: '',
        unknown: true
      })
      const resolving = (await ok(root, 'review.finish-questions', { interviewId })) as {
        stage: string
        diagnoses: { id: string }[]
      }
      expect(resolving.stage).toBe('user_resolution')
      const evidencePreview = (await ok(root, 'review.resolve-diagnosis', {
        interviewId,
        diagnosisId: resolving.diagnoses[0]!.id,
        resolution: 'confirmed'
      })) as { stage: string; evidence: unknown[] }
      expect(evidencePreview).toMatchObject({ stage: 'evidence_preview' })
      expect(evidencePreview.evidence).toHaveLength(1)
      await ok(root, 'review.acknowledge-evidence', { interviewId })
      const completed = (await ok(root, 'review.complete-without-training', {
        interviewId,
        reason: '先保存复盘，训练稍后安排'
      })) as { stage: string }
      expect(completed.stage).toBe('completed')
    } finally {
      root.dispose()
    }
  })
})

async function ok(root: CompositionRoot, channel: string, payload: unknown): Promise<unknown> {
  const result = await handleIpcRequest(root, { channel, payload })
  expect(result).toMatchObject({ ok: true })
  if (!result.ok) throw new Error(result.error.message)
  return result.data
}
