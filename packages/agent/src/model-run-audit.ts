import type { ModelProvider, ModelRequest, ModelResult } from './model-provider'
import type { PromptVersion } from './prompt-registry'

export interface ModelRunStart {
  readonly id: string
  readonly interviewId?: string
  readonly prompt: PromptVersion
  readonly provider: 'deepseek'
  readonly modelId: string
  readonly request: unknown
  readonly createdAt: string
}

export interface ModelRunSuccess {
  readonly rawResponse: unknown
  readonly structuredResult: unknown
  readonly usage: ModelResult['usage']
  readonly completedAt: string
}

export interface ModelRunFailure {
  readonly error: unknown
  readonly completedAt: string
}

export interface ModelRunAuditStore {
  start(run: ModelRunStart): void
  succeed(runId: string, result: ModelRunSuccess): void
  fail(runId: string, result: ModelRunFailure): void
}

export interface AuditedModelRequest {
  readonly runId: string
  readonly interviewId?: string
  readonly prompt: PromptVersion
  readonly request: ModelRequest
  readonly requestMetadata?: unknown
  readonly signal?: AbortSignal
}

export class AuditedModelRunner {
  constructor(
    private readonly provider: ModelProvider,
    private readonly auditStore: ModelRunAuditStore,
    private readonly now: () => string = () => new Date().toISOString()
  ) {}

  async run<T>(input: AuditedModelRequest, parse: (content: string) => T): Promise<T> {
    this.auditStore.start({
      id: input.runId,
      ...(input.interviewId ? { interviewId: input.interviewId } : {}),
      prompt: input.prompt,
      provider: 'deepseek',
      modelId: input.request.modelId,
      request: redactSensitiveData({
        modelRequest: input.request,
        metadata: input.requestMetadata
      }),
      createdAt: this.now()
    })

    try {
      const result = await this.provider.complete(
        input.request,
        input.signal ? { signal: input.signal } : undefined
      )
      const structuredResult = parse(result.content)
      this.auditStore.succeed(input.runId, {
        rawResponse: result.rawResponse,
        structuredResult,
        usage: result.usage,
        completedAt: this.now()
      })
      return structuredResult
    } catch (error) {
      this.auditStore.fail(input.runId, {
        error: serializeError(error),
        completedAt: this.now()
      })
      throw error
    }
  }
}

export function redactSensitiveData(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSensitiveData)
  if (typeof value !== 'object' || value === null) return value

  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [
      key,
      /^(authorization|api[-_]?key)$/i.test(key) ? '[REDACTED]' : redactSensitiveData(child)
    ])
  )
}

function serializeError(error: unknown): unknown {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      ...('kind' in error ? { kind: error.kind } : {})
    }
  }
  return { message: String(error) }
}
