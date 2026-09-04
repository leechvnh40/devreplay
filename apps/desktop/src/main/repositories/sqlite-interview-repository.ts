import {
  createInterview,
  createJobDescriptionSnapshot,
  createResumeSnapshot,
  type Interview,
  type InterviewId,
  type InterviewRepository,
  type JobDescriptionSnapshot,
  type ResumeSnapshot
} from '@devreplay/domain'
import { desc, eq } from 'drizzle-orm'
import {
  interviews,
  jobDescriptions,
  resumeSnapshots,
  runInTransaction,
  type AppDatabase
} from '../database'

export class SqliteInterviewRepository implements InterviewRepository {
  constructor(private readonly database: AppDatabase) {}

  save(interview: Interview): void {
    runInTransaction(this.database.sqlite, () => {
      this.persistResume(interview.resumeSnapshot)
      if (interview.jobDescriptionSnapshot) {
        this.persistJobDescription(interview.jobDescriptionSnapshot)
      }

      this.database.orm
        .insert(interviews)
        .values({
          id: interview.id,
          company: interview.company,
          role: interview.role,
          occurredAt: interview.occurredAt,
          round: interview.round,
          resumeSnapshotId: interview.resumeSnapshot.id,
          jobDescriptionId: interview.jobDescriptionSnapshot?.id,
          createdAt: interview.createdAt,
          updatedAt: interview.createdAt
        })
        .run()
    })
  }

  findById(id: InterviewId): Interview | undefined {
    const row = this.database.orm.select().from(interviews).where(eq(interviews.id, id)).get()
    return row ? this.mapInterview(row) : undefined
  }

  list(): readonly Interview[] {
    return this.database.orm
      .select()
      .from(interviews)
      .orderBy(desc(interviews.occurredAt))
      .all()
      .map((row) => this.mapInterview(row))
  }

  private persistResume(snapshot: ResumeSnapshot): void {
    const existing = this.database.orm
      .select()
      .from(resumeSnapshots)
      .where(eq(resumeSnapshots.id, snapshot.id))
      .get()

    if (existing) {
      if (
        existing.label !== snapshot.label ||
        existing.content !== snapshot.content ||
        existing.capturedAt !== snapshot.capturedAt
      ) {
        throw new Error(`不可覆盖简历快照：${snapshot.id}`)
      }
      return
    }

    this.database.orm.insert(resumeSnapshots).values(snapshot).run()
  }

  private persistJobDescription(snapshot: JobDescriptionSnapshot): void {
    const existing = this.database.orm
      .select()
      .from(jobDescriptions)
      .where(eq(jobDescriptions.id, snapshot.id))
      .get()

    if (existing) {
      if (existing.content !== snapshot.content || existing.capturedAt !== snapshot.capturedAt) {
        throw new Error(`不可覆盖 JD 快照：${snapshot.id}`)
      }
      return
    }

    this.database.orm.insert(jobDescriptions).values(snapshot).run()
  }

  private mapInterview(row: typeof interviews.$inferSelect): Interview {
    const resumeRow = this.database.orm
      .select()
      .from(resumeSnapshots)
      .where(eq(resumeSnapshots.id, row.resumeSnapshotId))
      .get()

    if (!resumeRow) throw new Error(`面试 ${row.id} 缺少简历快照`)

    const jobDescriptionRow = row.jobDescriptionId
      ? this.database.orm
          .select()
          .from(jobDescriptions)
          .where(eq(jobDescriptions.id, row.jobDescriptionId))
          .get()
      : undefined

    return createInterview({
      id: row.id,
      company: row.company,
      role: row.role,
      occurredAt: row.occurredAt,
      round: row.round,
      resumeSnapshot: createResumeSnapshot(resumeRow),
      ...(jobDescriptionRow
        ? { jobDescriptionSnapshot: createJobDescriptionSnapshot(jobDescriptionRow) }
        : {}),
      createdAt: row.createdAt
    })
  }
}
