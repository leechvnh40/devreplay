import {
  calculateTrainingPriority,
  type CapabilityState,
  type TrainingPriorityInput
} from '@devreplay/domain'
import type { CapabilityProfileData } from '@devreplay/shared'
import { runInTransaction, type AppDatabase } from '../database'
import { PreconditionError } from './onboarding-service'

interface PriorityEnvelope {
  role?: 'main' | 'candidate'
  priority?: { userOverride?: TrainingPriorityInput['userOverride'] }
  priorityInput?: TrainingPriorityInput
  [key: string]: unknown
}

export class CapabilityProfileService {
  constructor(
    private readonly database: AppDatabase,
    private readonly now: () => string = () => new Date().toISOString()
  ) {}

  getProfile(): CapabilityProfileData {
    const targets = this.database.sqlite
      .prepare('SELECT id, title, active FROM target_profiles ORDER BY active DESC, created_at, id')
      .all() as { id: string; title: string; active: number }[]
    const activeTarget = targets.find((target) => Boolean(target.active))
    const nodes = this.database.sqlite
      .prepare(
        `SELECT n.id, n.parent_id, n.name, n.category, n.user_confirmed,
                COALESCE(p.state, 'unknown') AS state, COALESCE(p.reason_json, '{}') AS reason_json,
                COALESCE(w.weight, 0) AS target_weight
         FROM capability_nodes n
         LEFT JOIN capability_projection p ON p.capability_id = n.id
         LEFT JOIN target_capability_weights w ON w.capability_id = n.id AND w.target_profile_id = ?
         ORDER BY target_weight DESC, n.created_at, n.id`
      )
      .all(activeTarget?.id ?? '') as Array<{
      id: string
      parent_id: string | null
      name: string
      category: 'frontend' | 'fullstack' | 'ai_application'
      user_confirmed: number
      state: CapabilityState
      reason_json: string
      target_weight: number
    }>
    const evidenceQuery = this.database.sqlite.prepare(
      `SELECT id, polarity, source_type, content_json, created_at
       FROM evidence_entries WHERE capability_id = ? ORDER BY created_at DESC, id DESC`
    )
    return Object.freeze({
      targets: targets.map((target) => ({ ...target, active: Boolean(target.active) })),
      ...(activeTarget ? { activeTargetId: activeTarget.id } : {}),
      capabilities: nodes.map((node) => ({
        id: node.id,
        ...(node.parent_id ? { parentId: node.parent_id } : {}),
        name: node.name,
        category: node.category,
        userConfirmed: Boolean(node.user_confirmed),
        state: node.state,
        reason: this.reason(node.reason_json),
        targetWeight: node.target_weight,
        evidence: (
          evidenceQuery.all(node.id) as Array<{
            id: string
            polarity: 'positive' | 'negative' | 'neutral'
            source_type: string
            content_json: string
            created_at: string
          }>
        ).map((item) => ({
          id: item.id,
          polarity: item.polarity,
          sourceType: item.source_type,
          summary: this.reason(item.content_json),
          createdAt: item.created_at
        }))
      }))
    })
  }

  switchTarget(targetProfileId: string): CapabilityProfileData {
    const target = this.database.sqlite
      .prepare('SELECT id FROM target_profiles WHERE id = ?')
      .get(targetProfileId)
    if (!target) throw new PreconditionError('目标岗位不存在')
    runInTransaction(this.database.sqlite, () => {
      this.database.sqlite.prepare('UPDATE target_profiles SET active = 0').run()
      this.database.sqlite
        .prepare('UPDATE target_profiles SET active = 1, updated_at = ? WHERE id = ?')
        .run(this.now(), targetProfileId)
      const tasks = this.database.sqlite
        .prepare(
          "SELECT id, capability_id, priority_json FROM training_tasks WHERE status IN ('active', 'queued')"
        )
        .all() as { id: string; capability_id: string; priority_json: string }[]
      const weightQuery = this.database.sqlite.prepare(
        'SELECT weight FROM target_capability_weights WHERE target_profile_id = ? AND capability_id = ?'
      )
      const update = this.database.sqlite.prepare(
        'UPDATE training_tasks SET priority_json = ?, updated_at = ? WHERE id = ?'
      )
      for (const task of tasks) {
        const envelope = JSON.parse(task.priority_json) as PriorityEnvelope
        const input: TrainingPriorityInput = {
          targetRelevance:
            (weightQuery.get(targetProfileId, task.capability_id) as { weight: number } | undefined)
              ?.weight ?? 0,
          evidenceStrength: envelope.priorityInput?.evidenceStrength ?? 0,
          recurrenceCount: envelope.priorityInput?.recurrenceCount ?? 0,
          impact: envelope.priorityInput?.impact ?? 0,
          daysSinceVerified: envelope.priorityInput?.daysSinceVerified ?? 0,
          estimatedMinutes: envelope.priorityInput?.estimatedMinutes ?? 30,
          ...(envelope.priorityInput?.daysUntilInterview !== undefined
            ? { daysUntilInterview: envelope.priorityInput.daysUntilInterview }
            : {}),
          ...(envelope.priority?.userOverride
            ? { userOverride: envelope.priority.userOverride }
            : {})
        }
        update.run(
          JSON.stringify({
            ...envelope,
            priorityInput: input,
            priority: calculateTrainingPriority(input)
          }),
          this.now(),
          task.id
        )
      }
    })
    return this.getProfile()
  }

  private reason(json: string): string {
    try {
      const value = JSON.parse(json) as unknown
      if (typeof value === 'string') return value
      if (value && typeof value === 'object') {
        const record = value as Record<string, unknown>
        for (const key of ['summary', 'reason', 'claim']) {
          if (typeof record[key] === 'string') return record[key]
        }
      }
    } catch {
      return json
    }
    return '暂无可读说明'
  }
}
