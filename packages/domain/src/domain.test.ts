import { describe, expect, it } from 'vitest'
import {
  beginReviewOperation,
  completeReviewOperation,
  createInterview,
  createDiagnosticHypothesis,
  createJobDescriptionSnapshot,
  createProvenance,
  createResumeSnapshot,
  createReviewSession,
  failReviewOperation,
  recoverReviewSession,
  reviewItemContentForNextStage,
  retryReviewOperation,
  mayChangeCapabilityState,
  reviseReviewItem,
  createReviewItem,
  transitionReviewSession
} from './index'

const capturedAt = '2026-09-04T00:00:00.000Z'

describe('immutable interview context', () => {
  it('binds immutable resume and optional JD snapshots', () => {
    const resume = createResumeSnapshot({
      id: 'resume-1',
      label: '前端岗位简历',
      content: 'React / TypeScript 项目经历',
      capturedAt
    })
    const jobDescription = createJobDescriptionSnapshot({
      id: 'jd-1',
      content: '需要 React 与 Node.js 经验',
      capturedAt
    })
    const interview = createInterview({
      id: 'interview-1',
      company: '示例科技',
      role: '前端工程师',
      occurredAt: capturedAt,
      round: '技术一面',
      resumeSnapshot: resume,
      jobDescriptionSnapshot: jobDescription,
      createdAt: capturedAt
    })

    expect(Object.isFrozen(resume)).toBe(true)
    expect(Object.isFrozen(jobDescription)).toBe(true)
    expect(Object.isFrozen(interview)).toBe(true)
    expect(Reflect.set(resume, 'content', '被覆盖的内容')).toBe(false)
    expect(interview.resumeSnapshot.content).toBe('React / TypeScript 项目经历')
  })

  it('requires snapshots to be created through the domain boundary', () => {
    expect(() =>
      createInterview({
        id: 'interview-1',
        company: '示例科技',
        role: '前端工程师',
        occurredAt: capturedAt,
        round: '技术一面',
        resumeSnapshot: {
          id: 'resume-1',
          label: '简历',
          content: '内容',
          capturedAt
        },
        createdAt: capturedAt
      })
    ).toThrow('不可变简历快照')
  })
})

describe('review session transitions', () => {
  it('advances one explicit stage at a time', () => {
    const draft = createReviewSession({
      id: 'review-1',
      interviewId: 'interview-1',
      updatedAt: capturedAt
    })
    const recall = transitionReviewSession(draft, 'free_recall', capturedAt)

    expect(recall).toMatchObject({ stage: 'free_recall', revision: 1 })
    expect(draft).toMatchObject({ stage: 'draft_context', revision: 0 })
    expect(Object.isFrozen(recall)).toBe(true)
  })

  it('rejects skipped, backward, and completed-state transitions', () => {
    const draft = createReviewSession({
      id: 'review-1',
      interviewId: 'interview-1',
      updatedAt: capturedAt
    })

    expect(() => transitionReviewSession(draft, 'targeted_questions', capturedAt)).toThrow(
      '非法复盘阶段转换'
    )

    let session = draft
    for (const stage of [
      'free_recall',
      'extract_review',
      'targeted_questions',
      'propose_diagnoses',
      'user_resolution',
      'evidence_preview',
      'training_decision',
      'completed'
    ] as const) {
      session = transitionReviewSession(session, stage, capturedAt)
    }

    expect(() => transitionReviewSession(session, 'draft_context', capturedAt)).toThrow(
      'completed -> draft_context'
    )
  })

  it('keeps failures at the same stage and supports an explicit retry', () => {
    const draft = createReviewSession({
      id: 'review-retry',
      interviewId: 'interview-1',
      updatedAt: capturedAt
    })
    const running = beginReviewOperation(draft, capturedAt)
    const failed = failReviewOperation(running, 'DeepSeek 超时', capturedAt)

    expect(failed).toMatchObject({
      stage: 'draft_context',
      operationStatus: 'retryable_error',
      failureCount: 1,
      lastError: 'DeepSeek 超时'
    })
    const retrying = retryReviewOperation(failed, capturedAt)
    const completed = completeReviewOperation(retrying, 'free_recall', capturedAt)
    expect(completed).toMatchObject({
      stage: 'free_recall',
      operationStatus: 'idle',
      failureCount: 1
    })
  })

  it('recovers an interrupted operation as retryable without advancing', () => {
    const running = beginReviewOperation(
      createReviewSession({
        id: 'review-recover',
        interviewId: 'interview-1',
        updatedAt: capturedAt
      }),
      capturedAt
    )
    const recovered = recoverReviewSession(running, capturedAt)

    expect(recovered.stage).toBe('draft_context')
    expect(recovered.operationStatus).toBe('retryable_error')
    expect(recovered.lastError).toContain('应用退出')
  })

  it('rejects invalid operation transitions and cannot reopen completed sessions', () => {
    const draft = createReviewSession({
      id: 'review-terminal',
      interviewId: 'interview-1',
      updatedAt: capturedAt
    })
    expect(() => retryReviewOperation(draft, capturedAt)).toThrow('不可重试')
    expect(() => failReviewOperation(draft, '失败', capturedAt)).toThrow('运行中')

    let session = draft
    for (const stage of [
      'free_recall',
      'extract_review',
      'targeted_questions',
      'propose_diagnoses',
      'user_resolution',
      'evidence_preview',
      'training_decision',
      'completed'
    ] as const) {
      session = transitionReviewSession(session, stage, capturedAt)
    }
    expect(() => beginReviewOperation(session, capturedAt)).toThrow('已完成复盘')
    expect(recoverReviewSession(session, capturedAt)).toBe(session)
  })
})

