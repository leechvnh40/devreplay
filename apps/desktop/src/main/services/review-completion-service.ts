import {
  evaluateReviewCompletion,
  type DiagnosisResolution,
  type KeyQuestionStatus,
  type TrainingDecision
} from '@devreplay/domain'
import { runInTransaction, type AppDatabase } from '../database'
import { PreconditionError } from './onboarding-service'

export interface CompleteReviewInput {
  readonly keyQuestions: readonly KeyQuestionStatus[]
  readonly trainingDecision: TrainingDecision
  readonly evidencePreviewAcknowledged: boolean
}

export class ReviewCompletionService {
  constructor(
    private readonly database: AppDatabase,
    private readonly now: () => string = () => new Date().toISOString()
  ) {}

  complete(interviewId: string, input: CompleteReviewInput): void {
    runInTransaction(this.database.sqlite, () => {
      const interview = this.database.sqlite
        .prepare('SELECT company, role, occurred_at, round FROM interviews WHERE id = ?')
        .get(interviewId) as
        { company: string; role: string; occurred_at: string; round: string } | undefined
      const session = this.database.sqlite
        .prepare('SELECT id, stage, draft_json FROM review_sessions WHERE interview_id = ?')
        .get(interviewId) as { id: string; stage: string; draft_json: string } | undefined
      if (!interview || !session) throw new PreconditionError('复盘会话不存在')
      if (session.stage !== 'training_decision') {
        throw new PreconditionError('复盘尚未进入训练决策阶段')
      }

      const draft = JSON.parse(session.draft_json) as { freeRecall?: unknown }
      const diagnoses = this.database.sqlite
        .prepare('SELECT resolution FROM diagnostic_hypotheses WHERE review_session_id = ?')
        .all(session.id)
        .map((row) => (row as { resolution: DiagnosisResolution }).resolution)
      const result = evaluateReviewCompletion({
        basicInfoComplete: [
          interview.company,
          interview.role,
          interview.occurred_at,
          interview.round
        ].every((value) => value.trim().length > 0),
        freeRecallComplete:
          typeof draft.freeRecall === 'string' && draft.freeRecall.trim().length > 0,
        keyQuestions: input.keyQuestions,
        diagnosisResolutions: diagnoses,
        trainingDecision: input.trainingDecision,
        evidencePreviewAcknowledged: input.evidencePreviewAcknowledged
      })
      if (!result.complete) {
        throw new PreconditionError(`复盘尚未满足完成门槛：${result.missing.join('、')}`)
      }

      const completedAt = this.now()
      this.database.sqlite
        .prepare(
          `UPDATE review_sessions
           SET stage = 'completed', revision = revision + 1, draft_json = ?, updated_at = ?
           WHERE id = ?`
        )
        .run(JSON.stringify({ ...draft, completion: input }), completedAt, session.id)
    })
  }
}
