import { createInterview, createResumeSnapshot } from '@devreplay/domain'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { openAppDatabase } from '../database'
import { SqliteInterviewRepository } from './sqlite-interview-repository'

const temporaryDirectories: string[] = []
const now = '2026-09-04T01:00:00.000Z'

function createRepository(): {
  repository: SqliteInterviewRepository
  close(): void
} {
  const directory = mkdtempSync(join(tmpdir(), 'devreplay-repository-'))
  temporaryDirectories.push(directory)
  const database = openAppDatabase(join(directory, 'devreplay.sqlite'))
  return {
    repository: new SqliteInterviewRepository(database),
    close: () => database.close()
  }
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe('SqliteInterviewRepository', () => {
  it('maps between immutable domain objects and persistence rows', () => {
    const harness = createRepository()
    const interview = createInterview({
      id: 'interview-1',
      company: '示例科技',
      role: '全栈工程师',
      occurredAt: now,
      round: '技术一面',
      resumeSnapshot: createResumeSnapshot({
        id: 'resume-1',
        label: '全栈简历',
        content: 'TypeScript 与 Node.js',
        capturedAt: now
      }),
      createdAt: now
    })

    try {
      harness.repository.save(interview)
      const restored = harness.repository.findById(interview.id)

      expect(restored).toEqual(interview)
      expect(Object.isFrozen(restored)).toBe(true)
      expect(harness.repository.list()).toEqual([interview])
    } finally {
      harness.close()
    }
  })

  it('rejects silent replacement of an immutable snapshot', () => {
    const harness = createRepository()
    const first = createInterview({
      id: 'interview-1',
      company: 'A',
      role: '前端',
      occurredAt: now,
      round: '一面',
      resumeSnapshot: createResumeSnapshot({
        id: 'resume-1',
        label: '简历',
        content: '原始内容',
        capturedAt: now
      }),
      createdAt: now
    })
    const second = createInterview({
      ...first,
      id: 'interview-2',
      resumeSnapshot: createResumeSnapshot({
        ...first.resumeSnapshot,
        content: '覆盖内容'
      })
    })

    try {
      harness.repository.save(first)
      expect(() => harness.repository.save(second)).toThrow('不可覆盖简历快照')
      expect(harness.repository.findById('interview-2')).toBeUndefined()
    } finally {
      harness.close()
    }
  })
})
