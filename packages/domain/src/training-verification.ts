export type TrainingVerificationEvent =
  | 'initial_pass'
  | 'initial_fail'
  | 'spaced_retest_pass'
  | 'spaced_retest_fail'
  | 'real_interview_pass'
  | 'real_interview_fail'

export interface TrainingVerificationState {
  readonly status: 'active' | 'awaiting_retest' | 'retraining' | 'verified'
  readonly history: readonly TrainingVerificationEvent[]
}

export function initialTrainingVerificationState(): TrainingVerificationState {
  return Object.freeze({ status: 'active', history: Object.freeze([]) })
}

export function applyTrainingVerificationEvent(
  state: TrainingVerificationState,
  event: TrainingVerificationEvent
): TrainingVerificationState {
  if (state.status === 'verified') throw new Error('已经验证的训练不能静默回退')
  const status: TrainingVerificationState['status'] =
    event === 'initial_pass'
      ? 'awaiting_retest'
      : event === 'spaced_retest_pass' || event === 'real_interview_pass'
        ? 'verified'
        : 'retraining'
  return Object.freeze({ status, history: Object.freeze([...state.history, event]) })
}

export interface ConfirmedGapOutcome {
  readonly gapId: string
  readonly confirmed: boolean
  readonly firstTrainingPassed: boolean
  readonly followUpValidation: 'none' | 'spaced_retest_pass' | 'real_interview_pass'
}

export interface GapClosureRate {
  readonly confirmedGapCount: number
  readonly trainedGapCount: number
  readonly closedGapCount: number
  readonly rate: number
}

export function calculateGapClosureRate(gaps: readonly ConfirmedGapOutcome[]): GapClosureRate {
  const confirmed = gaps.filter((gap) => gap.confirmed)
  const trained = confirmed.filter((gap) => gap.firstTrainingPassed)
  const closed = trained.filter((gap) => gap.followUpValidation !== 'none')
  return Object.freeze({
    confirmedGapCount: confirmed.length,
    trainedGapCount: trained.length,
    closedGapCount: closed.length,
    rate: confirmed.length === 0 ? 0 : closed.length / confirmed.length
  })
}
