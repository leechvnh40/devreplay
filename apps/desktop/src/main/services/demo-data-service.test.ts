import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { openAppDatabase } from '../database'
import { CapabilityCatalogService } from './capability-catalog-service'
import { DemoDataService } from './demo-data-service'

const directories: string[] = []
afterEach(() => directories.splice(0).forEach((path) => rmSync(path, { recursive: true })))

describe('DemoDataService', () => {
  it('无需 API Key 装载预录黄金路径，并只清除 dataset_kind=demo 数据', () => {
    const directory = mkdtempSync(join(tmpdir(), 'devreplay-demo-'))
    directories.push(directory)
    const database = openAppDatabase(join(directory, 'app.sqlite'))
    try {
      new CapabilityCatalogService(database).ensureInitialSkeleton()
      database.sqlite
        .prepare(
          `INSERT INTO resume_snapshots (id, label, content, captured_at)
         VALUES ('real-resume', '真实数据哨兵', '不得删除', '2026-09-04')`
        )
        .run()
      const service = new DemoDataService(database)
      expect(service.status()).toEqual({ loaded: false, datasetKind: 'demo' })
      expect(service.load()).toMatchObject({ loaded: true, interviewId: 'demo-interview' })
      expect(service.load()).toMatchObject({ loaded: true })
      expect(
        database.sqlite
          .prepare("SELECT dataset_kind FROM datasets WHERE id = 'demo-golden-path-v1'")
          .get()
      ).toEqual({ dataset_kind: 'demo' })
      expect(
        database.sqlite
          .prepare("SELECT provider, model_id FROM model_runs WHERE id = 'demo-model-run'")
          .get()
      ).toEqual({ provider: 'fixture', model_id: 'prerecorded-demo' })
      expect(
        database.sqlite
          .prepare("SELECT count(*) AS count FROM settings WHERE key LIKE '%api%'")
          .get()
      ).toEqual({ count: 0 })

      expect(service.clear()).toEqual({ cleared: true, datasetKind: 'demo' })
      expect(
        database.sqlite
          .prepare("SELECT count(*) AS count FROM interviews WHERE id LIKE 'demo-%'")
          .get()
      ).toEqual({ count: 0 })
      expect(
        database.sqlite
          .prepare("SELECT content FROM resume_snapshots WHERE id = 'real-resume'")
          .get()
      ).toEqual({ content: '不得删除' })
    } finally {
      database.close()
    }
  })
})
