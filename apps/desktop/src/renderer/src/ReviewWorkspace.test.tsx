// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ReviewWorkspace } from './ReviewWorkspace'

afterEach(cleanup)

describe('ReviewWorkspace', () => {
  it('uses the user correction as current state while retaining the original source', () => {
    render(<ReviewWorkspace />)

    fireEvent.change(screen.getByLabelText('面试问题'), {
      target: { value: '面试官实际问的是 React 并发渲染。' }
    })

    expect((screen.getByLabelText('面试问题') as HTMLTextAreaElement).value).toBe(
      '面试官实际问的是 React 并发渲染。'
    )
    expect(screen.getByText('当前来源：user_revision')).toBeTruthy()
    fireEvent.click(screen.getByText('查看原始来源'))
    expect(screen.getByText('面试官询问了 React 渲染优化。')).toBeTruthy()
    expect(screen.getByText('agent_summary')).toBeTruthy()
  })

  it('renders conversation and structured review as two named columns', () => {
    render(<ReviewWorkspace />)
    expect(screen.getByText('面试对话')).toBeTruthy()
    expect(screen.getByText('复盘卡')).toBeTruthy()
  })
})
