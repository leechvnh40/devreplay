import type { DiagnosisResolution } from '@devreplay/domain'
import type { ReviewFlowState } from '@devreplay/shared'
import { type AppDatabase } from '../database'
import { DiagnosticService } from './diagnostic-service'
import { PreconditionError } from './onboarding-service'
import { ReviewCompletionService } from './review-completion-service'

interface StoredQuestion {
  id: string
  question: string
  originalQuestion?: string
  answer: { status: 'known'; value: string } | { status: 'unknown' }
  interviewerFollowUp: { status: 'known'; value: string } | { status: 'unknown' }
  sourceQuote: string
}

export class ReviewFlowService {
  private readonly diagnoses: DiagnosticService
  private readonly completion: ReviewCompletionService

  constructor(
    private readonly database: AppDatabase,
    private readonly now: () => string = () => new Date().toISOString()
  ) {
    this.diagnoses = new DiagnosticService(database, now)
    this.completion = new ReviewCompletionService(database, now)
  }

  recoverInterruptedOperations(): void {
    const sessions = this.database.sqlite
      .prepare("SELECT id, draft_json FROM review_sessions WHERE stage = 'extract_review'")
      .all() as { id: string; draft_json: string }[]
    for (const session of sessions) {
      const draft = JSON.parse(session.draft_json) as Record<string, unknown>
      if (draft.operationStatus !== 'running') continue
      this.database.sqlite
        .prepare(
          `UPDATE review_sessions SET revision = revision + 1, draft_json = ?, updated_at = ?
           WHERE id = ?`
        )
        .run(
          JSON.stringify({
            ...draft,
            operationStatus: 'retryable_error',
            lastError: '上次分析因应用退出而中断，请重试'
          }),
          this.now(),
          session.id
        )
    }
  }

  getState(interviewId: string): ReviewFlowState {
    const session = this.requireSession(interviewId)
    const draft = JSON.parse(session.draft_json) as { freeRecall?: unknown; lastError?: unknown }
    const interview = this.database.sqlite
      .prepare('SELECT company, role, occurred_at, round FROM interviews WHERE id = ?')
      .get(interviewId) as {
      company: string
      role: string
      occurred_at: string
      round: string
    }
    const items = this.database.sqlite
      .prepare(
        `SELECT id, content_json, source_type, source_id, status
         FROM review_items WHERE review_session_id = ? ORDER BY created_at, id`
      )
      .all(session.id)
      .map((raw) => {
        const row = raw as {
          id: string
          content_json: string
          source_type: ReviewFlowState['items'][number]['sourceType']
          source_id: string | null
          status: string
        }
        const content = JSON.parse(row.content_json) as StoredQuestion
        return {
          id: row.id,
          question: content.question,
          ...(content.originalQuestion ? { originalQuestion: content.originalQuestion } : {}),
          answer: content.answer,
          sourceType: row.source_type,
          ...(row.source_id ? { sourceId: row.source_id } : {}),
          status: row.status
        }
      })
    const diagnoses = this.database.sqlite
      .prepare(
        `SELECT id, capability_id, claim, evidence_json, alternatives_json, confidence,
                verification_plan, resolution
         FROM diagnostic_hypotheses WHERE review_session_id = ? ORDER BY created_at, id`
      )
      .all(session.id)
      .map((raw) => {
        const row = raw as {
          id: string
          capability_id: string
          claim: string
          evidence_json: string
          alternatives_json: string
          confidence: 'low' | 'medium' | 'high'
          verification_plan: string
          resolution: DiagnosisResolution
        }
        return {
          id: row.id,
          capabilityId: row.capability_id,
          claim: row.claim,
          evidence: JSON.parse(
            row.evidence_json
          ) as ReviewFlowState['diagnoses'][number]['evidence'],
          alternativeExplanations: JSON.parse(
            row.alternatives_json
          ) as ReviewFlowState['diagnoses'][number]['alternativeExplanations'],
          confidence: row.confidence,
          verificationPlan: row.verification_plan,
          resolution: row.resolution
        }
      })
    const evidence = this.database.sqlite
      .prepare(
        `SELECT id, capability_id, source_type, polarity, strength, content_json, created_at
         FROM evidence_entries WHERE interview_id = ? ORDER BY created_at, id`
      )
      .all(interviewId)
      .map((raw) => {
        const row = raw as {
          id: string
          capability_id: string
          source_type: string
          polarity: 'positive' | 'negative' | 'neutral'
          strength: number
          content_json: string
          created_at: string
        }
        return {
          id: row.id,
          capabilityId: row.capability_id,
          sourceType: row.source_type,
          polarity: row.polarity,
          strength: row.strength,
          summary: this.evidenceSummary(row.content_json),
          createdAt: row.created_at
        }
      })

    return {
      interviewId,
      interview: {
        company: interview.company,
        role: interview.role,
        occurredAt: interview.occurred_at,
        round: interview.round
      },
      stage: session.stage as ReviewFlowState['stage'],
      operationStatus: this.operationStatus(draft),
      ...(typeof draft.lastError === 'string' ? { lastError: draft.lastError } : {}),
      freeRecall: typeof draft.freeRecall === 'string' ? draft.freeRecall : '',
      items,
      diagnoses,
      evidence
    }
  }

  reviseItem(interviewId: string, itemId: string, question: string): ReviewFlowState {
    if (!question.trim()) throw new PreconditionError('复盘题目不能为空')
    const row = this.requireItem(interviewId, itemId)
    const content = JSON.parse(row.content_json) as StoredQuestion
    const timestamp = this.now()
    this.database.sqlite
      .prepare(
        `UPDATE review_items SET content_json = ?, source_type = 'user_revision',
         status = 'confirmed', updated_at = ? WHERE id = ?`
      )
      .run(
        JSON.stringify({
          ...content,
          originalQuestion: content.originalQuestion ?? content.question,
          question: question.trim()
        }),
        timestamp,
        itemId
      )
    return this.getState(interviewId)
  }

