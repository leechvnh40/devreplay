import type { AssessmentContract } from './assessment-contract'

export interface ExplanationAssessmentInput {
  readonly coveredRequiredPoints: readonly string[]
  readonly triggeredMisconceptions: readonly string[]
  readonly evidence: readonly string[]
  readonly nextFollowUp?: string
}

export interface ExplanationTurn {
  readonly kind: 'main' | 'follow_up'
  readonly prompt: string
  readonly answer: string
  readonly assessment: ExplanationAssessmentInput
}

export interface ExplanationTrainingState {
  readonly contract: AssessmentContract & {
    readonly content: { readonly type: 'explanation' } & AssessmentContract['content']
  }
  readonly mainPrompt: string
  readonly phase: 'main_answer' | 'follow_up' | 'completed'
  readonly turns: readonly ExplanationTurn[]
  readonly coveredRequiredPoints: readonly string[]
  readonly result?: Readonly<{
    passed: boolean
    evidence: readonly string[]
    missingRequiredPoints: readonly string[]
    triggeredMisconceptions: readonly string[]
  }>
}

export function startExplanationTraining(
  contract: AssessmentContract,
  mainPrompt: string
): ExplanationTrainingState {
  if (contract.content.type !== 'explanation') throw new Error('验收契约不是解释题')
  return Object.freeze({
    contract: contract as ExplanationTrainingState['contract'],
    mainPrompt,
    phase: 'main_answer',
    turns: Object.freeze([]),
    coveredRequiredPoints: Object.freeze([])
  })
}

export function submitExplanationAnswer(
  state: ExplanationTrainingState,
  answer: string,
  assessment: ExplanationAssessmentInput
): ExplanationTrainingState {
  if (state.phase === 'completed') throw new Error('本轮训练已经结束')
  if (!answer.trim()) throw new Error('回答不能为空')
  const contract = state.contract.content
  const invalidPoint = assessment.coveredRequiredPoints.find(
    (point) => !contract.requiredPoints.includes(point)
  )
  const invalidMisconception = assessment.triggeredMisconceptions.find(
    (item) => !contract.commonMisconceptions.includes(item)
  )
  if (invalidPoint || invalidMisconception) throw new Error('评分结果引用了契约外的标准')

  const covered = Object.freeze([
    ...new Set([...state.coveredRequiredPoints, ...assessment.coveredRequiredPoints])
  ])
  const missing = contract.requiredPoints.filter((point) => !covered.includes(point))
  const passed = missing.length === 0 && assessment.triggeredMisconceptions.length === 0
  const followUpCount = state.turns.filter((turn) => turn.kind === 'follow_up').length
  const isFollowUp = state.phase === 'follow_up'
  const exhausted = isFollowUp && followUpCount + 1 >= contract.maxFollowUps
  if (!passed && !exhausted && !assessment.nextFollowUp?.trim()) {
    throw new Error('未通过且仍可追问时必须提供定向追问')
  }
  const prompt = isFollowUp ? (state.turns.at(-1)?.assessment.nextFollowUp ?? '') : state.mainPrompt
  const turns = Object.freeze([
    ...state.turns,
    Object.freeze({
      kind: isFollowUp ? ('follow_up' as const) : ('main' as const),
      prompt,
      answer: answer.trim(),
      assessment
    })
  ])
  const completed = passed || exhausted
  return Object.freeze({
    ...state,
    phase: completed ? 'completed' : 'follow_up',
    turns,
    coveredRequiredPoints: covered,
    ...(completed
      ? {
          result: Object.freeze({
            passed,
            evidence: Object.freeze(turns.flatMap((turn) => turn.assessment.evidence)),
            missingRequiredPoints: Object.freeze(missing),
            triggeredMisconceptions: Object.freeze([
              ...new Set(turns.flatMap((turn) => turn.assessment.triggeredMisconceptions))
            ])
          })
        }
      : {})
  })
}
