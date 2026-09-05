import type { ModelProvider, ModelRequest, ModelResult } from '@devreplay/agent'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { openAppDatabase } from '../database'
import { SqliteInterviewRepository } from '../repositories/sqlite-interview-repository'
import { SecretStore, type SecretCipher } from '../secrets/secret-store'
import { InterviewReviewService } from './interview-review-service'
import { CapabilityCatalogService } from './capability-catalog-service'
import { ModelSettingsService } from './model-settings-service'
import { OnboardingService } from './onboarding-service'
import { ReviewAnalysisService } from './review-analysis-service'
import { ReviewFlowService } from './review-flow-service'

class TestCipher implements SecretCipher {
  isAvailable(): boolean {
    return true
  }

  encrypt(value: string): Buffer {
    return Buffer.from(value).reverse()
  }

  decrypt(value: Buffer): string {
    return Buffer.from(value).reverse().toString('utf8')
  }
}

const directories: string[] = []

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe('ReviewAnalysisService', () => {
  it('sends only selected context and keeps the result traceable without storing the API key', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'devreplay-analysis-'))
    directories.push(directory)
    const databasePath = join(directory, 'devreplay.sqlite')
    const database = openAppDatabase(databasePath)
    let sequence = 0
    const nextId = (): string => `analysis-${++sequence}`
    const now = (): string => '2026-09-04T16:00:00.000Z'
    const interviews = new SqliteInterviewRepository(database)
    new CapabilityCatalogService(database, now, nextId).ensureInitialSkeleton()
    const onboarding = new OnboardingService(database, interviews, now, nextId)
    onboarding.save({
      targetRole: '前端工程师',
      riskAccepted: true,
      resumeLabel: '包含敏感技能的简历',
      resumeContent: 'PRIVATE_RESUME_CONTENT React 专家'
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
      '面试官让我解释 event loop。'
    )

    const secretStore = new SecretStore(join(directory, 'secrets.json'), new TestCipher())
    const settings = new ModelSettingsService(database, secretStore, undefined, now)
    const apiKey = 'sk-private-deepseek-key'
    settings.saveSettings({ modelId: 'deepseek-chat', apiKey })

    const complete = vi.fn(async (request: ModelRequest): Promise<ModelResult> => ({
      provider: 'deepseek',
      requestId: 'fixture-request',
      modelId: request.modelId,
      content: JSON.stringify({
        questions: [
          {
            id: 'event-loop',
            question: '解释 event loop',
            answer: { status: 'unknown' },
            interviewerFollowUp: { status: 'unknown' },
            sourceQuote: '解释 event loop'
          }
        ],
        overallImpression: { status: 'unknown' },
        uncertainties: []
      }),
      finishReason: 'stop',
      usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 },
      rawResponse: { id: 'fixture-request' }
    }))
    const provider: ModelProvider = { complete }
    const service = new ReviewAnalysisService(database, settings, () => provider, now, nextId)

    try {
      const preview = service.preview(interviewId)
      expect(preview.items.map((item) => item.kind)).toEqual([
        'current_recall',
        'interview_context',
        'resume_excerpt'
      ])

      const result = await service.analyze(interviewId, ['current-recall', 'interview-context'])
      const sent = complete.mock.calls[0]?.[0].messages.map((message) => message.content).join('\n')
      expect(sent).toContain('event loop')
      expect(sent).not.toContain('PRIVATE_RESUME_CONTENT')

      const auditText = JSON.stringify(
        database.sqlite.prepare('SELECT * FROM model_runs WHERE id = ?').get(result.runId)
      )
      expect(auditText).not.toContain(apiKey)
      expect(
        database.sqlite
          .prepare(
            'SELECT kind, included FROM context_manifest_items WHERE model_run_id = ? ORDER BY id'
          )
          .all(result.runId)
      ).toEqual([
        { kind: 'current_recall', included: 1 },
        { kind: 'interview_context', included: 1 },
        { kind: 'resume_excerpt', included: 0 }
      ])

      const item = database.sqlite
        .prepare('SELECT id, source_id FROM review_items WHERE source_id = ?')
        .get(result.runId) as { id: string; source_id: string }
      expect(item.source_id).toBe(result.runId)
      expect(service.getRunForReviewItem(item.id)).toMatchObject({
        reviewItemId: item.id,
        runId: result.runId,
        status: 'succeeded',
        promptVersionId: 'interview-extract-v1'
      })

      const flow = new ReviewFlowService(database, now)
      expect(flow.getState(interviewId)).toMatchObject({
        stage: 'targeted_questions',
        diagnoses: [{ resolution: 'unresolved' }]
      })
      const revised = flow.reviseItem(interviewId, item.id, '实际问题：解释浏览器 event loop')
      expect(revised.items[0]).toMatchObject({
        question: '实际问题：解释浏览器 event loop',
        originalQuestion: '解释 event loop',
        sourceType: 'user_revision'
      })
      flow.answerQuestion(interviewId, item.id, '', true)
      const resolution = flow.finishQuestions(interviewId)
      expect(resolution.stage).toBe('user_resolution')
      const diagnosisId = resolution.diagnoses[0]!.id
      expect(flow.resolveDiagnosis(interviewId, diagnosisId, 'confirmed').stage).toBe(
        'evidence_preview'
      )
      expect(flow.acknowledgeEvidence(interviewId).stage).toBe('training_decision')
      expect(
        flow.completeWithoutTraining(interviewId, '先记录真实面试证据，稍后安排训练').stage
      ).toBe('completed')

      database.close()
      const reopened = openAppDatabase(databasePath)
      try {
        const recovered = new ReviewFlowService(reopened, now).getState(interviewId)
        expect(recovered).toMatchObject({
          stage: 'completed',
          items: [{ status: 'unknown', sourceType: 'user_revision' }],
          diagnoses: [{ resolution: 'confirmed' }],
          evidence: [{ polarity: 'negative', sourceType: 'confirmed_diagnosis' }]
        })
      } finally {
        reopened.close()
      }
    } finally {
      if (database.sqlite.open) database.close()
    }
  })
})
