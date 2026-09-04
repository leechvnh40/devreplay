import { requireNonEmpty, type InterviewId } from './ids'
import type { JobDescriptionSnapshot, ResumeSnapshot } from './snapshots'

export interface Interview {
  readonly id: InterviewId
  readonly company: string
  readonly role: string
  readonly occurredAt: string
  readonly round: string
  readonly resumeSnapshot: ResumeSnapshot
  readonly jobDescriptionSnapshot?: JobDescriptionSnapshot
  readonly createdAt: string
}

export function createInterview(input: Interview): Interview {
  if (!Object.isFrozen(input.resumeSnapshot)) {
    throw new Error('面试必须绑定由领域层创建的不可变简历快照')
  }

  if (input.jobDescriptionSnapshot && !Object.isFrozen(input.jobDescriptionSnapshot)) {
    throw new Error('JD 快照必须不可变')
  }

  return Object.freeze({
    id: requireNonEmpty(input.id, '面试 ID'),
    company: requireNonEmpty(input.company, '公司'),
    role: requireNonEmpty(input.role, '岗位'),
    occurredAt: requireNonEmpty(input.occurredAt, '面试时间'),
    round: requireNonEmpty(input.round, '轮次'),
    resumeSnapshot: input.resumeSnapshot,
    ...(input.jobDescriptionSnapshot
      ? { jobDescriptionSnapshot: input.jobDescriptionSnapshot }
      : {}),
    createdAt: requireNonEmpty(input.createdAt, '创建时间')
  })
}
