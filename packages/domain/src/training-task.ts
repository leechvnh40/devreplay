import type { TrainingPriority } from './training-priority'
import { rankTrainingCandidates } from './training-priority'

export const MAX_ACTIVE_TRAINING_TASKS = 3 as const
export const TRAINING_TASK_TYPES = ['explanation', 'code'] as const
export type TrainingTaskType = (typeof TRAINING_TASK_TYPES)[number]
export type TrainingTaskStatus = 'active' | 'queued' | 'completed' | 'cancelled'
export type TrainingTaskRole = 'main' | 'candidate'

export interface TrainingCandidate {
  readonly capabilityId: string
  readonly interviewId?: string
  readonly type: TrainingTaskType
  readonly priority: TrainingPriority
}

export interface TrainingTaskDecision extends TrainingCandidate {
  readonly role: TrainingTaskRole
  readonly status: Extract<TrainingTaskStatus, 'active' | 'queued'>
}

export function planTrainingTasks(
  activeTaskCount: number,
  candidates: readonly TrainingCandidate[]
): readonly TrainingTaskDecision[] {
  if (!Number.isInteger(activeTaskCount) || activeTaskCount < 0) {
    throw new Error('活跃训练数量无效')
  }
  const ranked = rankTrainingCandidates(candidates).filter(
    (candidate) => candidate.priority.userOverride !== 'ignored'
  )
  const canActivateMain = activeTaskCount < MAX_ACTIVE_TRAINING_TASKS

  return Object.freeze(
    ranked.map((candidate, index) =>
      Object.freeze({
        ...candidate,
        role: index === 0 && canActivateMain ? 'main' : 'candidate',
        status: index === 0 && canActivateMain ? 'active' : 'queued'
      })
    )
  )
}
