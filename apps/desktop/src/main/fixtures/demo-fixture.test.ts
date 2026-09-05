import { describe, expect, it } from 'vitest'
import { DEMO_FIXTURE } from './demo-fixture'

describe('deterministic demo fixture privacy', () => {
  it('只包含合成内容且不含作者、真实组织、路径或凭据痕迹', () => {
    const serialized = JSON.stringify(DEMO_FIXTURE)
    for (const forbidden of [
      '李川豪',
      'GoogleDownloads',
      'Users\\',
      'apiKey',
      'authorization',
      'sk-',
      'deepseek-chat'
    ]) {
      expect(serialized.toLowerCase()).not.toContain(forbidden.toLowerCase())
    }
    expect(DEMO_FIXTURE.interview.company).toBe('合成组织')
    expect(DEMO_FIXTURE.interview.id).toBe('demo-interview')
  })
})
