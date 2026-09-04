import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { openAppDatabase } from '../database'
import { SqliteInterviewRepository } from '../repositories/sqlite-interview-repository'
import { DiagnosticService } from './diagnostic-service'
import { OnboardingService } from './onboarding-service'

const directories: string[] = []
afterEach(() =>
  directories.splice(0).forEach((directory) => rmSync(directory, { recursive: true }))
)

describe('diagnosis resolution integration', () => {
  it('creates formal evidence only for a user-confirmed diagnosis', () => {
    const directory = mkdtempSync(join(tmpdir(), 'devreplay-diagnosis-'))
    directories.push(directory)
    const database = openAppDatabase(join(directory, 'devreplay.sqlite'))
    let sequence = 0
    const nextId = (): string => `id-${++sequence}`
    const now = (): string => '2026-09-04T12:00:00.000Z'

    try {
      const repository = new SqliteInterviewRepository(database)
      const onboarding = new OnboardingService(database, repository, now, nextId)
      onboarding.save({
        targetRole: '前端工程师',
        riskAccepted: true,
        resumeLabel: '简历',
        resumeContent: 'TypeScript'
      })
      const interview = onboarding.createInterview({
        company: '示例科技',
        role: '前端工程师',
        occurredAt: now(),
        round: '一面',
        jobDescription: '',
        confirmWithoutJobDescription: true
      })
      const session = database.sqlite
        .prepare('SELECT id FROM review_sessions WHERE interview_id = ?')
        .get(interview.interviewId) as { id: string }
      database.sqlite
        .prepare(
          `INSERT INTO capability_nodes
           (id, name, category, user_confirmed, created_at, updated_at)
           VALUES ('javascript', 'JavaScript', 'frontend', 1, ?, ?)`
        )
        .run(now(), now())

      const service = new DiagnosticService(database, now, nextId)
      const proposed = ['confirmed', 'rejected', 'kept_pending'].map(() =>
        service.propose(session.id, {
          capabilityId: 'javascript',
          claim: '事件循环理解可能不稳',
          evidence: [{ id: nextId(), description: '排序错误', specificity: 'specific' }],
          alternativeExplanations: ['题意理解偏差'],
          confidence: 'medium',
          verificationPlan: '用最小代码题复核'
        })
      )

      service.resolve(proposed[0]!.id, 'confirmed')
      service.resolve(proposed[1]!.id, 'rejected')
      service.resolve(proposed[2]!.id, 'kept_pending')

      expect(
        database.sqlite.prepare('SELECT count(*) AS count FROM evidence_entries').get()
      ).toEqual({ count: 1 })
      const evidence = database.sqlite
        .prepare('SELECT content_json FROM evidence_entries')
        .get() as {
        content_json: string
      }
      expect(JSON.parse(evidence.content_json)).toMatchObject({ diagnosisId: proposed[0]!.id })
      expect(database.sqlite.prepare('SELECT state FROM capability_projection').get()).toEqual({
        state: 'weak'
      })
    } finally {
      database.close()
    }
  })
})
