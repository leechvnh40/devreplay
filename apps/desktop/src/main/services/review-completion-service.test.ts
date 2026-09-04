import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { openAppDatabase } from '../database'
import { SqliteInterviewRepository } from '../repositories/sqlite-interview-repository'
import { DiagnosticService } from './diagnostic-service'
import { OnboardingService } from './onboarding-service'
import { ReviewCompletionService } from './review-completion-service'

describe('review completion end-to-end', () => {
  it('blocks missing gates, then accepts unknown and a no-training reason', () => {
    const directory = mkdtempSync(join(tmpdir(), 'devreplay-completion-'))
    const database = openAppDatabase(join(directory, 'devreplay.sqlite'))
    let sequence = 0
    const nextId = (): string => `completion-${++sequence}`
    const now = (): string => '2026-09-04T14:00:00.000Z'
    try {
      const repository = new SqliteInterviewRepository(database)
      const onboarding = new OnboardingService(database, repository, now, nextId)
      onboarding.save({
        targetRole: '前端工程师',
        riskAccepted: true,
        resumeLabel: '简历',
        resumeContent: 'React'
      })
      const { interviewId } = onboarding.createInterview({
        company: '示例科技',
        role: '前端工程师',
        occurredAt: now(),
        round: '二面',
        jobDescription: '',
        confirmWithoutJobDescription: true
      })
      const session = database.sqlite
        .prepare('SELECT id FROM review_sessions WHERE interview_id = ?')
        .get(interviewId) as { id: string }
      database.sqlite
        .prepare(
          `UPDATE review_sessions
           SET stage = 'training_decision', draft_json = ? WHERE id = ?`
        )
        .run(JSON.stringify({ freeRecall: '记不清其中一道追问，其余已记录。' }), session.id)
      database.sqlite
        .prepare(
          `INSERT INTO capability_nodes
           (id, name, category, user_confirmed, created_at, updated_at)
           VALUES ('react', 'React', 'frontend', 1, ?, ?)`
        )
        .run(now(), now())
      const diagnoses = new DiagnosticService(database, now, nextId)
      const hypothesis = diagnoses.propose(session.id, {
        capabilityId: 'react',
        claim: '并发渲染知识待验证',
        evidence: [{ id: nextId(), description: '追问记不清', specificity: 'vague' }],
        alternativeExplanations: ['回忆衰减'],
        confidence: 'low',
        verificationPlan: '后续最小题复核'
      })
      const completion = new ReviewCompletionService(database, now)
      const input = {
        keyQuestions: ['unknown'] as const,
        trainingDecision: { kind: 'no_training' as const, reason: '信息不足，先保留待验证' },
        evidencePreviewAcknowledged: false
      }

      expect(() => completion.complete(interviewId, input)).toThrow('诊断处理、证据预览')
      diagnoses.resolve(hypothesis.id, 'kept_pending')
      expect(() => completion.complete(interviewId, input)).toThrow('证据预览')
      completion.complete(interviewId, { ...input, evidencePreviewAcknowledged: true })

      expect(
        database.sqlite.prepare('SELECT stage FROM review_sessions WHERE id = ?').get(session.id)
      ).toEqual({ stage: 'completed' })
    } finally {
      database.close()
      rmSync(directory, { recursive: true })
    }
  })
})
