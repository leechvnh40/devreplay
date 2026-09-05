import { runInTransaction, type AppDatabase } from '../database'
import type { ModelSettingsService } from './model-settings-service'
import { PreconditionError } from './onboarding-service'

export const DATA_EXPORT_FORMAT = 'devreplay-local-data'
export const DATA_EXPORT_VERSION = 1
export const CLEAR_CONFIRMATION = '清除本机 DevReplay 数据'

type Scalar = string | number | null
type Row = Record<string, Scalar>

const DATA_TABLES = [
  'resume_snapshots',
  'job_descriptions',
  'target_profiles',
  'capability_nodes',
  'target_capability_weights',
  'interviews',
  'review_sessions',
  'review_turns',
  'review_items',
  'diagnostic_hypotheses',
  'evidence_entries',
  'capability_projection',
  'training_tasks',
  'assessment_contracts',
  'training_attempts',
  'review_schedules',
  'prompt_versions',
  'model_runs',
  'context_manifest_items',
  'datasets',
  'dataset_records'
] as const

const DELETE_ORDER = [
  'dataset_records',
  'context_manifest_items',
  'model_runs',
  'prompt_versions',
  'review_schedules',
  'training_attempts',
  'assessment_contracts',
  'training_tasks',
  'capability_projection',
  'evidence_entries',
  'diagnostic_hypotheses',
  'review_items',
  'review_turns',
  'review_sessions',
  'interviews',
  'target_capability_weights',
  'target_profiles',
  'job_descriptions',
  'resume_snapshots',
  'datasets',
  'capability_nodes'
] as const

interface ExportDocument {
  format: typeof DATA_EXPORT_FORMAT
  version: typeof DATA_EXPORT_VERSION
  exportedAt: string
  tables: Record<(typeof DATA_TABLES)[number] | 'settings', readonly Row[]>
}

export class DataLifecycleService {
  constructor(
    private readonly database: AppDatabase,
    private readonly modelSettings: ModelSettingsService,
    private readonly now: () => string = () => new Date().toISOString()
  ) {}

  exportJson(): string {
    const tables = Object.fromEntries(
      DATA_TABLES.map((table) => [
        table,
        this.database.sqlite.prepare(`SELECT * FROM ${table}`).all()
      ])
    ) as unknown as ExportDocument['tables']
    tables.settings = this.database.sqlite
      .prepare(
        "SELECT * FROM settings WHERE key IN ('plaintext-risk-accepted', 'deepseek-model-id')"
      )
      .all() as Row[]
    return JSON.stringify({
      format: DATA_EXPORT_FORMAT,
      version: DATA_EXPORT_VERSION,
      exportedAt: this.now(),
      tables
    })
  }

  importJson(content: string): { imported: true; rowCount: number; version: 1 } {
    const document = this.parse(content)
    let rowCount = 0
    runInTransaction(this.database.sqlite, () => {
      this.database.sqlite.pragma('defer_foreign_keys = ON')
      for (const table of [...DATA_TABLES, 'settings'] as const) {
        for (const row of document.tables[table]) {
          this.insert(table, row)
          rowCount += 1
        }
      }
    })
    return { imported: true, rowCount, version: DATA_EXPORT_VERSION }
  }

  clearPlan(): { confirmation: string; deletes: readonly string[]; preserves: readonly string[] } {
    return {
      confirmation: CLEAR_CONFIRMATION,
      deletes: [
        '面试、复盘、证据与画像',
        '训练、验收与复测',
        '简历、JD 与目标岗位',
        '设置与 DevReplay API Key'
      ],
      preserves: ['应用程序本体', '用户自行导出的 JSON 文件']
    }
  }

  clearAll(confirmation: string): { cleared: true } {
    if (confirmation !== CLEAR_CONFIRMATION) throw new PreconditionError('清除确认文字不匹配')
    runInTransaction(this.database.sqlite, () => {
      for (const table of DELETE_ORDER) this.database.sqlite.prepare(`DELETE FROM ${table}`).run()
      this.database.sqlite.prepare('DELETE FROM settings').run()
    })
    this.modelSettings.clearCredentials()
    return { cleared: true }
  }

  private parse(content: string): ExportDocument {
    let value: unknown
    try {
      value = JSON.parse(content)
    } catch {
      throw new PreconditionError('导入文件不是有效 JSON')
    }
    if (!value || typeof value !== 'object') throw new PreconditionError('导入文件结构无效')
    const document = value as Partial<ExportDocument>
    if (
      document.format !== DATA_EXPORT_FORMAT ||
      document.version !== DATA_EXPORT_VERSION ||
      !document.tables ||
      typeof document.tables !== 'object'
    ) {
      throw new PreconditionError('导入文件格式或版本不受支持')
    }
    for (const table of [...DATA_TABLES, 'settings'] as const) {
      const rows: unknown = document.tables[table]
      if (!Array.isArray(rows) || rows.some((row) => !this.validRow(row)))
        throw new PreconditionError(`导入表 ${table} 无效`)
    }
    const settings = document.tables.settings
    if (
      settings.some(
        (row) => row.key !== 'plaintext-risk-accepted' && row.key !== 'deepseek-model-id'
      )
    )
      throw new PreconditionError('导入文件包含不允许的设置项')
    return document as ExportDocument
  }

  private validRow(value: unknown): value is Row {
    return (
      Boolean(value) &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      Object.values(value as Record<string, unknown>).every(
        (item) => item === null || typeof item === 'string' || typeof item === 'number'
      )
    )
  }

  private insert(table: (typeof DATA_TABLES)[number] | 'settings', row: Row): void {
    const allowed = new Set(
      (this.database.sqlite.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map(
        (column) => column.name
      )
    )
    const columns = Object.keys(row)
    if (columns.length === 0 || columns.some((column) => !allowed.has(column)))
      throw new PreconditionError(`导入表 ${table} 包含未知字段`)
    const placeholders = columns.map(() => '?').join(', ')
    const mode = table === 'capability_nodes' ? 'OR IGNORE ' : ''
    this.database.sqlite
      .prepare(`INSERT ${mode}INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`)
      .run(...columns.map((column) => row[column]))
  }
}
