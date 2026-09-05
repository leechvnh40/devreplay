import { calculateTrainingPriority } from '@devreplay/domain'
import { runInTransaction, type AppDatabase } from '../database'
import { DEMO_DATASET_ID, DEMO_FIXTURE, DEMO_TIMESTAMP } from '../fixtures/demo-fixture'

export class DemoDataService {
  constructor(private readonly database: AppDatabase) {}

  status(): { loaded: boolean; datasetKind: 'demo' } {
    return {
      loaded: Boolean(
        this.database.sqlite
          .prepare('SELECT 1 FROM datasets WHERE id = ? AND dataset_kind = ?')
          .get(DEMO_DATASET_ID, 'demo')
      ),
      datasetKind: 'demo'
    }
  }

  load(): { loaded: true; interviewId: string; trainingTaskId: string; datasetKind: 'demo' } {
    if (!this.status().loaded) runInTransaction(this.database.sqlite, () => this.insert())
    return {
      loaded: true,
      interviewId: DEMO_FIXTURE.interview.id,
      trainingTaskId: DEMO_FIXTURE.training.id,
      datasetKind: 'demo'
    }
  }

  clear(): { cleared: boolean; datasetKind: 'demo' } {
    if (!this.status().loaded) return { cleared: false, datasetKind: 'demo' }
    runInTransaction(this.database.sqlite, () => {
      for (const [table, column, value] of [
        ['context_manifest_items', 'model_run_id', DEMO_FIXTURE.modelRun.id],
        ['model_runs', 'id', DEMO_FIXTURE.modelRun.id],
        ['prompt_versions', 'id', DEMO_FIXTURE.modelRun.promptId],
        ['review_schedules', 'id', DEMO_FIXTURE.training.scheduleId],
        ['assessment_contracts', 'id', DEMO_FIXTURE.training.contractId],
        ['training_tasks', 'id', DEMO_FIXTURE.training.id],
        ['evidence_entries', 'id', DEMO_FIXTURE.evidence.id],
        ['diagnostic_hypotheses', 'id', DEMO_FIXTURE.diagnosis.id],
        ['review_sessions', 'id', DEMO_FIXTURE.review.id],
        ['interviews', 'id', DEMO_FIXTURE.interview.id],
        ['job_descriptions', 'id', DEMO_FIXTURE.interview.jdId],
        ['target_capability_weights', 'target_profile_id', DEMO_FIXTURE.candidate.targetId],
        ['target_profiles', 'id', DEMO_FIXTURE.candidate.targetId],
        ['resume_snapshots', 'id', DEMO_FIXTURE.candidate.resumeId],
        ['capability_projection', 'capability_id', 'demo-capability'],
        ['capability_nodes', 'id', 'demo-capability']
      ] as const) {
        this.database.sqlite.prepare(`DELETE FROM ${table} WHERE ${column} = ?`).run(value)
      }
      this.database.sqlite.prepare('DELETE FROM datasets WHERE id = ?').run(DEMO_DATASET_ID)
      this.database.sqlite
        .prepare(
          `UPDATE target_profiles SET active = 1
           WHERE id = (SELECT id FROM target_profiles ORDER BY updated_at DESC, id LIMIT 1)`
        )
        .run()
    })
    return { cleared: true, datasetKind: 'demo' }
  }

