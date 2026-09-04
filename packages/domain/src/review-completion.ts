import type { DiagnosisResolution } from './diagnosis'

export type KeyQuestionStatus = 'answered' | 'unknown' | 'missing'

export type TrainingDecision =
  | { readonly kind: 'task'; readonly taskId: string }
  | { readonly kind: 'no_training'; readonly reason: string }

export interface ReviewCompletionChecklist {
  readonly basicInfoComplete: boolean
  readonly freeRecallComplete: boolean
  readonly keyQuestions: readonly KeyQuestionStatus[]
  readonly diagnosisResolutions: readonly DiagnosisResolution[]
  readonly trainingDecision: TrainingDecision | undefined
  readonly evidencePreviewAcknowledged: boolean
}

export interface ReviewCompletionResult {
  readonly complete: boolean
  readonly missing: readonly string[]
}

export function evaluateReviewCompletion(
  checklist: ReviewCompletionChecklist
): ReviewCompletionResult {
  const missing: string[] = []
  if (!checklist.basicInfoComplete) missing.push('基本信息')
  if (!checklist.freeRecallComplete) missing.push('自由回忆')
  if (checklist.keyQuestions.length === 0 || checklist.keyQuestions.includes('missing')) {
    missing.push('关键题目记录')
  }
  if (checklist.diagnosisResolutions.includes('unresolved')) missing.push('诊断处理')
  if (!validTrainingDecision(checklist.trainingDecision)) missing.push('训练决策')
  if (!checklist.evidencePreviewAcknowledged) missing.push('证据预览')
  return Object.freeze({ complete: missing.length === 0, missing: Object.freeze(missing) })
}

function validTrainingDecision(decision: TrainingDecision | undefined): boolean {
  if (!decision) return false
  return decision.kind === 'task'
    ? Boolean(decision.taskId.trim())
    : Boolean(decision.reason.trim())
}
