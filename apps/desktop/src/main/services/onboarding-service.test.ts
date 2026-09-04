import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { openAppDatabase } from '../database'
import { SqliteInterviewRepository } from '../repositories/sqlite-interview-repository'
import { OnboardingService, PreconditionError } from './onboarding-service'

const directories: string[] = []

function createService(): { service: OnboardingService; close(): void } {
  const directory = mkdtempSync(join(tmpdir(), 'devreplay-onboarding-'))
  directories.push(directory)
  const database = openAppDatabase(join(directory, 'devreplay.sqlite'))
  const repository = new SqliteInterviewRepository(database)
  let id = 0
  return {
    service: new OnboardingService(
      database,
      repository,
      () => '2026-09-04T09:00:00.000Z',
      () => `generated-${++id}`
    ),
    close: () => database.close()
  }
}

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe('OnboardingService', () => {
  it('requires a locally stored resume before creating an interview', () => {
    const harness = createService()
    try {
      expect(() =>
        harness.service.createInterview({
          company: '示例科技',
          role: '前端工程师',
          occurredAt: '2026-09-04T10:00',
          round: '一面',
          jobDescription: 'React',
          confirmWithoutJobDescription: false
        })
      ).toThrow(PreconditionError)
    } finally {
      harness.close()
    }
  })

  it('records risk consent and allows explicit continuation without JD', () => {
    const harness = createService()
    try {
      const state = harness.service.save({
        targetRole: 'AI 应用工程师',
        riskAccepted: true,
        resumeLabel: '当前简历',
        resumeContent: 'TypeScript / LLM 应用'
      })
      expect(state).toMatchObject({ initialized: true, riskAccepted: true })

      const baseRequest = {
        company: '示例科技',
        role: 'AI 应用工程师',
        occurredAt: '2026-09-04T10:00',
        round: '一面',
        jobDescription: ''
      }
      expect(() =>
        harness.service.createInterview({
          ...baseRequest,
          confirmWithoutJobDescription: false
        })
      ).toThrow('缺少 JD 时需要确认继续')

      expect(
        harness.service.createInterview({
          ...baseRequest,
          confirmWithoutJobDescription: true
        }).interviewId
      ).toBe('generated-2')
    } finally {
      harness.close()
    }
  })
})
