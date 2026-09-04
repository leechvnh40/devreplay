import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { openAppDatabase } from '../database'
import { CapabilityCatalogService } from './capability-catalog-service'

describe('CapabilityCatalogService', () => {
  it('seeds three tracks and inserts an agent-proposed node only after confirmation', () => {
    const directory = mkdtempSync(join(tmpdir(), 'devreplay-capabilities-'))
    const database = openAppDatabase(join(directory, 'devreplay.sqlite'))
    const service = new CapabilityCatalogService(
      database,
      () => '2026-09-04T13:00:00.000Z',
      () => 'frontend-performance'
    )
    try {
      service.ensureInitialSkeleton()
      service.ensureInitialSkeleton()
      const roots = service.list().filter((node) => !node.parentId)
      expect(roots).toHaveLength(3)
      expect(roots.map((node) => node.name)).toEqual(
        expect.arrayContaining(['AI 应用工程', '全栈工程', '前端工程'])
      )

      const proposal = service.proposeNewNode({
        parentId: 'frontend',
        name: 'Web 性能诊断',
        reason: '真实面试出现性能分析题'
      })
      expect(service.list().some((node) => node.name === proposal.name)).toBe(false)
      const confirmed = service.confirmNewNode(proposal)
      expect(confirmed.userConfirmed).toBe(true)
      expect(service.list().some((node) => node.id === confirmed.id)).toBe(true)
    } finally {
      database.close()
      rmSync(directory, { recursive: true })
    }
  })
})
