export interface TrainingAssessmentResult {
  readonly passed: boolean
  readonly evidence: readonly string[]
  readonly reason: string
}

export interface TrainingAttemptRecord {
  readonly id: string
  readonly trainingTaskId: string
  readonly assessmentContractId: string
  readonly answer: string
  readonly initial: TrainingAssessmentResult
  readonly review?: Readonly<{
    result: TrainingAssessmentResult
    requestedReason: string
    createdAt: string
  }>
  readonly createdAt: string
}
