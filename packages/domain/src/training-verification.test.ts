import { describe, expect, it } from 'vitest'
import {
  applyTrainingVerificationEvent,
  calculateGapClosureRate,
  initialTrainingVerificationState
} from './training-verification'

describe('训练验证状态机', () => {
  it('首次通过进入待复测，复测通过后才验证', () => {
    const first = applyTrainingVerificationEvent(initialTrainingVerificationState(), 'initial_pass')
    expect(first.status).toBe('awaiting_retest')
    expect(applyTrainingVerificationEvent(first, 'spaced_retest_pass').status).toBe('verified')
  })

  it('首次失败和复测再次失误都进入重新训练', () => {
    expect(
      applyTrainingVerificationEvent(initialTrainingVerificationState(), 'initial_fail').status
    ).toBe('retraining')
    const awaiting = applyTrainingVerificationEvent(
      initialTrainingVerificationState(),
      'initial_pass'
    )
    expect(applyTrainingVerificationEvent(awaiting, 'spaced_retest_fail').status).toBe('retraining')
  })

  it('后续真实面试正向证据可以完成验证', () => {
    const awaiting = applyTrainingVerificationEvent(
      initialTrainingVerificationState(),
      'initial_pass'
    )
    expect(applyTrainingVerificationEvent(awaiting, 'real_interview_pass').status).toBe('verified')
  })
})

describe('缺口闭环率', () => {
  it('首次训练通过不计闭环，复测或真实面试验证后才计入', () => {
    const result = calculateGapClosureRate([
      {
        gapId: 'first-pass-only',
        confirmed: true,
        firstTrainingPassed: true,
        followUpValidation: 'none'
      },
      {
        gapId: 'retested',
        confirmed: true,
        firstTrainingPassed: true,
        followUpValidation: 'spaced_retest_pass'
      },
      {
        gapId: 'interview-verified',
        confirmed: true,
        firstTrainingPassed: true,
        followUpValidation: 'real_interview_pass'
      },
      {
        gapId: 'unconfirmed',
        confirmed: false,
        firstTrainingPassed: true,
        followUpValidation: 'real_interview_pass'
      }
    ])
    expect(result).toEqual({
      confirmedGapCount: 3,
      trainedGapCount: 3,
      closedGapCount: 2,
      rate: 2 / 3
    })
  })
})
