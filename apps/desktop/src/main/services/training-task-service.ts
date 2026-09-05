import {
  MAX_ACTIVE_TRAINING_TASKS,
  planTrainingTasks,
  type TrainingCandidate,
  type TrainingTaskDecision
} from '@devreplay/domain'
import { runInTransaction, type AppDatabase } from '../database'

export interface PersistedTrainingTask extends TrainingTaskDecision {
  readonly id: string
}

export class TrainingTaskService {
  constructor(
    private readonly database: AppDatabase,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly nextId: () => string = () => crypto.randomUUID()
  ) {}

  createFromReview(candidates: readonly TrainingCandidate[]): readonly PersistedTrainingTask[] {
    return runInTransaction(this.database.sqlite, () => {
      const { count } = this.database.sqlite
        .prepare("SELECT count(*) AS count FROM training_tasks WHERE status = 'active'")
        .get() as { count: number }
      const decisions = planTrainingTasks(count, candidates)
      const timestamp = this.now()
      const insert = this.database.sqlite.prepare(
        `INSERT INTO training_tasks
         (id, capability_id, interview_id, type, status, priority_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      return Object.freeze(
        decisions.map((decision) => {
          const id = this.nextId()
          insert.run(
            id,
            decision.capabilityId,
            decision.interviewId ?? null,
            decision.type,
            decision.status,
            JSON.stringify({ role: decision.role, priority: decision.priority }),
            timestamp,
            timestamp
          )
          return Object.freeze({ id, ...decision })
        })
      )
    })
  }

  activeCount(): number {
    const { count } = this.database.sqlite
      .prepare("SELECT count(*) AS count FROM training_tasks WHERE status = 'active'")
      .get() as { count: number }
    if (count > MAX_ACTIVE_TRAINING_TASKS) throw new Error('活跃训练任务不变量已损坏')
    return count
  }
}
