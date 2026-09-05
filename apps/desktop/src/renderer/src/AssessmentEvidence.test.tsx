// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AssessmentEvidence } from './AssessmentEvidence'

describe('AssessmentEvidence', () => {
  it('同时展示初评和复核证据', () => {
    render(
      <AssessmentEvidence
        attempt={{
          id: 'attempt-1',
          trainingTaskId: 'task-1',
          assessmentContractId: 'contract-1',
          answer: '回答',
          createdAt: '2026-09-04T00:00:00.000Z',
          initial: { passed: false, reason: '初评缺失', evidence: ['初评证据'] },
          review: {
            requestedReason: '存在等价表述',
            createdAt: '2026-09-04T00:01:00.000Z',
            result: { passed: true, reason: '复核通过', evidence: ['复核证据'] }
          }
        }}
      />
    )
    expect(screen.getByText('初次评分：未通过')).toBeTruthy()
    expect(screen.getByText('初评证据')).toBeTruthy()
    expect(screen.getByText('复核结果：通过')).toBeTruthy()
    expect(screen.getByText('复核证据')).toBeTruthy()
  })
})
