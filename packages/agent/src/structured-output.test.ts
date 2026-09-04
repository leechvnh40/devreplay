import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { ModelProvider, ModelRequest, ModelResult } from './model-provider'
import { reviewExtractionSchema, targetedQuestionsSchema } from './review-schemas'
import { requestStructuredOutput } from './structured-output'

function fixture(name: string): string {
  const document = JSON.parse(
    readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8')
  ) as { content: string }
  return document.content
}

class FixtureProvider implements ModelProvider {
  readonly requests: ModelRequest[] = []

  constructor(private readonly outputs: string[]) {}

  async complete(request: ModelRequest): Promise<ModelResult> {
    this.requests.push(request)
    const content = this.outputs.shift()
    if (content === undefined) throw new Error('fixture output exhausted')
    return {
      provider: 'deepseek',
      requestId: `request-${this.requests.length}`,
      modelId: request.modelId,
      content,
      finishReason: 'stop',
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      rawResponse: { content }
    }
  }
}

const request: ModelRequest = {
  modelId: 'deepseek-chat',
  messages: [{ role: 'user', content: '自由回忆内容' }]
}

describe('review structured output', () => {
  it('accepts a recorded successful extraction fixture in one attempt', async () => {
    const provider = new FixtureProvider([fixture('review-extraction-success.json')])
    const result = await requestStructuredOutput({
      provider,
      request,
      schema: reviewExtractionSchema
    })

    expect(result).toMatchObject({ ok: true, attempts: 1 })
    if (result.ok) expect(result.value.questions[0]?.question).toBe('解释 event loop')
    expect(provider.requests).toHaveLength(1)
  })

  it('repairs invalid JSON at most once using validation feedback', async () => {
    const provider = new FixtureProvider([
      fixture('review-extraction-invalid.json'),
      fixture('review-extraction-success.json')
    ])
    const result = await requestStructuredOutput({
      provider,
      request,
      schema: reviewExtractionSchema
    })

    expect(result).toMatchObject({ ok: true, attempts: 2 })
    expect(provider.requests).toHaveLength(2)
    expect(provider.requests[1]?.messages.at(-1)?.content).toContain('校验错误')
  })

  it('degrades to a retryable result after the second invalid output', async () => {
    const provider = new FixtureProvider([
      fixture('review-extraction-invalid.json'),
      fixture('review-extraction-schema-invalid.json')
    ])
    const result = await requestStructuredOutput({
      provider,
      request,
      schema: reviewExtractionSchema
    })

    expect(result).toEqual({
      ok: false,
      errorCode: 'invalid_structured_output',
      message: 'DeepSeek 两次输出均不符合复盘结构，可保留草稿后重试。',
      attempts: 2,
      rawOutputs: ['这不是 JSON', fixture('review-extraction-schema-invalid.json')]
    })
    expect(provider.requests).toHaveLength(2)
  })

  it('requires targeted questions to stop when the user cannot recall', () => {
    expect(
      targetedQuestionsSchema.safeParse({
        questions: [
          {
            id: 'follow-up-1',
            prompt: '面试官随后追问了什么？',
            targetField: 'interviewerFollowUp',
            reason: '补全追问事实',
            stopWhenUserCannotRecall: false
          }
        ]
      }).success
    ).toBe(false)
  })
})
