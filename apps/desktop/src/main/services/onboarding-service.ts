import {
  createInterview,
  createJobDescriptionSnapshot,
  createResumeSnapshot,
  type InterviewRepository
} from '@devreplay/domain'
import type { IpcRequestPayload, OnboardingState } from '@devreplay/shared'
import { randomUUID } from 'node:crypto'
import { desc, eq } from 'drizzle-orm'
import {
  resumeSnapshots,
  reviewSessions,
  runInTransaction,
  settings,
  targetProfiles,
  type AppDatabase
} from '../database'

export class PreconditionError extends Error {}

export class OnboardingService {
  constructor(
    private readonly database: AppDatabase,
    private readonly interviews: InterviewRepository,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly createId: () => string = randomUUID
  ) {}

  getState(): OnboardingState {
    const target = this.database.orm
      .select()
      .from(targetProfiles)
      .where(eq(targetProfiles.active, true))
      .get()
    const resume = this.database.orm
      .select()
      .from(resumeSnapshots)
      .orderBy(desc(resumeSnapshots.capturedAt))
      .get()
    const risk = this.database.orm
      .select()
      .from(settings)
      .where(eq(settings.key, 'plaintext-risk-accepted'))
      .get()
    const riskAccepted = risk?.valueJson === 'true'

    return {
      initialized: Boolean(target && resume && riskAccepted),
      targetRole: target?.title ?? '',
      riskAccepted,
      ...(resume ? { resumeSnapshotId: resume.id, resumeLabel: resume.label } : {})
    }
  }

  save(payload: IpcRequestPayload<'onboarding.save'>): OnboardingState {
    const now = this.now()

    runInTransaction(this.database.sqlite, () => {
      this.database.orm
        .insert(targetProfiles)
        .values({
          id: 'single-user-target',
          title: payload.targetRole,
          direction: payload.targetRole,
          active: true,
          createdAt: now,
          updatedAt: now
        })
        .onConflictDoUpdate({
          target: targetProfiles.id,
          set: {
            title: payload.targetRole,
            direction: payload.targetRole,
            active: true,
            updatedAt: now
          }
        })
        .run()

      this.database.orm
        .insert(resumeSnapshots)
        .values({
          id: this.createId(),
          label: payload.resumeLabel,
          content: payload.resumeContent,
          capturedAt: now
        })
        .run()

      this.database.orm
        .insert(settings)
        .values({ key: 'plaintext-risk-accepted', valueJson: 'true', updatedAt: now })
        .onConflictDoUpdate({
          target: settings.key,
          set: { valueJson: 'true', updatedAt: now }
        })
        .run()
    })

    return this.getState()
  }

  createInterview(payload: IpcRequestPayload<'interview.create'>): { interviewId: string } {
    const state = this.getState()
    if (!state.resumeSnapshotId) throw new PreconditionError('请先保存简历快照')

    const resumeRow = this.database.orm
      .select()
      .from(resumeSnapshots)
      .where(eq(resumeSnapshots.id, state.resumeSnapshotId))
      .get()
    if (!resumeRow) throw new PreconditionError('简历快照不存在')

    const jobDescription = payload.jobDescription.trim()
    if (!jobDescription && !payload.confirmWithoutJobDescription) {
      throw new PreconditionError('缺少 JD 时需要确认继续')
    }

    const now = this.now()
    const interviewId = this.createId()
    runInTransaction(this.database.sqlite, () => {
      this.interviews.save(
        createInterview({
          id: interviewId,
          company: payload.company,
          role: payload.role,
          occurredAt: payload.occurredAt,
          round: payload.round,
          resumeSnapshot: createResumeSnapshot(resumeRow),
          ...(jobDescription
            ? {
                jobDescriptionSnapshot: createJobDescriptionSnapshot({
                  id: this.createId(),
                  content: jobDescription,
                  capturedAt: now
                })
              }
            : {}),
          createdAt: now
        })
      )
      this.database.orm
        .insert(reviewSessions)
        .values({
          id: this.createId(),
          interviewId,
          stage: 'free_recall',
          revision: 0,
          draftJson: JSON.stringify({ freeRecall: '' }),
          createdAt: now,
          updatedAt: now
        })
        .run()
    })

    return { interviewId }
  }
}
