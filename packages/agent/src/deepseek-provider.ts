import OpenAI from 'openai'
import {
  ModelProviderError,
  type ModelProvider,
  type ModelRequest,
  type ModelRequestOptions,
  type ModelResult
} from './model-provider'

export interface DeepSeekProviderOptions {
  readonly apiKey: string
  readonly baseURL?: string
  readonly timeoutMs?: number
  readonly fetch?: typeof fetch
}

export class DeepSeekProvider implements ModelProvider {
  private readonly client: OpenAI

  constructor(options: DeepSeekProviderOptions) {
    this.client = new OpenAI({
      apiKey: options.apiKey,
      baseURL: options.baseURL ?? 'https://api.deepseek.com',
      timeout: options.timeoutMs ?? 60_000,
      maxRetries: 0,
      ...(options.fetch ? { fetch: options.fetch } : {}),
      logLevel: 'off'
    })
  }

  async complete(request: ModelRequest, options: ModelRequestOptions = {}): Promise<ModelResult> {
    try {
      const completion = await this.client.chat.completions.create(
        {
          model: request.modelId,
          messages: request.messages.map((message) => ({
            role: message.role,
            content: message.content
          })),
          ...(request.temperature === undefined ? {} : { temperature: request.temperature }),
          ...(request.maxTokens === undefined ? {} : { max_tokens: request.maxTokens })
        },
        { signal: options.signal }
      )
      const content = completion.choices[0]?.message.content
      if (typeof content !== 'string') {
        throw new ModelProviderError('invalid_response', 'DeepSeek 响应缺少文本内容')
      }

      return {
        provider: 'deepseek',
        requestId: completion._request_id ?? completion.id,
        modelId: completion.model,
        content,
        finishReason: completion.choices[0]?.finish_reason ?? null,
        usage: {
          inputTokens: completion.usage?.prompt_tokens ?? 0,
          outputTokens: completion.usage?.completion_tokens ?? 0,
          totalTokens: completion.usage?.total_tokens ?? 0
        },
        rawResponse: completion
      }
    } catch (error) {
      throw normalizeDeepSeekError(error)
    }
  }
}

function normalizeDeepSeekError(error: unknown): ModelProviderError {
  if (error instanceof ModelProviderError) return error
  if (error instanceof OpenAI.APIUserAbortError) {
    return new ModelProviderError('cancelled', 'DeepSeek 请求已取消')
  }
  if (error instanceof OpenAI.APIConnectionTimeoutError) {
    return new ModelProviderError('timeout', 'DeepSeek 请求超时')
  }
  if (error instanceof OpenAI.AuthenticationError) {
    return new ModelProviderError('authentication', 'DeepSeek API Key 无效', error.status)
  }
  if (error instanceof OpenAI.RateLimitError) {
    return new ModelProviderError('rate_limit', 'DeepSeek 请求频率受限', error.status)
  }
  if (error instanceof OpenAI.APIConnectionError) {
    return new ModelProviderError('network', '无法连接 DeepSeek')
  }
  if (error instanceof OpenAI.APIError) {
    return new ModelProviderError('provider', 'DeepSeek 服务返回错误', error.status)
  }
  return new ModelProviderError('provider', 'DeepSeek 请求失败')
}
