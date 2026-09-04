import type { InterviewRepository } from '@devreplay/domain'
import type { InterviewSummary, ReviewDraft } from '@devreplay/shared'
import { eq } from 'drizzle-orm'
import { reviewSessions, type AppDatabase } from '../database'
import { PreconditionError } from './onboarding-service'

interface StoredReviewDraft {
  freeRecall: string
}

export class InterviewReviewService {
  constructor(
    private readonly database: AppDatabase,
    private readonly interviews: InterviewRepository,
    private readonly now: () => string = () => new Date().toISOString()
  ) {}

  list(): readonly InterviewSummary[] {
    return this.interviews.list().map((interview) => {
      const session = this.findSession(interview.id)
      return {
        id: interview.id,
        company: interview.company,
        role: interview.role,
        occurredAt: interview.occurredAt,
        round: interview.round,
        stage: session.stage,
        updatedAt: session.updatedAt
      }
    })
  }

  getDraft(interviewId: string): ReviewDraft {
    const interview = this.interviews.findById(interviewId)
    if (!interview) throw new PreconditionError('面试记录不存在')
    const session = this.findSession(interviewId)
    const draft = this.parseDraft(session.draftJson)

    return {
      interview: {
        id: interview.id,
        company: interview.company,
        role: interview.role,
        occurredAt: interview.occurredAt,
        round: interview.round,
        stage: session.stage,
        updatedAt: session.updatedAt
      },
      freeRecall: draft.freeRecall
    }
  }

  saveFreeRecall(
    interviewId: string,
    content: string
  ): {
    savedAt: string
    stage: 'free_recall'
  } {
    const session = this.findSession(interviewId)
    if (session.stage !== 'free_recall') {
      throw new PreconditionError('当前复盘阶段不能修改自由回忆')
    }

    const savedAt = this.now()
    this.database.orm
      .update(reviewSessions)
      .set({
        draftJson: JSON.stringify({ freeRecall: content }),
        revision: session.revision + 1,
        updatedAt: savedAt
      })
      .where(eq(reviewSessions.id, session.id))
      .run()

    return { savedAt, stage: 'free_recall' }
  }

  private findSession(interviewId: string): typeof reviewSessions.$inferSelect {
    const session = this.database.orm
      .select()
      .from(reviewSessions)
      .where(eq(reviewSessions.interviewId, interviewId))
      .get()
    if (!session) throw new PreconditionError('复盘会话不存在')
    return session
  }

  private parseDraft(value: string): StoredReviewDraft {
    try {
      const parsed: unknown = JSON.parse(value)
      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        'freeRecall' in parsed &&
        typeof parsed.freeRecall === 'string'
      ) {
        return { freeRecall: parsed.freeRecall }
      }
    } catch {
      // The explicit error below keeps corrupted local state recoverable and visible.
    }
    throw new Error('复盘草稿数据损坏')
  }
}
