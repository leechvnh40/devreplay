// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { InterviewCreateForm } from './InterviewCreateForm'

afterEach(cleanup)

function fillRequiredFields(): void {
  fireEvent.change(screen.getByLabelText('公司'), { target: { value: '示例科技' } })
  fireEvent.change(screen.getByLabelText('岗位'), { target: { value: '前端工程师' } })
  fireEvent.change(screen.getByLabelText('面试时间'), {
    target: { value: '2026-09-04T10:00' }
  })
  fireEvent.change(screen.getByLabelText('轮次'), { target: { value: '技术一面' } })
}

describe('InterviewCreateForm', () => {
  it('does not allow interview creation without a resume snapshot', () => {
    render(<InterviewCreateForm hasResume={false} onCreate={vi.fn()} />)
    fillRequiredFields()
    fireEvent.click(screen.getByLabelText(/缺少 JD/))

    expect(
      (screen.getByRole('button', { name: '创建并开始自由回忆' }) as HTMLButtonElement).disabled
    ).toBe(true)
    expect(screen.getByText('请先保存简历快照，才能创建面试。')).toBeTruthy()
  })

  it('allows an explicit confirmation when JD is missing', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined)
    render(<InterviewCreateForm hasResume onCreate={onCreate} />)
    fillRequiredFields()

    const submit = screen.getByRole('button', { name: '创建并开始自由回忆' })
    expect((submit as HTMLButtonElement).disabled).toBe(true)

    fireEvent.click(screen.getByLabelText(/缺少 JD/))
    expect((submit as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(submit)

    await vi.waitFor(() => expect(onCreate).toHaveBeenCalledOnce())
    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({ jobDescription: '', confirmWithoutJobDescription: true })
    )
  })
})
