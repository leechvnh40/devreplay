// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DevReplayApi } from '@devreplay/shared'
import { CodeTrainingEditor } from './CodeTrainingEditor'

describe('CodeTrainingEditor', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'devReplay', {
      configurable: true,
      value: {
        training: {
          list: vi.fn().mockResolvedValue({ ok: true, data: [] }),
          getCodeTask: vi.fn().mockResolvedValue({
            ok: true,
            data: {
              id: 'task-1',
              title: '数组加倍',
              prompt: '实现 double',
              starterCode: 'function double(value) { return value }',
              language: 'javascript',
              assessmentContractId: 'contract-1',
              assessmentContractVersion: 1,
              publicTests: [{ name: '公开示例', args: [2], expected: 4 }]
            }
          }),
          runCode: vi.fn().mockResolvedValue({
            ok: true,
            data: {
              passed: false,
              publicResults: [{ name: '公开示例', passed: true, actual: 4, expected: 4 }],
              hiddenResults: [{ passed: false, category: 'assertion_failed' }]
            }
          }),
          submitCode: vi.fn(),
          getExplanationTask: vi.fn(),
          submitExplanation: vi.fn()
        }
      } as Pick<DevReplayApi, 'training'>
    })
  })

  it('展示公开测试且隐藏测试只显示安全摘要', async () => {
    render(<CodeTrainingEditor trainingTaskId="task-1" />)
    expect(await screen.findByText(/公开示例/)).toBeTruthy()
    fireEvent.click(screen.getByText('运行公开及隐藏测试'))
    await waitFor(() => expect(screen.getByText('运行结果：未通过')).toBeTruthy())
    expect(screen.getByText('隐藏测试：0/1 通过')).toBeTruthy()
    expect(document.body.textContent).not.toContain('assertion_failed')
  })
})
