// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ContextPreviewDialog, type ContextPreviewItem } from './ContextPreviewDialog'

afterEach(cleanup)

const items: readonly ContextPreviewItem[] = [
  {
    id: 'recall',
    label: '本次自由回忆',
    content: '必需的当前复盘',
    required: true,
    included: true,
    estimatedChars: 8,
    estimatedTokens: 2
  },
  {
    id: 'resume',
    label: '简历片段',
    content: '可选的简历上下文',
    required: false,
    included: true,
    estimatedChars: 9,
    estimatedTokens: 3
  }
]

describe('ContextPreviewDialog', () => {
  it('does not invoke the network action until confirmation and omits removed items', async () => {
    const send = vi.fn().mockResolvedValue(undefined)
    render(<ContextPreviewDialog items={items} onConfirm={send} onCancel={vi.fn()} />)

    expect(send).not.toHaveBeenCalled()
    fireEvent.click(screen.getByLabelText(/简历片段/))
    expect(send).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '确认并发送' }))

    await waitFor(() => expect(send).toHaveBeenCalledOnce())
    expect(send.mock.calls[0]?.[0]).toEqual(['recall'])
    expect(send.mock.calls[0]?.[1]).toBeInstanceOf(AbortSignal)
  })

  it('cancels without starting a request', () => {
    const send = vi.fn()
    const cancel = vi.fn()
    render(<ContextPreviewDialog items={items} onConfirm={send} onCancel={cancel} />)

    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    expect(cancel).toHaveBeenCalledOnce()
    expect(send).not.toHaveBeenCalled()
  })

  it('aborts an in-flight confirmed request', async () => {
    let receivedSignal: AbortSignal | undefined
    const send = vi.fn((_ids: readonly string[], signal: AbortSignal) => {
      receivedSignal = signal
      return new Promise<void>((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(new Error('aborted')))
      })
    })
    const cancel = vi.fn()
    render(<ContextPreviewDialog items={items} onConfirm={send} onCancel={cancel} />)

    fireEvent.click(screen.getByRole('button', { name: '确认并发送' }))
    fireEvent.click(await screen.findByRole('button', { name: '取消请求' }))

    expect(receivedSignal?.aborted).toBe(true)
    expect(cancel).toHaveBeenCalledOnce()
  })
})
