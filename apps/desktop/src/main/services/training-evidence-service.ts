import { createEvidenceEntry, type CapabilityProjection } from '@devreplay/domain'
import { runInTransaction, type AppDatabase } from '../database'
import { SqliteEvidenceRepository } from '../repositories/sqlite-evidence-repository'
import { PreconditionError } from './onboarding-service'

export type VerificationKind = 'initial_training' | 'spaced_retest' | 'real_interview'

export interface RecordTrainingEvidenceInput {
  readonly trainingTaskId: string
  readonly sourceId: string
  readonly kind: VerificationKind
  readonly passed: boolean
  readonly interviewId?: string
  readonly retestAfterDays?: number
}

export class TrainingEvidenceService {
  private readonly evidence: SqliteEvidenceRepository

  constructor(
    private readonly database: AppDatabase,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly nextId: () => string = () => crypto.randomUUID()
  ) {
    this.evidence = new SqliteEvidenceRepository(database, now)
  }

  record(input: RecordTrainingEvidenceInput): CapabilityProjection {
    return runInTransaction(this.database.sqlite, () => {
      const task = this.database.sqlite
        .prepare('SELECT capability_id FROM training_tasks WHERE id = ?')
        .get(input.trainingTaskId) as { capability_id: string } | undefined
      if (!task) throw new PreconditionError('训练任务不存在')
      if (input.kind === 'real_interview' && !input.interviewId) {
        throw new PreconditionError('真实面试证据必须关联面试')
      }
      const sourceType =
        input.kind === 'initial_training'
          ? ('training_verification' as const)
          : input.kind === 'spaced_retest'
            ? ('spaced_retest' as const)
            : ('real_interview' as const)
      const projection = this.evidence.append(
        createEvidenceEntry({
          id: this.nextId(),
          capabilityId: task.capability_id,
          ...(input.interviewId ? { interviewId: input.interviewId } : {}),
          sourceType,
          polarity: input.passed ? 'positive' : 'negative',
          strength: input.kind === 'initial_training' ? 2 : 3,
          content: { trainingTaskId: input.trainingTaskId, sourceId: input.sourceId },
          createdAt: this.now()
        })
      )

      if (input.kind === 'initial_training' && input.passed) {
        const dueDate = new Date(this.now())
        dueDate.setUTCDate(dueDate.getUTCDate() + (input.retestAfterDays ?? 7))
        this.database.sqlite
          .prepare(
            `INSERT INTO review_schedules (id, training_task_id, due_date, status, created_at)
             VALUES (?, ?, ?, 'scheduled', ?)`
          )
          .run(this.nextId(), input.trainingTaskId, dueDate.toISOString().slice(0, 10), this.now())
      }
      if (input.kind === 'spaced_retest') {
        this.database.sqlite
          .prepare(
            "UPDATE review_schedules SET status = 'completed' WHERE training_task_id = ? AND status = 'scheduled'"
          )
          .run(input.trainingTaskId)
      }
      return projection
    })
  }
}
