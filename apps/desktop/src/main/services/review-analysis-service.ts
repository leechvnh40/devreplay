import {
  AuditedModelRunner,
  DeepSeekProvider,
  buildIncludedContext,
  createContextManifest,
  getPromptVersion,
  reviewExtractionSchema,
  setContextItemIncluded,
  type ContextManifest,
  type ModelProvider,
  type ReviewExtraction
} from '@devreplay/agent'
import { runInTransaction, type AppDatabase } from '../database'
import { SqliteModelRunAuditStore } from '../repositories/sqlite-model-run-audit-store'
import type { ModelSettingsService } from './model-settings-service'
import { PreconditionError } from './onboarding-service'
import { authorizeDeepSeekRequest } from '../network-policy'

interface ReviewContextRow {
  review_session_id: string
  stage: string
  draft_json: string
  company: string
  role: string
  occurred_at: string
  round: string
  resume_snapshot_id: string
  resume_content: string
  job_description_id: string | null
  job_description_content: string | null
}

export interface ReviewAnalysisResult {
  readonly runId: string
  readonly extraction: ReviewExtraction
}

export interface ReviewItemModelRun {
  readonly reviewItemId: string
  readonly runId: string
  readonly status: string
  readonly modelId: string
  readonly promptVersionId: string
  readonly contextItems: readonly {
    kind: string
    sourceId: string
    required: boolean
    included: boolean
    estimatedChars: number
  }[]
}

export type ReviewAnalysisProviderFactory = (apiKey: string) => ModelProvider

export class ReviewAnalysisService {
  private readonly activeControllers = new Map<string, AbortController>()

  constructor(
    private readonly database: AppDatabase,
    private readonly modelSettings: ModelSettingsService,
    private readonly providerFactory: ReviewAnalysisProviderFactory = (apiKey) =>
      new DeepSeekProvider({ apiKey }),
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly nextId: () => string = () => crypto.randomUUID()
  ) {}

  preview(interviewId: string): ContextManifest {
    const row = this.getReviewContext(interviewId)
    const draft = this.parseDraft(row.draft_json)
    if (!draft.freeRecall.trim()) throw new PreconditionError('请先完成自由回忆')

    return createContextManifest([
      {
        id: 'current-recall',
        kind: 'current_recall',
        sourceId: row.review_session_id,
        label: '本次自由回忆',
        content: draft.freeRecall,
        required: true
      },
      {
        id: 'interview-context',
        kind: 'interview_context',
        sourceId: interviewId,
        label: '面试基本信息',
        content: `${row.company} / ${row.role} / ${row.round} / ${row.occurred_at}`,
        required: true
      },
      {
        id: 'resume-snapshot',
        kind: 'resume_excerpt',
        sourceId: row.resume_snapshot_id,
        label: '面试时简历快照',
        content: row.resume_content,
        required: false
      },
      ...(row.job_description_id && row.job_description_content
        ? [
            {
              id: 'job-description',
              kind: 'job_description' as const,
              sourceId: row.job_description_id,
              label: '职位描述',
              content: row.job_description_content,
              required: false
            }
          ]
        : [])
    ])
  }