describe('provenance', () => {
  it('keeps derived source links immutable', () => {
    const provenance = createProvenance({
      sourceType: 'agent_summary',
      sourceId: 'summary-1',
      derivedFromIds: ['recall-1']
    })

    expect(Object.isFrozen(provenance)).toBe(true)
    expect(Object.isFrozen(provenance.derivedFromIds)).toBe(true)
  })

  it('retains the original extraction while downstream stages use the user revision', () => {
    const original = createReviewItem({
      id: 'item-1',
      kind: 'question',
      content: '原始抽取',
      sourceId: 'turn-1',
      createdAt: capturedAt
    })
    const revised = reviseReviewItem(original, {
      id: 'revision-1',
      content: '用户修正',
      createdAt: capturedAt
    })

    expect(reviewItemContentForNextStage(revised)).toBe('用户修正')
    expect(revised.original.content).toBe('原始抽取')
    expect(revised.revisions[0]?.provenance.derivedFromIds).toContain(original.original.id)
  })
})

describe('diagnostic hypotheses', () => {
  it('keeps a single vague signal pending and unable to change capability state', () => {
    const hypothesis = createDiagnosticHypothesis({
      id: 'diagnosis-1',
      capabilityId: 'javascript-runtime',
      claim: '可能不熟悉事件循环',
      evidence: [{ id: 'signal-1', description: '回答时停顿', specificity: 'vague' }],
      alternativeExplanations: ['面试紧张', '误解了题意'],
      confidence: 'low',
      verificationPlan: '用一道最小事件循环排序题复核'
    })

    expect(hypothesis.resolution).toBe('unresolved')
    expect(hypothesis.alternativeExplanations).toEqual(['面试紧张', '误解了题意'])
    expect(mayChangeCapabilityState(hypothesis)).toBe(false)
  })

  it('requires evidence, alternatives, and a verification plan', () => {
    expect(() =>
      createDiagnosticHypothesis({
        id: 'diagnosis-invalid',
        capabilityId: 'react',
        claim: '可能不了解 React',
        evidence: [],
        alternativeExplanations: [],
        confidence: 'low',
        verificationPlan: ''
      })
    ).toThrow('至少需要一条')
  })
})
