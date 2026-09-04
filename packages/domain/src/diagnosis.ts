export const DIAGNOSIS_RESOLUTIONS = [
  'unresolved',
  'confirmed',
  'rejected',
  'kept_pending'
] as const
export type DiagnosisResolution = (typeof DIAGNOSIS_RESOLUTIONS)[number]

export interface DiagnosticSignal {
  readonly id: string
  readonly description: string
  readonly specificity: 'vague' | 'specific'
}

export interface DiagnosticHypothesis {
  readonly id: string
  readonly capabilityId: string
  readonly claim: string
  readonly evidence: readonly DiagnosticSignal[]
  readonly alternativeExplanations: readonly string[]
  readonly confidence: 'low' | 'medium' | 'high'
  readonly verificationPlan: string
  readonly resolution: DiagnosisResolution
}

export function createDiagnosticHypothesis(
  input: Omit<DiagnosticHypothesis, 'resolution'>
): DiagnosticHypothesis {
  if (input.evidence.length === 0) throw new Error('诊断假设至少需要一条证据信号')
  if (input.alternativeExplanations.length === 0) throw new Error('诊断假设必须保留其他可能解释')
  if (!input.verificationPlan.trim()) throw new Error('诊断假设必须包含验证方式')

  return Object.freeze({
    ...input,
    evidence: Object.freeze([...input.evidence]),
    alternativeExplanations: Object.freeze([...input.alternativeExplanations]),
    resolution: 'unresolved' as const
  })
}

export function resolveDiagnosticHypothesis(
  hypothesis: DiagnosticHypothesis,
  resolution: Exclude<DiagnosisResolution, 'unresolved'>
): DiagnosticHypothesis {
  if (hypothesis.resolution !== 'unresolved') throw new Error('诊断已经处理，不能静默覆盖')
  return Object.freeze({ ...hypothesis, resolution })
}

export function mayChangeCapabilityState(hypothesis: DiagnosticHypothesis): boolean {
  return hypothesis.resolution === 'confirmed'
}