  async analyze(
    interviewId: string,
    includedItemIds: readonly string[],
    signal?: AbortSignal
  ): Promise<ReviewAnalysisResult> {
    authorizeDeepSeekRequest(true)
    if (this.activeControllers.has(interviewId)) {
      throw new PreconditionError('当前复盘已有分析请求正在运行')
    }
    let manifest = this.preview(interviewId)
    const selected = new Set(includedItemIds)
    for (const id of selected) {
      if (!manifest.items.some((item) => item.id === id)) {
        throw new PreconditionError(`发送内容不存在：${id}`)
      }
    }
    for (const item of manifest.items) {
      if (!item.required)
        manifest = setContextItemIncluded(manifest, item.id, selected.has(item.id))
    }

    const controller = new AbortController()
    const abort = (): void => controller.abort()
    if (signal?.aborted) controller.abort()
    else signal?.addEventListener('abort', abort, { once: true })
    this.activeControllers.set(interviewId, controller)
    this.markOperation(interviewId, 'running')

    try {
      const settings = this.modelSettings.getSettings()
      const provider = this.providerFactory(this.modelSettings.getApiKeyForModelRequest())
      const prompt = getPromptVersion('interview-extract-v1')
      const runId = this.nextId()
      const runner = new AuditedModelRunner(
        provider,
        new SqliteModelRunAuditStore(this.database),
        this.now
      )
      const structured = await runner.runStructured(
        {
          runId,
          interviewId,
          prompt,
          contextItems: manifest.items,
          request: {
            modelId: settings.modelId,
            messages: [
              { role: 'system', content: prompt.template },
              { role: 'user', content: buildIncludedContext(manifest) }
            ],
            temperature: 0
          },
          signal: controller.signal
        },
        reviewExtractionSchema
      )
      if (!structured.ok) {
        this.markOperation(interviewId, 'retryable_error', structured.message)
        throw new PreconditionError(structured.message)
      }

      this.persistExtraction(interviewId, runId, structured.value)
      return { runId, extraction: structured.value }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'DeepSeek 分析失败'
      const current = this.getReviewContext(interviewId)
      const draft = this.parseDraft(current.draft_json)
      if (draft.operationStatus !== 'retryable_error') {
        this.markOperation(interviewId, 'retryable_error', message)
      }
      throw error
    } finally {
      signal?.removeEventListener('abort', abort)
      this.activeControllers.delete(interviewId)
    }
  }

  cancel(interviewId: string): boolean {
    const controller = this.activeControllers.get(interviewId)
    controller?.abort()
    return Boolean(controller)
  }

  getRunForReviewItem(reviewItemId: string): ReviewItemModelRun {
    const run = this.database.sqlite
      .prepare(
        `SELECT ri.id AS review_item_id, mr.id AS run_id, mr.status, mr.model_id,
                mr.prompt_version_id
         FROM review_items ri
         JOIN model_runs mr ON mr.id = ri.source_id
         WHERE ri.id = ?`
      )
      .get(reviewItemId) as
      | {
          review_item_id: string
          run_id: string
          status: string
          model_id: string
          prompt_version_id: string
        }
      | undefined
    if (!run) throw new PreconditionError('复盘产物没有可追溯的模型运行记录')

    const contextItems = this.database.sqlite
      .prepare(
        `SELECT kind, source_id, required, included, estimated_chars
         FROM context_manifest_items WHERE model_run_id = ? ORDER BY id`
      )
      .all(run.run_id) as {
      kind: string
      source_id: string
      required: number
      included: number
      estimated_chars: number
    }[]
    return {
      reviewItemId: run.review_item_id,
      runId: run.run_id,
      status: run.status,
      modelId: run.model_id,
      promptVersionId: run.prompt_version_id,
      contextItems: contextItems.map((item) => ({
        kind: item.kind,
        sourceId: item.source_id,
        required: Boolean(item.required),
        included: Boolean(item.included),
        estimatedChars: item.estimated_chars
      }))
    }
  }

  private getReviewContext(interviewId: string): ReviewContextRow {
    const row = this.database.sqlite
      .prepare(
        `SELECT rs.id AS review_session_id, rs.stage, rs.draft_json,
                i.company, i.role, i.occurred_at, i.round,
                i.resume_snapshot_id, resume.content AS resume_content,
                i.job_description_id, jd.content AS job_description_content
         FROM review_sessions rs
         JOIN interviews i ON i.id = rs.interview_id
         JOIN resume_snapshots resume ON resume.id = i.resume_snapshot_id
         LEFT JOIN job_descriptions jd ON jd.id = i.job_description_id
         WHERE i.id = ?`
      )
      .get(interviewId) as ReviewContextRow | undefined
    if (!row) throw new PreconditionError('复盘会话不存在')
    if (row.stage !== 'free_recall' && row.stage !== 'extract_review') {
      throw new PreconditionError('当前复盘阶段不能重新抽取')
    }
    return row
  }

