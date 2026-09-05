import { describe, expect, it } from 'vitest'
import { calculateTrainingPriority } from './training-priority'
import { MAX_ACTIVE_TRAINING_TASKS, planTrainingTasks } from './training-task'

function candidate(capabilityId: string, relevance: number) {
  return {
    capabilityId,
    type: 'explanation' as const,
    priority: calculateTrainingPriority({
      targetRelevance: relevance,
      evidenceStrength: 2,
      recurrenceCount: 1,
      impact: 2,
      daysSinceVerified: 30,
      estimatedMinutes: 20
    })
  }
}

describe('训练任务规划', () => {
  it('只激活最高优先级主任务，其余进入候选队列', () => {
    const result = planTrainingTasks(1, [candidate('low', 20), candidate('high', 90)])
    expect(
      result.map(({ capabilityId, role, status }) => ({ capabilityId, role, status }))
    ).toEqual([
      { capabilityId: 'high', role: 'main', status: 'active' },
      { capabilityId: 'low', role: 'candidate', status: 'queued' }
    ])
  })

  it('已有三个活跃任务时全部进入候选队列', () => {
    const result = planTrainingTasks(MAX_ACTIVE_TRAINING_TASKS, [candidate('next', 90)])
    expect(result[0]).toMatchObject({ role: 'candidate', status: 'queued' })
  })
})
