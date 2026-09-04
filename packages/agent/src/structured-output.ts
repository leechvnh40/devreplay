import { z } from 'zod'
import type { ModelProvider, ModelRequest } from './model-provider'

export type StructuredOutputResult<T> =
  | {
      readonly ok: true
      readonly value: T
      readonly attempts: 1 | 2
      readonly rawOutputs: readonly string[]
    }
  | {
      readonly ok: false
      readonly errorCode: 'invalid_structured_output'
      readonly message: string
      readonly attempts: 2
      readonly rawOutputs: readonly string[]
    }

export async function requestStructuredOutput<T>(input: {
  provider: ModelProvider
  request: ModelRequest
  schema: z.ZodType<T>
  signal?: AbortSignal
}): Promise<StructuredOutputResult<T>> {
  const rawOutputs: string[] = []
  const first = await input.provider.complete(
    input.request,
    input.signal ? { signal: input.signal } : undefined
  )
  rawOutputs.push(first.content)

  const firstParse = parse(first.content, input.schema)
  if (firstParse.success) {
    return { ok: true, value: firstParse.data, attempts: 1, rawOutputs }
  }

  const repairRequest: ModelRequest = {
    ...input.request,
    messages: [
      ...input.request.messages,
      { role: 'assistant', content: first.content },
      {
        role: 'user',
        content: `上一次输出不符合 JSON schema。只返回修正后的 JSON，不要解释。校验错误：${z.prettifyError(firstParse.error)}`
      }
    ]
  }
  const second = await input.provider.complete(
    repairRequest,
    input.signal ? { signal: input.signal } : undefined
  )
  rawOutputs.push(second.content)
  const secondParse = parse(second.content, input.schema)
  if (secondParse.success) {
    return { ok: true, value: secondParse.data, attempts: 2, rawOutputs }
  }

  return {
    ok: false,
    errorCode: 'invalid_structured_output',
    message: 'DeepSeek 两次输出均不符合复盘结构，可保留草稿后重试。',
    attempts: 2,
    rawOutputs
  }
}

function parse<T>(content: string, schema: z.ZodType<T>): z.ZodSafeParseResult<T> {
  try {
    return schema.safeParse(JSON.parse(content) as unknown)
  } catch {
    return schema.safeParse(undefined)
  }
}
