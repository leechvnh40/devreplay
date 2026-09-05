// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TodayWorkspace } from './TodayWorkspace'

afterEach(cleanup)

describe('TodayWorkspace', () => {
  it('只展示一个优先行动并解释排序因素', () => {
    const openTraining = vi.fn()
    render(
      <TodayWorkspace
        action={{
          kind: 'training',
          title: '训练：异步 JavaScript',
          description: '这是当前收益最高的一个行动。',
          trainingTaskId: 'task-1',
          factors: [
            { key: 'target_relevance', label: '目标岗位相关度', contribution: 24 },
            { key: 'impact', label: '面试影响程度', contribution: 12 }
          ]
        }}
        onOpenInterview={vi.fn()}
        onOpenTraining={openTraining}
      />
    )

    expect(screen.getAllByRole('button')).toHaveLength(1)
    expect(screen.getByLabelText('排序因素').textContent).toContain('目标岗位相关度')
    fireEvent.click(screen.getByRole('button', { name: '开始行动' }))
    expect(openTraining).toHaveBeenCalledWith('task-1')
  })
})
