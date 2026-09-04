import { createServer, type RequestListener, type Server } from 'node:http'
import { afterEach, describe, expect, it } from 'vitest'
import { DeepSeekProvider } from './deepseek-provider'

const servers: Server[] = []

async function startServer(listener: RequestListener): Promise<string> {
  const server = createServer(listener)
  servers.push(server)
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('mock server address unavailable')
  return `http://127.0.0.1:${address.port}`
}

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          server.closeAllConnections()
          server.close(() => resolve())
        })
    )
  )
})

const request = {
  modelId: 'deepseek-chat',
  messages: [{ role: 'user' as const, content: '总结这次面试' }]
}

describe('DeepSeekProvider', () => {
  it('uses the OpenAI-compatible endpoint and normalizes token usage', async () => {
    let calls = 0
    const baseURL = await startServer((incoming, response) => {
      calls += 1
      expect(incoming.url).toBe('/chat/completions')
      response.writeHead(200, {
        'content-type': 'application/json',
        'x-request-id': 'request-1'
      })
      response.end(
        JSON.stringify({
          id: 'completion-1',
          object: 'chat.completion',
          created: 1,
          model: 'deepseek-chat',
          choices: [
            {
              index: 0,
              message: { role: 'assistant', content: '结构化总结' },
              finish_reason: 'stop'
            }
          ],
          usage: { prompt_tokens: 11, completion_tokens: 7, total_tokens: 18 }
        })
      )
    })
    const provider = new DeepSeekProvider({ apiKey: 'sk-test', baseURL })

    await expect(provider.complete(request)).resolves.toMatchObject({
      provider: 'deepseek',
      requestId: 'request-1',
      modelId: 'deepseek-chat',
      content: '结构化总结',
      finishReason: 'stop',
      usage: { inputTokens: 11, outputTokens: 7, totalTokens: 18 }
    })
    expect(calls).toBe(1)
  })

  it.each([
    [401, 'authentication'],
    [429, 'rate_limit']
  ] as const)('normalizes HTTP %i without SDK retries', async (status, kind) => {
    let calls = 0
    const baseURL = await startServer((_incoming, response) => {
      calls += 1
      response.writeHead(status, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ error: { message: 'mock error', type: 'mock_error' } }))
    })
    const provider = new DeepSeekProvider({ apiKey: 'sk-test', baseURL })

    await expect(provider.complete(request)).rejects.toMatchObject({ kind, status })
    expect(calls).toBe(1)
  })

  it('normalizes SDK timeouts and does not retry', async () => {
    let calls = 0
    const baseURL = await startServer((_incoming, response) => {
      calls += 1
      setTimeout(() => {
        if (!response.destroyed) response.end('{}')
      }, 250)
    })
    const provider = new DeepSeekProvider({ apiKey: 'sk-test', baseURL, timeoutMs: 30 })

    await expect(provider.complete(request)).rejects.toMatchObject({ kind: 'timeout' })
    expect(calls).toBe(1)
  })

  it('forwards cancellation signals', async () => {
    const baseURL = await startServer((_incoming, response) => {
      setTimeout(() => {
        if (!response.destroyed) response.end('{}')
      }, 250)
    })
    const provider = new DeepSeekProvider({ apiKey: 'sk-test', baseURL })
    const controller = new AbortController()
    const completion = provider.complete(request, { signal: controller.signal })
    setTimeout(() => controller.abort(), 20)

    await expect(completion).rejects.toMatchObject({ kind: 'cancelled' })
  })
})
