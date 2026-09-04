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
})