  private parseDraft(value: string): { freeRecall: string; [key: string]: unknown } {
    const parsed: unknown = JSON.parse(value)
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('freeRecall' in parsed) ||
      typeof parsed.freeRecall !== 'string'
    ) {
      throw new Error('复盘草稿数据损坏')
    }
    return parsed as { freeRecall: string; [key: string]: unknown }
  }

  private persistExtraction(
    interviewId: string,
    runId: string,
    extraction: ReviewExtraction
  ): void {
    const row = this.getReviewContext(interviewId)
    const timestamp = this.now()
    const draft = this.parseDraft(row.draft_json)
    const stableDraft = { ...draft }
    delete stableDraft.operationStatus
    delete stableDraft.lastError
    runInTransaction(this.database.sqlite, () => {
      for (const question of extraction.questions) {
        this.database.sqlite
          .prepare(
            `INSERT INTO review_items
             (id, review_session_id, kind, content_json, source_type, source_id, status,
              created_at, updated_at)
             VALUES (?, ?, 'question', ?, 'agent_summary', ?, 'candidate', ?, ?)`
          )
          .run(
            `${runId}:${question.id}`,
            row.review_session_id,
            JSON.stringify(question),
            runId,
            timestamp,
            timestamp
          )

        if (question.answer.status === 'unknown') {
          const capabilityId = this.capabilityFor(question.question)
          this.database.sqlite
            .prepare(
              `INSERT INTO diagnostic_hypotheses
               (id, review_session_id, capability_id, claim, evidence_json, alternatives_json,
                confidence, verification_plan, resolution, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, 'low', ?, 'unresolved', ?, ?)`
            )
            .run(
              `${runId}:diagnosis:${question.id}`,
              row.review_session_id,
              capabilityId,
              `「${question.question}」相关能力需要进一步验证`,
              JSON.stringify([
                {
                  id: `${runId}:signal:${question.id}`,
                  description: '自由回忆中未形成可确认回答',
                  specificity: 'vague'
                }
              ]),
              JSON.stringify(['回忆衰减', '当时紧张', '题意理解偏差']),
              '通过定向追问或短训练确认实际掌握情况',
              timestamp,
              timestamp
            )
        }
      }
      this.database.sqlite
        .prepare(
          `UPDATE review_sessions
           SET stage = 'targeted_questions', revision = revision + 1,
               draft_json = ?, updated_at = ? WHERE id = ?`
        )
        .run(
          JSON.stringify({
            ...stableDraft,
            operationStatus: 'idle',
            extraction,
            lastModelRunId: runId
          }),
          timestamp,
          row.review_session_id
        )
    })
  }

  private markOperation(
    interviewId: string,
    operationStatus: 'running' | 'retryable_error',
    lastError?: string
  ): void {
    const row = this.getReviewContext(interviewId)
    const draft = this.parseDraft(row.draft_json)
    this.database.sqlite
      .prepare(
        `UPDATE review_sessions SET stage = 'extract_review', revision = revision + 1,
         draft_json = ?, updated_at = ? WHERE id = ?`
      )
      .run(
        JSON.stringify({
          ...draft,
          operationStatus,
          ...(lastError ? { lastError } : {})
        }),
        this.now(),
        row.review_session_id
      )
  }

  private capabilityFor(question: string): string {
    const normalized = question.toLowerCase()
    if (normalized.includes('react')) return 'frontend-react'
    if (normalized.includes('rag') || normalized.includes('agent')) return 'ai-rag-agent'
    if (normalized.includes('模型') || normalized.includes('prompt')) return 'ai-model-api'
    if (normalized.includes('node')) return 'fullstack-node'
    if (normalized.includes('数据库') || normalized.includes('api')) return 'fullstack-data'
    return 'frontend-javascript'
  }
}
