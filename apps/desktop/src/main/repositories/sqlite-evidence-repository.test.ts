import { createEvidenceEntry } from '@devreplay/domain'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { openAppDatabase } from '../database'
import { SqliteEvidenceRepository } from './sqlite-evidence-repository'

describe('SqliteEvidenceRepository', () => {
  it('appends corrections and retractions, then rebuilds the same projection from history', () => {
    const directory = mkdtempSync(join(tmpdir(), 'devreplay-evidence-'))
    const database = openAppDatabase(join(directory, 'devreplay.sqlite'))
    const now = '2026-09-04T12:30:00.000Z'
    try {
      database.sqlite
        .prepare(
          `INSERT INTO capability_nodes
           (id, name, category, user_confirmed, created_at, updated_at)
           VALUES ('react', 'React', 'frontend', 1, ?, ?)`
        )
        .run(now, now)
      const repository = new SqliteEvidenceRepository(database, () => now)
      const original = createEvidenceEntry({
        id: 'e-1',
        capabilityId: 'react',
        sourceType: 'user_statement',
        polarity: 'negative',
        strength: 2,
        content: { summary: '回答错误' },
        createdAt: now
      })
      const correction = createEvidenceEntry({
        id: 'e-2',
        capabilityId: 'react',
        sourceType: 'user_revision',
        polarity: 'positive',
        strength: 2,
        content: { summary: '用户更正记录' },
        supersedesId: 'e-1',
        createdAt: now
      })
      const retraction = createEvidenceEntry({
        id: 'e-3',
        capabilityId: 'react',
        sourceType: 'user_revision',
        polarity: 'neutral',
        strength: 1,
        content: { reason: '无法核实' },
        retractsId: 'e-2',
        createdAt: now
      })

      repository.append(original)
      repository.append(correction)
      const incremental = repository.append(retraction)
      const rebuilt = repository.rebuild('react')

      expect(repository.list('react')).toHaveLength(3)
      expect(incremental.state).toBe('unknown')
      expect(rebuilt).toEqual(incremental)
      expect(
        database.sqlite.prepare('SELECT count(*) AS count FROM evidence_entries').get()
      ).toEqual({ count: 3 })
    } finally {
      database.close()
      rmSync(directory, { recursive: true })
    }
  })
})
