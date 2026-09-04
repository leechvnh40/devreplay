// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDiagnosticHypothesis } from '@devreplay/domain'
import { DiagnosisCard } from './DiagnosisCard'

afterEach(cleanup)

describe('DiagnosisCard', () => {
  it.each([
    ['确认', 'confirmed'],
    ['驳回', 'rejected'],
    ['保留待验证', 'kept_pending']
  ] as const)('emits %s resolution explicitly', (label, resolution) => {
    const onResolve = vi.fn()
    render(
      <DiagnosisCard
        hypothesis={createDiagnosticHypothesis({
          id: 'diagnosis-1',
          capabilityId: 'javascript',
          claim: '事件循环理解可能不稳',
          evidence: [{ id: 'signal-1', description: '排序错误', specificity: 'specific' }],
          alternativeExplanations: ['题意理解偏差'],
          confidence: 'medium',
          verificationPlan: '用最小代码题复核'
        })}
        onResolve={onResolve}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: label }))
    expect(onResolve).toHaveBeenCalledWith(resolution)
  })
})
