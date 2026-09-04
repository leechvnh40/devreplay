// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { DevReplayApi } from '@devreplay/shared'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FreeRecallEditor } from './FreeRecallEditor'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('FreeRecallEditor', () => {
  it('automatically saves user edits after a short debounce', async () => {
    const saveFreeRecall = vi.fn().mockResolvedValue({
      ok: true,
      data: { savedAt: '2026-09-04T09:30:00.000Z', stage: 'free_recall' }
    })
    Object.defineProperty(window, 'devReplay', {
      configurable: true,
      value: {
        reviews: {
          getDraft: vi.fn().mockResolvedValue({
            ok: true,
            data: {
              interview: {
                id: 'interview-1',
                company: '示例科技',
                role: '前端工程师',
                occurredAt: '2026-09-04T09:00',
                round: '一面',
                stage: 'free_recall',
                updatedAt: '2026-09-04T09:00:00.000Z'
              },
              freeRecall: '原草稿'
            }
          }),
          saveFreeRecall
        }
      } as unknown as DevReplayApi
    })

    render(<FreeRecallEditor interviewId="interview-1" onBack={vi.fn()} />)
    const editor = await screen.findByLabelText('我记得的面试过程')
    fireEvent.change(editor, { target: { value: '更新后的草稿' } })

    await waitFor(
      () =>
        expect(saveFreeRecall).toHaveBeenCalledWith({
          interviewId: 'interview-1',
          content: '更新后的草稿'
        }),
      { timeout: 1_500 }
    )
    expect(screen.getByRole('status').textContent).toBe('已保存到本地')
  })
})
