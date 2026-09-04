import { describe, expect, it } from 'vitest'
import {
  buildIncludedContext,
  createContextManifest,
  setContextItemIncluded
} from './context-manifest'

const fragments = [
  {
    id: 'recall',
    kind: 'current_recall' as const,
    sourceId: 'review-1',
    label: '本次自由回忆',
    content: '用户本次面试的完整自由回忆',
    required: true
  },
  {
    id: 'resume',
    kind: 'resume_excerpt' as const,
    sourceId: 'resume-1',
    label: '简历片段',
    content: '包含敏感项目名称的可选简历片段',
    required: false
  }
]

describe('ContextManifest', () => {
  it('estimates included size and keeps required fragments selected', () => {
    const manifest = createContextManifest(fragments)

    expect(manifest.includedChars).toBe(fragments[0]!.content.length + fragments[1]!.content.length)
    expect(manifest.includedTokens).toBeGreaterThan(0)
    expect(() => setContextItemIncluded(manifest, 'recall', false)).toThrow('必需上下文不可移除')
  })

  it('never includes a user-removed optional fragment in the final request context', () => {
    const manifest = createContextManifest(fragments)
    const reduced = setContextItemIncluded(manifest, 'resume', false)
    const finalContext = buildIncludedContext(reduced)

    expect(finalContext).toContain('用户本次面试的完整自由回忆')
    expect(finalContext).not.toContain('包含敏感项目名称的可选简历片段')
    expect(reduced.includedChars).toBe(fragments[0]!.content.length)
    expect(manifest.items.find((item) => item.id === 'resume')?.included).toBe(true)
  })
})