  private insert(): void {
    const f = DEMO_FIXTURE
    const sql = this.database.sqlite
    sql.prepare('UPDATE target_profiles SET active = 0').run()
    sql
      .prepare('INSERT INTO datasets (id, dataset_kind, created_at) VALUES (?, ?, ?)')
      .run(DEMO_DATASET_ID, 'demo', DEMO_TIMESTAMP)
    sql
      .prepare(`INSERT INTO dataset_records (dataset_id, table_name, record_id) VALUES (?, ?, ?)`)
      .run(DEMO_DATASET_ID, 'dataset', DEMO_DATASET_ID)
    sql
      .prepare(
        `INSERT INTO capability_nodes (id, parent_id, name, category, user_confirmed, created_at, updated_at) VALUES ('demo-capability', 'frontend-javascript', '事件循环与任务调度', 'frontend', 1, ?, ?)`
      )
      .run(DEMO_TIMESTAMP, DEMO_TIMESTAMP)
    sql
      .prepare('INSERT INTO resume_snapshots (id, label, content, captured_at) VALUES (?, ?, ?, ?)')
      .run(f.candidate.resumeId, f.candidate.resumeLabel, f.candidate.resumeContent, DEMO_TIMESTAMP)
    sql
      .prepare('INSERT INTO job_descriptions (id, content, captured_at) VALUES (?, ?, ?)')
      .run(f.interview.jdId, f.interview.jdContent, DEMO_TIMESTAMP)
    sql
      .prepare(
        `INSERT INTO target_profiles (id, title, direction, active, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)`
      )
      .run(
        f.candidate.targetId,
        f.candidate.targetRole,
        f.candidate.targetRole,
        DEMO_TIMESTAMP,
        DEMO_TIMESTAMP
      )
    sql
      .prepare(
        `INSERT INTO target_capability_weights (target_profile_id, capability_id, weight, updated_at) VALUES (?, 'demo-capability', 100, ?)`
      )
      .run(f.candidate.targetId, DEMO_TIMESTAMP)
    sql
      .prepare(
        `INSERT INTO interviews (id, company, role, occurred_at, round, resume_snapshot_id, job_description_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        f.interview.id,
        f.interview.company,
        f.interview.role,
        f.interview.occurredAt,
        f.interview.round,
        f.candidate.resumeId,
        f.interview.jdId,
        DEMO_TIMESTAMP,
        DEMO_TIMESTAMP
      )
    sql
      .prepare(
        `INSERT INTO review_sessions (id, interview_id, stage, revision, draft_json, created_at, updated_at) VALUES (?, ?, 'completed', 1, ?, ?, ?)`
      )
      .run(
        f.review.id,
        f.interview.id,
        JSON.stringify({
          freeRecall: f.review.freeRecall,
          evidenceAcknowledged: true,
          trainingDecisionReason: '已创建训练任务'
        }),
        DEMO_TIMESTAMP,
        DEMO_TIMESTAMP
      )
    sql
      .prepare(
        `INSERT INTO diagnostic_hypotheses (id, review_session_id, capability_id, claim, evidence_json, alternatives_json, confidence, verification_plan, resolution, created_at, updated_at) VALUES (?, ?, 'demo-capability', ?, ?, '[]', 'medium', ?, 'confirmed', ?, ?)`
      )
      .run(
        f.diagnosis.id,
        f.review.id,
        f.diagnosis.claim,
        JSON.stringify([
          { id: 'demo-signal', description: f.evidence.summary, specificity: 'specific' }
        ]),
        f.diagnosis.verificationPlan,
        DEMO_TIMESTAMP,
        DEMO_TIMESTAMP
      )
    sql
      .prepare(
        `INSERT INTO evidence_entries (id, capability_id, interview_id, source_type, polarity, strength, content_json, created_at) VALUES (?, 'demo-capability', ?, 'real_interview', 'negative', 2, ?, ?)`
      )
      .run(
        f.evidence.id,
        f.interview.id,
        JSON.stringify({ summary: f.evidence.summary }),
        DEMO_TIMESTAMP
      )
    sql
      .prepare(
        `INSERT INTO capability_projection (capability_id, state, reason_json, rebuilt_at) VALUES ('demo-capability', 'weak', ?, ?)`
      )
      .run(JSON.stringify({ reason: '真实面试中出现具体反驳证据' }), DEMO_TIMESTAMP)
    const priorityInput = {
      targetRelevance: 100,
      evidenceStrength: 2,
      recurrenceCount: 1,
      impact: 3,
      daysSinceVerified: 30,
      estimatedMinutes: 20
    }
    sql
      .prepare(
        `INSERT INTO training_tasks (id, capability_id, interview_id, type, status, priority_json, created_at, updated_at) VALUES (?, 'demo-capability', ?, 'explanation', 'active', ?, ?, ?)`
      )
      .run(
        f.training.id,
        f.interview.id,
        JSON.stringify({
          role: 'main',
          title: f.training.title,
          prompt: f.training.prompt,
          priorityInput,
          priority: calculateTrainingPriority(priorityInput)
        }),
        DEMO_TIMESTAMP,
        DEMO_TIMESTAMP
      )
    sql
      .prepare(
        `INSERT INTO assessment_contracts (id, training_task_id, version, contract_json, created_at) VALUES (?, ?, 1, ?, ?)`
      )
      .run(
        f.training.contractId,
        f.training.id,
        JSON.stringify({
          type: 'explanation',
          objective: '准确解释事件循环时序',
          requiredPoints: ['宏任务', '微任务', '渲染'],
          allowedVariants: [],
          commonMisconceptions: ['微任务在渲染后执行'],
          passRule: '覆盖全部必需点且没有关键误解',
          maxFollowUps: 2
        }),
        DEMO_TIMESTAMP
      )
    sql
      .prepare(
        `INSERT INTO prompt_versions (id, purpose, version, template, created_at) VALUES (?, 'review_extraction', 1, 'demo prerecorded fixture', ?)`
      )
      .run(f.modelRun.promptId, DEMO_TIMESTAMP)
    sql
      .prepare(
        `INSERT INTO model_runs (id, interview_id, prompt_version_id, provider, model_id, status, request_json, response_json, result_json, usage_json, created_at, updated_at) VALUES (?, ?, ?, 'fixture', 'prerecorded-demo', 'succeeded', '{}', ?, ?, '{"inputTokens":0,"outputTokens":0,"totalTokens":0}', ?, ?)`
      )
      .run(
        f.modelRun.id,
        f.interview.id,
        f.modelRun.promptId,
        JSON.stringify({ prerecorded: true }),
        JSON.stringify({ fixture: 'demo-review-v1' }),
        DEMO_TIMESTAMP,
        DEMO_TIMESTAMP
      )
  }
}
