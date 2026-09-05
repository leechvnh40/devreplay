import { describe, expect, it } from 'vitest'
import { ZodError } from 'zod'
import { parseIpcRequest, parseIpcResponse } from './ipc'

describe('IPC contract', () => {
  it('rejects channels outside the domain whitelist', () => {
    expect(() =>
      parseIpcRequest({
        channel: 'database.query',
        payload: { sql: 'select * from interviews' }
      })
    ).toThrow(ZodError)
  })

  it('rejects invalid payloads for a known channel', () => {
    expect(() =>
      parseIpcRequest({
        channel: 'system.get-status',
        payload: { unexpected: true }
      })
    ).toThrow(ZodError)
  })

  it('validates successful response data', () => {
    expect(
      parseIpcResponse('system.get-status', {
        ok: true,
        data: { appName: 'DevReplay', ready: true }
      })
    ).toEqual({
      ok: true,
      data: { appName: 'DevReplay', ready: true }
    })
  })

  it('rejects malformed response data', () => {
    expect(() =>
      parseIpcResponse('system.get-status', {
        ok: true,
        data: { appName: 'Other', ready: 'yes' }
      })
    ).toThrow(ZodError)
  })

  it('validates the persisted review-flow boundary', () => {
    expect(
      parseIpcResponse('review.get-state', {
        ok: true,
        data: {
          interviewId: 'interview-1',
          interview: {
            company: '示例科技',
            role: '前端工程师',
            occurredAt: '2026-09-04T09:00:00.000Z',
            round: '一面'
          },
          stage: 'targeted_questions',
          operationStatus: 'idle',
          freeRecall: '解释 event loop',
          items: [],
          diagnoses: [],
          evidence: []
        }
      })
    ).toMatchObject({ ok: true, data: { stage: 'targeted_questions' } })
  })
})
