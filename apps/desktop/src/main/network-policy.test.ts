import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { authorizeDeepSeekRequest, DEEPSEEK_API_ORIGIN } from './network-policy'

describe('zero telemetry production policy', () => {
  it('只允许用户确认后的 DeepSeek 请求', () => {
    expect(() => authorizeDeepSeekRequest(false)).toThrow('用户确认')
    expect(authorizeDeepSeekRequest(true)).toBe(DEEPSEEK_API_ORIGIN)
  })

  it('renderer CSP 禁止外部连接且生产依赖不含遥测 SDK', () => {
    const root = join(__dirname, '../..')
    const html = readFileSync(join(root, 'src/renderer/index.html'), 'utf8')
    const manifest = readFileSync(join(root, 'package.json'), 'utf8').toLowerCase()
    expect(html).toContain("default-src 'self'")
    expect(html).not.toContain('connect-src https:')
    for (const telemetry of ['sentry', 'analytics', 'telemetry', 'mixpanel', 'amplitude']) {
      expect(manifest).not.toContain(telemetry)
    }
  })
})
