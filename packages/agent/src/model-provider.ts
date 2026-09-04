export type ModelMessageRole = 'system' | 'user' | 'assistant'

export interface ModelMessage {
  readonly role: ModelMessageRole
  readonly content: string
}

export interface ModelRequest {
  readonly modelId: string
  readonly messages: readonly ModelMessage[]
  readonly temperature?: number
  readonly maxTokens?: number
}

export interface ModelUsage {
  readonly inputTokens: number
  readonly outputTokens: number
  readonly totalTokens: number
}

export interface ModelResult {
  readonly provider: 'deepseek'
  readonly requestId: string
  readonly modelId: string
  readonly content: string
  readonly finishReason: string | null
  readonly usage: ModelUsage
  readonly rawResponse: unknown
}

export interface ModelRequestOptions {
  readonly signal?: AbortSignal
}

export interface ModelProvider {
  complete(request: ModelRequest, options?: ModelRequestOptions): Promise<ModelResult>
}

export type ModelProviderErrorKind =
  | 'authentication'
  | 'rate_limit'
  | 'timeout'
  | 'cancelled'
  | 'network'
  | 'provider'
  | 'invalid_response'

export class ModelProviderError extends Error {
  constructor(
    readonly kind: ModelProviderErrorKind,
    message: string,
    readonly status?: number
  ) {
    super(message)
    this.name = 'ModelProviderError'
  }
}