  answerQuestion(
    interviewId: string,
    itemId: string,
    answer: string,
    unknown: boolean
  ): ReviewFlowState {
    if (!unknown && !answer.trim()) throw new PreconditionError('请填写回答或明确标记为未知')
    const row = this.requireItem(interviewId, itemId)
    const content = JSON.parse(row.content_json) as StoredQuestion
    this.database.sqlite
      .prepare('UPDATE review_items SET content_json = ?, status = ?, updated_at = ? WHERE id = ?')
      .run(
        JSON.stringify({
          ...content,
          answer: unknown ? { status: 'unknown' } : { status: 'known', value: answer.trim() }
        }),
        unknown ? 'unknown' : 'answered',
        this.now(),
        itemId
      )
    return this.getState(interviewId)
  }

  finishQuestions(interviewId: string): ReviewFlowState {
    const state = this.getState(interviewId)
    if (state.stage !== 'targeted_questions') {
      throw new PreconditionError('当前复盘阶段不能结束追问')
    }
    if (state.items.length === 0 || state.items.some((item) => item.status === 'candidate')) {
      throw new PreconditionError('请回答关键题目或明确标记为未知')
    }
    this.updateStage(interviewId, 'user_resolution')
    return this.getState(interviewId)
  }

  resolveDiagnosis(
    interviewId: string,
    diagnosisId: string,
    resolution: Exclude<DiagnosisResolution, 'unresolved'>
  ): ReviewFlowState {
    const session = this.requireSession(interviewId)
    if (session.stage !== 'user_resolution') {
      throw new PreconditionError('当前复盘阶段不能处理诊断')
    }
    const belongs = this.database.sqlite
      .prepare('SELECT 1 FROM diagnostic_hypotheses WHERE id = ? AND review_session_id = ?')
      .get(diagnosisId, session.id)
    if (!belongs) throw new PreconditionError('诊断假设不存在')
    this.diagnoses.resolve(diagnosisId, resolution)
    const unresolved = this.database.sqlite
      .prepare(
        `SELECT count(*) AS count FROM diagnostic_hypotheses
         WHERE review_session_id = ? AND resolution = 'unresolved'`
      )
      .get(session.id) as { count: number }
    if (unresolved.count === 0) this.updateStage(interviewId, 'evidence_preview')
    return this.getState(interviewId)
  }

  skipEmptyDiagnosisResolution(interviewId: string): ReviewFlowState {
    const state = this.getState(interviewId)
    if (state.stage !== 'user_resolution' || state.diagnoses.length !== 0) {
      throw new PreconditionError('只有没有诊断候选时才能跳过诊断处理')
    }
    this.updateStage(interviewId, 'evidence_preview')
    return this.getState(interviewId)
  }

  acknowledgeEvidence(interviewId: string): ReviewFlowState {
    const session = this.requireSession(interviewId)
    if (session.stage !== 'evidence_preview') {
      throw new PreconditionError('当前复盘阶段不能确认正式证据')
    }
    const draft = JSON.parse(session.draft_json) as Record<string, unknown>
    this.database.sqlite
      .prepare(
        `UPDATE review_sessions SET stage = 'training_decision', revision = revision + 1,
         draft_json = ?, updated_at = ? WHERE id = ?`
      )
      .run(JSON.stringify({ ...draft, evidencePreviewAcknowledged: true }), this.now(), session.id)
    return this.getState(interviewId)
  }

  completeWithoutTraining(interviewId: string, reason: string): ReviewFlowState {
    const state = this.getState(interviewId)
    this.completion.complete(interviewId, {
      keyQuestions: state.items.map((item) =>
        item.status === 'answered' ? 'answered' : item.status === 'unknown' ? 'unknown' : 'missing'
      ),
      trainingDecision: { kind: 'no_training', reason },
      evidencePreviewAcknowledged: true
    })
    return this.getState(interviewId)
  }

  private requireSession(interviewId: string): {
    id: string
    stage: string
    draft_json: string
  } {
    const session = this.database.sqlite
      .prepare('SELECT id, stage, draft_json FROM review_sessions WHERE interview_id = ?')
      .get(interviewId) as { id: string; stage: string; draft_json: string } | undefined
    if (!session) throw new PreconditionError('复盘会话不存在')
    return session
  }

  private requireItem(interviewId: string, itemId: string): { content_json: string } {
    const session = this.requireSession(interviewId)
    const item = this.database.sqlite
      .prepare('SELECT content_json FROM review_items WHERE id = ? AND review_session_id = ?')
      .get(itemId, session.id) as { content_json: string } | undefined
    if (!item) throw new PreconditionError('复盘题目不存在')
    return item
  }

  private updateStage(interviewId: string, stage: string): void {
    const session = this.requireSession(interviewId)
    this.database.sqlite
      .prepare(
        'UPDATE review_sessions SET stage = ?, revision = revision + 1, updated_at = ? WHERE id = ?'
      )
      .run(stage, this.now(), session.id)
  }

  private operationStatus(draft: { [key: string]: unknown }): ReviewFlowState['operationStatus'] {
    return draft.operationStatus === 'running' || draft.operationStatus === 'retryable_error'
      ? draft.operationStatus
      : 'idle'
  }

  private evidenceSummary(contentJson: string): string {
    const content = JSON.parse(contentJson) as { claim?: unknown; summary?: unknown }
    if (typeof content.claim === 'string') return content.claim
    if (typeof content.summary === 'string') return content.summary
    return '已确认的能力证据'
  }
}
