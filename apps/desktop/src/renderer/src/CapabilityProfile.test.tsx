// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CapabilityNode, CapabilityState } from '@devreplay/domain'
import { CapabilityProfile } from './CapabilityProfile'

afterEach(cleanup)

describe('CapabilityProfile', () => {
  it('shows only explainable discrete states and never a mastery percentage', () => {
    const states: readonly CapabilityState[] = ['unknown', 'pending', 'weak', 'basic', 'stable']
    const capabilities = states.map((state, index) => ({
      node: {
        id: `node-${index}`,
        name: `能力 ${index}`,
        category: 'frontend' as const,
        userConfirmed: true
      } satisfies CapabilityNode,
      state,
      reason: `由证据 ${index} 推导`
    }))
    const { container } = render(<CapabilityProfile capabilities={capabilities} />)

    for (const label of ['未知', '待验证', '薄弱', '基本可靠', '稳定']) {
      expect(screen.getByText(label)).toBeTruthy()
    }
    expect(container.textContent).not.toContain('%')
    expect(container.textContent).not.toContain('掌握度')
  })

  it('requires an explicit click before accepting a proposed node', () => {
    const confirm = vi.fn()
    render(
      <CapabilityProfile
        capabilities={[]}
        proposedNode={{ name: 'Web 性能诊断', parentName: '前端工程', reason: '面试出现新题型' }}
        onConfirmNode={confirm}
      />
    )
    expect(confirm).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '确认加入画像' }))
    expect(confirm).toHaveBeenCalledOnce()
  })
})
