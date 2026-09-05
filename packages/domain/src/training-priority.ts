export const TRAINING_PRIORITY_VERSION = 1 as const

export interface TargetCapabilityWeight {
  readonly targetProfileId: string
  readonly capabilityId: string
  readonly relevance: number
}

export interface TrainingPriorityInput {
  readonly targetRelevance: number
  readonly evidenceStrength: number
  readonly recurrenceCount: number
  readonly impact: number
  readonly daysSinceVerified: number
  readonly daysUntilInterview?: number
  readonly estimatedMinutes: number
  readonly userOverride?: 'pinned' | 'postponed' | 'ignored'
}

export interface TrainingPriorityFactor {
  readonly key:
    | 'target_relevance'
    | 'evidence_strength'
    | 'recurrence'
    | 'impact'
    | 'verification_interval'
    | 'interview_proximity'
    | 'training_cost'
  readonly normalized: number
  readonly contribution: number
  readonly label: string
}

export interface TrainingPriority {
  readonly version: typeof TRAINING_PRIORITY_VERSION
  readonly score: number
  readonly factors: readonly TrainingPriorityFactor[]
  readonly userOverride?: TrainingPriorityInput['userOverride']
}

const weights = Object.freeze({
  target_relevance: 24,
  evidence_strength: 18,
  recurrence: 16,
  impact: 16,
  verification_interval: 10,
  interview_proximity: 10,
  training_cost: 6
})

function clamp(value: number, minimum = 0, maximum = 1): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function factor(
  key: TrainingPriorityFactor['key'],
  normalized: number,
  label: string
): TrainingPriorityFactor {
  const value = clamp(normalized)
  return Object.freeze({
    key,
    normalized: value,
    contribution: Math.round(value * weights[key] * 100) / 100,
    label
  })
}

export function calculateTrainingPriority(input: TrainingPriorityInput): TrainingPriority {
  const factors = Object.freeze([
    factor('target_relevance', input.targetRelevance / 100, '目标岗位相关度'),
    factor('evidence_strength', input.evidenceStrength / 3, '缺口证据强度'),
    factor('recurrence', input.recurrenceCount / 3, '重复出现次数'),
    factor('impact', input.impact / 3, '面试影响程度'),
    factor('verification_interval', input.daysSinceVerified / 60, '距上次验证时间'),
    factor(
      'interview_proximity',
      input.daysUntilInterview === undefined ? 0 : (14 - input.daysUntilInterview) / 14,
      '临近面试程度'
    ),
    factor('training_cost', (45 - input.estimatedMinutes) / 30, '短时训练收益')
  ])
  const baseScore = factors.reduce((sum, item) => sum + item.contribution, 0)
  const overrideScore =
    input.userOverride === 'pinned'
      ? 1_000 + baseScore
      : input.userOverride === 'postponed'
        ? -100 + baseScore
        : input.userOverride === 'ignored'
          ? Number.NEGATIVE_INFINITY
          : baseScore

  return Object.freeze({
    version: TRAINING_PRIORITY_VERSION,
    score: Math.round(overrideScore * 100) / 100,
    factors,
    ...(input.userOverride ? { userOverride: input.userOverride } : {})
  })
}

export function rankTrainingCandidates<T extends { readonly priority: TrainingPriority }>(
  candidates: readonly T[]
): readonly T[] {
  return Object.freeze(
    [...candidates].sort((left, right) => right.priority.score - left.priority.score)
  )
}
