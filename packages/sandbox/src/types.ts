export interface SandboxTestCase {
  readonly name: string
  readonly args: readonly unknown[]
  readonly expected: unknown
}

export interface SandboxLimits {
  readonly timeoutMs: number
  readonly memoryLimitBytes: number
  readonly maxOutputChars: number
}

export interface SandboxRequest {
  readonly source: string
  readonly language: 'javascript' | 'typescript'
  readonly functionName: string
  readonly publicTests: readonly SandboxTestCase[]
  readonly hiddenTests: readonly SandboxTestCase[]
  readonly limits?: Partial<SandboxLimits>
}

export interface PublicTestResult {
  readonly name: string
  readonly passed: boolean
  readonly actual?: unknown
  readonly expected: unknown
}

export interface HiddenTestSummary {
  readonly passed: boolean
  readonly category: 'passed' | 'assertion_failed' | 'runtime_error'
}

export type SandboxFailureKind =
  'timeout' | 'memory_limit' | 'output_limit' | 'compile_error' | 'runtime_error'

export interface SandboxResult {
  readonly passed: boolean
  readonly publicResults: readonly PublicTestResult[]
  readonly hiddenResults: readonly HiddenTestSummary[]
  readonly error?: Readonly<{ kind: SandboxFailureKind; message: string }>
}

export const DEFAULT_SANDBOX_LIMITS: SandboxLimits = Object.freeze({
  timeoutMs: 1_000,
  memoryLimitBytes: 16 * 1024 * 1024,
  maxOutputChars: 20_000
})
