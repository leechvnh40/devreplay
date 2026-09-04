import { describe, expect, it } from 'vitest'
import { evaluateReviewCompletion, type ReviewCompletionChecklist } from './index'

const completeChecklist: ReviewCompletionChecklist = {
  basicInfoComplete: true,
  freeRecallComplete: true,
  keyQuestions: ['answered'],
  diagnosisResolutions: ['confirmed'],
  trainingDecision: { kind: 'task', taskId: 'task-1' },
  evidencePreviewAcknowledged: true
}

describe('deterministic review completion gate', () => {
  it('blocks unresolved diagnoses and an unacknowledged evidence preview', () => {
    const result = evaluateReviewCompletion({
      ...completeChecklist,
      diagnosisResolutions: ['unresolved'],
      evidencePreviewAcknowledged: false
    })
    expect(result.complete).toBe(false)
    expect(result.missing).toEqual(['诊断处理', '证据预览'])
  })

  it('accepts explicitly unknown questions and a reason for no training', () => {
    expect(
      evaluateReviewCompletion({
        ...completeChecklist,
        keyQuestions: ['unknown'],
        diagnosisResolutions: ['kept_pending'],
        trainingDecision: { kind: 'no_training', reason: '本次仅为沟通问题，无需专项训练' }
      })
    ).toEqual({ complete: true, missing: [] })
  })
})
