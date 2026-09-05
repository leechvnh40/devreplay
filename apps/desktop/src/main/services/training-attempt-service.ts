import type { TrainingAssessmentResult, TrainingAttemptRecord } from '@devreplay/domain'
import { runInTransaction, type AppDatabase } from '../database'
import { PreconditionError } from './onboarding-service'

interface AttemptRow {
  id: string
  training_task_id: string
  assessment_contract_id: string
  answer: string
  result_json: string
  created_at: string
}

interface StoredResult {
  initial: TrainingAssessmentResult
  review?: TrainingAttemptRecord['review']
}

export class TrainingAttemptService {
  constructor(
    private readonly database: AppDatabase,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly nextId: () => string = () => crypto.randomUUID()
  ) {}

  record(
    trainingTaskId: string,
    assessmentContractId: string,
    answer: string,
    initial: TrainingAssessmentResult
  ): TrainingAttemptRecord {
    return runInTransaction(this.database.sqlite, () => {
      const contract = this.database.sqlite
        .prepare('SELECT id FROM assessment_contracts WHERE id = ? AND training_task_id = ?')
        .get(assessmentContractId, trainingTaskId)
      if (!contract) throw new PreconditionError('验收契约与训练任务不匹配')
      const id = this.nextId()
      const createdAt = this.now()
      this.database.sqlite
        .prepare(
          `INSERT INTO training_attempts
           (id, training_task_id, assessment_contract_id, answer, result_json, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .run(
          id,
          trainingTaskId,
          assessmentContractId,
          answer,
          JSON.stringify({ initial }),
          createdAt
        )
      return Object.freeze({
        id,
        trainingTaskId,
        assessmentContractId,
        answer,
        initial,
        createdAt
      })
    })
  }

  review(
    attemptId: string,
    requestedReason: string,
    result: TrainingAssessmentResult
  ): TrainingAttemptRecord {
    return runInTransaction(this.database.sqlite, () => {
      const row = this.requireRow(attemptId)
      const stored = JSON.parse(row.result_json) as StoredResult
      if (stored.review) throw new PreconditionError('每次训练尝试只能复核一次')
      const review = Object.freeze({
        result,
        requestedReason: requestedReason.trim(),
        createdAt: this.now()
      })
      this.database.sqlite
        .prepare('UPDATE training_attempts SET result_json = ? WHERE id = ?')
        .run(JSON.stringify({ ...stored, review }), attemptId)
      return this.map({ ...row, result_json: JSON.stringify({ ...stored, review }) })
    })
  }

  get(attemptId: string): TrainingAttemptRecord {
    return this.map(this.requireRow(attemptId))
  }

  private requireRow(attemptId: string): AttemptRow {
    const row = this.database.sqlite
      .prepare(
        `SELECT id, training_task_id, assessment_contract_id, answer, result_json, created_at
         FROM training_attempts WHERE id = ?`
      )
      .get(attemptId) as AttemptRow | undefined
    if (!row) throw new PreconditionError('训练尝试不存在')
    return row
  }

  private map(row: AttemptRow): TrainingAttemptRecord {
    const stored = JSON.parse(row.result_json) as StoredResult
    return Object.freeze({
      id: row.id,
      trainingTaskId: row.training_task_id,
      assessmentContractId: row.assessment_contract_id,
      answer: row.answer,
      initial: stored.initial,
      ...(stored.review ? { review: stored.review } : {}),
      createdAt: row.created_at
    })
  }
}
