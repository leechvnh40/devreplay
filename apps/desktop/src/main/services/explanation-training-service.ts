import type { AssessmentContractContent, TrainingAssessmentResult } from '@devreplay/domain'
import type { IpcResponseData } from '@devreplay/shared'
import type { AppDatabase } from '../database'
import { PreconditionError } from './onboarding-service'
import { TrainingAttemptService } from './training-attempt-service'
import { TrainingEvidenceService } from './training-evidence-service'

interface ExplanationRow {
  priority_json: string
  contract_id: string
  version: number
  contract_json: string
}

export class ExplanationTrainingService {
  private readonly attempts: TrainingAttemptService
  private readonly evidence: TrainingEvidenceService

  constructor(
    private readonly database: AppDatabase,
    now: () => string = () => new Date().toISOString(),
    nextId: () => string = () => crypto.randomUUID()
  ) {
    this.attempts = new TrainingAttemptService(database, now, nextId)
    this.evidence = new TrainingEvidenceService(database, now, nextId)
  }

  getTask(trainingTaskId: string): IpcResponseData<'training.get-explanation-task'> {
    const row = this.require(trainingTaskId)
    const content = JSON.parse(row.contract_json) as AssessmentContractContent
    if (content.type !== 'explanation') throw new PreconditionError('训练任务不是解释题')
    const presentation = JSON.parse(row.priority_json) as { title?: string; prompt?: string }
    return {
      id: trainingTaskId,
      title: presentation.title ?? '解释训练',
      prompt: presentation.prompt ?? content.objective,
      assessmentContractId: row.contract_id,
      assessmentContractVersion: row.version,
      requiredPointCount: content.requiredPoints.length
    }
  }

  submit(trainingTaskId: string, answer: string): IpcResponseData<'training.submit-explanation'> {
    if (!answer.trim()) throw new PreconditionError('回答不能为空')
    const row = this.require(trainingTaskId)
    const content = JSON.parse(row.contract_json) as AssessmentContractContent
    if (content.type !== 'explanation') throw new PreconditionError('训练任务不是解释题')
    const normalized = answer.toLowerCase()
    const covered = content.requiredPoints.filter((point) =>
      normalized.includes(point.toLowerCase())
    )
    const misconceptions = content.commonMisconceptions.filter((item) =>
      normalized.includes(item.toLowerCase())
    )
    const passed = covered.length === content.requiredPoints.length && misconceptions.length === 0
    const missing = content.requiredPoints.filter((point) => !covered.includes(point))
    const assessment: TrainingAssessmentResult = {
      passed,
      evidence: covered.map((point) => `回答覆盖：${point}`),
      reason: passed ? '覆盖全部契约必需点且未触发关键误解' : `仍缺少：${missing.join('、')}`
    }
    const attempt = this.attempts.record(trainingTaskId, row.contract_id, answer, assessment)
    const projection = this.evidence.record({
      trainingTaskId,
      sourceId: attempt.id,
      kind: 'initial_training',
      passed
    })
    if (passed)
      this.database.sqlite
        .prepare("UPDATE training_tasks SET status = 'completed', updated_at = ? WHERE id = ?")
        .run(attempt.createdAt, trainingTaskId)
    const schedule = this.database.sqlite
      .prepare(
        "SELECT due_date FROM review_schedules WHERE training_task_id = ? AND status = 'scheduled' ORDER BY due_date LIMIT 1"
      )
      .get(trainingTaskId) as { due_date: string } | undefined
    return {
      attemptId: attempt.id,
      passed,
      evidence: [...assessment.evidence],
      reason: assessment.reason,
      capabilityState: projection.state,
      ...(schedule ? { retestDueDate: schedule.due_date } : {})
    }
  }

  private require(trainingTaskId: string): ExplanationRow {
    const row = this.database.sqlite
      .prepare(
        `SELECT t.priority_json, c.id AS contract_id, c.version, c.contract_json
       FROM training_tasks t JOIN assessment_contracts c ON c.training_task_id = t.id
       WHERE t.id = ? AND t.type = 'explanation' ORDER BY c.version DESC LIMIT 1`
      )
      .get(trainingTaskId) as ExplanationRow | undefined
    if (!row) throw new PreconditionError('解释训练或验收契约不存在')
    return row
  }
}
