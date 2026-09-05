import { describe, expect, it } from 'vitest'
import { modelErrorMessage } from './model-error-copy'

describe('modelErrorMessage', () => {
  it.each([
    ['MODEL_NETWORK', '网络'],
    ['MODEL_AUTHENTICATION', 'API Key'],
    ['MODEL_RATE_LIMIT', '限流'],
    ['MODEL_TIMEOUT', '超时'],
    ['MODEL_INVALID_RESPONSE', '结构']
  ] as const)('为 %s 提供可重试且不自动切换模型的中文体验', (code, expected) => {
    const message = modelErrorMessage({ code, message: 'raw' })
    expect(message).toContain(expected)
    expect(message).toMatch(/重试|重新发送/)
    expect(message).not.toContain('已自动切换')
  })
})
