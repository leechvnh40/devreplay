import { z } from 'zod'
import type { ModelProvider, ModelRequest, ModelResult } from './model-provider'
import type { ContextManifestItem } from './context-manifest'
import type { PromptVersion } from './prompt-registry'
import { requestStructuredOutput, type StructuredOutputResult } from './structured-output'

export interface ModelRunStart {
  readonly id: string
  readonly interviewId?: string
  readonly prompt: PromptVersion
  readonly provider: 'deepseek'
  readonly modelId: string
  readonly request: unknown
  readonly contextItems?: readonly ContextManifestItem[]
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
  readonly contextItems?: readonly ContextManifestItem[]
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
      ...(input.contextItems ? { contextItems: input.contextItems } : {}),
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

  async runStructured<T>(
    input: AuditedModelRequest,
    schema: z.ZodType<T>
  ): Promise<StructuredOutputResult<T>> {
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
      ...(input.contextItems ? { contextItems: input.contextItems } : {}),
      createdAt: this.now()
    })

    const results: ModelResult[] = []
    const recordingProvider: ModelProvider = {
      complete: async (request, options) => {
        const result = await this.provider.complete(request, options)
        results.push(result)
        return result
      }
    }

    try {
      const structured = await requestStructuredOutput({
        provider: recordingProvider,
        request: input.request,
        schema,
        ...(input.signal ? { signal: input.signal } : {})
      })
      if (!structured.ok) {
        this.auditStore.fail(input.runId, {
          error: {
            kind: structured.errorCode,
            message: structured.message,
            rawOutputs: structured.rawOutputs
          },
          completedAt: this.now()
        })
        return structured
      }

      this.auditStore.succeed(input.runId, {
        rawResponse: results.map((result) => result.rawResponse),
        structuredResult: structured.value,
        usage: results.reduce(
          (usage, result) => ({
            inputTokens: usage.inputTokens + result.usage.inputTokens,
            outputTokens: usage.outputTokens + result.usage.outputTokens,
            totalTokens: usage.totalTokens + result.usage.totalTokens
          }),
          { inputTokens: 0, outputTokens: 0, totalTokens: 0 }
        ),
        completedAt: this.now()
      })
      return structured
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
