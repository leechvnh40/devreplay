import type { InterviewId } from './ids'
import type { Interview } from './interview'

export interface InterviewRepository {
  save(interview: Interview): void
  findById(id: InterviewId): Interview | undefined
  list(): readonly Interview[]
}
