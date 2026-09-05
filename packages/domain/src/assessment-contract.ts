export interface AssessmentTestCase {
  readonly name: string
  readonly args: readonly unknown[]
  readonly expected: unknown
}

export type AssessmentContractContent =
  | Readonly<{
      type: 'explanation'
      objective: string
      requiredPoints: readonly string[]
      allowedVariants: readonly string[]
      commonMisconceptions: readonly string[]
      passRule: string
      maxFollowUps: 2
    }>
  | Readonly<{
      type: 'code'
      objective: string
      functionName: string
      language: 'javascript' | 'typescript'
      publicTests: readonly AssessmentTestCase[]
      hiddenTests: readonly AssessmentTestCase[]
      passRule: 'all_tests'
    }>

export interface AssessmentContract {
  readonly id: string
  readonly trainingTaskId: string
  readonly version: number
  readonly content: AssessmentContractContent
  readonly createdAt: string
}
