import { describe, expect, it } from 'vitest'
import { calculateTrainingPriority, rankTrainingCandidates } from './training-priority'

const baseline = {
  targetRelevance: 50,
  evidenceStrength: 1,
  recurrenceCount: 1,
  impact: 1,
  daysSinceVerified: 7,
  daysUntilInterview: 20,
  estimatedMinutes: 30
}

describe('训练优先级', () => {
  it.each([
    ['targetRelevance', 100],
    ['evidenceStrength', 3],
    ['recurrenceCount', 3],
    ['impact', 3],
    ['daysSinceVerified', 60],
    ['daysUntilInterview', 1],
    ['estimatedMinutes', 15]
  ] as const)('%s 会独立提高优先级', (key, value) => {
    const base = calculateTrainingPriority(baseline)
    const changed = calculateTrainingPriority({ ...baseline, [key]: value })
    expect(changed.score).toBeGreaterThan(base.score)
    expect(changed.factors).toHaveLength(7)
  })

  it('固定版本并保留各因素的可解释贡献', () => {
    const result = calculateTrainingPriority(baseline)
    expect(result.version).toBe(1)
    expect(result.factors.map((item) => item.key)).toEqual([
      'target_relevance',
      'evidence_strength',
      'recurrence',
      'impact',
      'verification_interval',
      'interview_proximity',
      'training_cost'
    ])
  })

  it('尊重置顶、延后和忽略', () => {
    const ordinary = calculateTrainingPriority(baseline)
    const pinned = calculateTrainingPriority({ ...baseline, userOverride: 'pinned' })
    const postponed = calculateTrainingPriority({ ...baseline, userOverride: 'postponed' })
    const ignored = calculateTrainingPriority({ ...baseline, userOverride: 'ignored' })
    expect(
      rankTrainingCandidates([
        { id: 'postponed', priority: postponed },
        { id: 'ordinary', priority: ordinary },
        { id: 'pinned', priority: pinned }
      ]).map((item) => item.id)
    ).toEqual(['pinned', 'ordinary', 'postponed'])
    expect(ignored.score).toBe(Number.NEGATIVE_INFINITY)
  })
})
