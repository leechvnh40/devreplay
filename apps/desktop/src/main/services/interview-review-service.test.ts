import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { openAppDatabase } from '../database'
import { SqliteInterviewRepository } from '../repositories/sqlite-interview-repository'
import { InterviewReviewService } from './interview-review-service'
import { OnboardingService } from './onboarding-service'

describe('interview draft recovery', () => {
  it('restores free recall after reopening without creating formal evidence', () => {
    const directory = mkdtempSync(join(tmpdir(), 'devreplay-restart-'))
    const filename = join(directory, 'devreplay.sqlite')
    const now = (): string => '2026-09-04T09:30:00.000Z'
    let id = 0

    try {
      const firstDatabase = openAppDatabase(filename)
      const firstRepository = new SqliteInterviewRepository(firstDatabase)
      const onboarding = new OnboardingService(
        firstDatabase,
        firstRepository,
        now,
        () => `restart-${++id}`
      )
      onboarding.save({
        targetRole: '前端工程师',
        riskAccepted: true,
        resumeLabel: '当前简历',
        resumeContent: 'React 与 TypeScript'
      })
      const { interviewId } = onboarding.createInterview({
        company: '示例科技',
        role: '前端工程师',
        occurredAt: '2026-09-04T10:00',
        round: '一面',
        jobDescription: '',
        confirmWithoutJobDescription: true
      })
      const firstReviews = new InterviewReviewService(firstDatabase, firstRepository, now)
      firstReviews.saveFreeRecall(interviewId, '问了 event loop，我漏答了微任务执行顺序。')
      expect(
        firstDatabase.sqlite.prepare('SELECT count(*) AS count FROM evidence_entries').get()
      ).toEqual({ count: 0 })
      firstDatabase.close()

      const reopenedDatabase = openAppDatabase(filename)
      try {
        const reopenedRepository = new SqliteInterviewRepository(reopenedDatabase)
        const reopenedReviews = new InterviewReviewService(
          reopenedDatabase,
          reopenedRepository,
          now
        )
        const restored = reopenedReviews.getDraft(interviewId)

        expect(restored.freeRecall).toBe('问了 event loop，我漏答了微任务执行顺序。')
        expect(restored.interview.stage).toBe('free_recall')
        expect(reopenedReviews.list()).toHaveLength(1)
        expect(
          reopenedDatabase.sqlite.prepare('SELECT count(*) AS count FROM evidence_entries').get()
        ).toEqual({ count: 0 })
      } finally {
        reopenedDatabase.close()
      }
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })
})
