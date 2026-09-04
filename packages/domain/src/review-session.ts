import { requireNonEmpty, type InterviewId, type ReviewSessionId } from './ids'

export const REVIEW_STAGES = [
  'draft_context',
  'free_recall',
  'extract_review',
  'targeted_questions',
  'propose_diagnoses',
  'user_resolution',
  'evidence_preview',
  'training_decision',
  'completed'
] as const

export type ReviewStage = (typeof REVIEW_STAGES)[number]
export type ReviewOperationStatus = 'idle' | 'running' | 'retryable_error'

export interface ReviewSession {
  readonly id: ReviewSessionId
  readonly interviewId: InterviewId
  readonly stage: ReviewStage
  readonly revision: number
  readonly updatedAt: string
  readonly operationStatus: ReviewOperationStatus
  readonly failureCount: number
  readonly lastError?: string
}

export function createReviewSession(input: {
  id: ReviewSessionId
  interviewId: InterviewId
  updatedAt: string
}): ReviewSession {
  return Object.freeze({
    id: requireNonEmpty(input.id, '复盘会话 ID'),
    interviewId: requireNonEmpty(input.interviewId, '面试 ID'),
    stage: 'draft_context',
    revision: 0,
    updatedAt: requireNonEmpty(input.updatedAt, '更新时间'),
    operationStatus: 'idle',
    failureCount: 0
  })
}

export function transitionReviewSession(
  session: ReviewSession,
  nextStage: ReviewStage,
  updatedAt: string
): ReviewSession {
  if (session.operationStatus !== 'idle') {
    throw new Error(`复盘操作未结束：${session.operationStatus}`)
  }
  return advanceStage(session, nextStage, updatedAt)
}

export function beginReviewOperation(session: ReviewSession, updatedAt: string): ReviewSession {
  if (session.stage === 'completed') throw new Error('已完成复盘不能启动新操作')
  if (session.operationStatus !== 'idle') {
    throw new Error(`无法从 ${session.operationStatus} 启动复盘操作`)
  }
  return updateOperation(session, 'running', updatedAt)
}

export function failReviewOperation(
  session: ReviewSession,
  message: string,
  updatedAt: string
): ReviewSession {
  if (session.operationStatus !== 'running') throw new Error('只有运行中的操作可以失败')
  return Object.freeze({
    ...session,
    operationStatus: 'retryable_error',
    failureCount: session.failureCount + 1,
    lastError: requireNonEmpty(message, '错误信息'),
    revision: session.revision + 1,
    updatedAt: requireNonEmpty(updatedAt, '更新时间')
  })
}

export function retryReviewOperation(session: ReviewSession, updatedAt: string): ReviewSession {
  if (session.operationStatus !== 'retryable_error') throw new Error('当前操作不可重试')
  return updateOperation(session, 'running', updatedAt)
}

export function completeReviewOperation(
  session: ReviewSession,
  nextStage: ReviewStage,
  updatedAt: string
): ReviewSession {
  if (session.operationStatus !== 'running') throw new Error('只有运行中的操作可以完成')
  return advanceStage(
    { ...session, operationStatus: 'idle' },
    nextStage,
    updatedAt,
    session.failureCount
  )
}

export function recoverReviewSession(session: ReviewSession, updatedAt: string): ReviewSession {
  if (session.operationStatus !== 'running') return session
  return failReviewOperation(session, '上次操作因应用退出而中断，请重试', updatedAt)
}

function advanceStage(
  session: ReviewSession,
  nextStage: ReviewStage,
  updatedAt: string,
  failureCount = 0
): ReviewSession {
  const currentIndex = REVIEW_STAGES.indexOf(session.stage)
  const expectedStage = REVIEW_STAGES[currentIndex + 1]

  if (nextStage !== expectedStage) {
    throw new Error(`非法复盘阶段转换：${session.stage} -> ${nextStage}`)
  }

  const withoutError = { ...session }
  delete withoutError.lastError
  return Object.freeze({
    ...withoutError,
    stage: nextStage,
    revision: session.revision + 1,
    updatedAt: requireNonEmpty(updatedAt, '更新时间'),
    operationStatus: 'idle',
    failureCount
  })
}

function updateOperation(
  session: ReviewSession,
  operationStatus: ReviewOperationStatus,
  updatedAt: string
): ReviewSession {
  const withoutError = { ...session }
  delete withoutError.lastError
  return Object.freeze({
    ...withoutError,
    operationStatus,
    revision: session.revision + 1,
    updatedAt: requireNonEmpty(updatedAt, '更新时间')
  })
}
