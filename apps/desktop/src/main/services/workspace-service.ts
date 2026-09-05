import type { TodayAction, TrainingTaskSummary } from '@devreplay/shared'
import type { TrainingPriority, TrainingPriorityFactor } from '@devreplay/domain'
import type { AppDatabase } from '../database'

interface TaskRow {
  id: string
  capability_id: string
  capability_name: string
  type: TrainingTaskSummary['type']
  status: TrainingTaskSummary['status']
  priority_json: string
  due_date: string | null
}

function readPriority(value: string): {
  role: TrainingTaskSummary['role']
  priority: TrainingPriority
} {
  const parsed = JSON.parse(value) as {
    role?: TrainingTaskSummary['role']
    priority?: TrainingPriority
  }
  return {
    role: parsed.role ?? 'candidate',
    priority: parsed.priority ?? { version: 1, score: 0, factors: [] }
  }
}

function visibleFactors(
  factors: readonly TrainingPriorityFactor[]
): TrainingTaskSummary['factors'] {
  return factors
    .filter((factor) => factor.contribution > 0)
    .sort((left, right) => right.contribution - left.contribution)
    .slice(0, 3)
    .map(({ key, label, contribution }) => ({ key, label, contribution }))
}

export class WorkspaceService {
  constructor(
    private readonly database: AppDatabase,
    private readonly now: () => string = () => new Date().toISOString()
  ) {}

  listTraining(): readonly TrainingTaskSummary[] {
    const rows = this.database.sqlite
      .prepare(
        `SELECT t.id, t.capability_id, c.name AS capability_name, t.type, t.status,
                t.priority_json, MIN(s.due_date) AS due_date
         FROM training_tasks t
         JOIN capability_nodes c ON c.id = t.capability_id
         LEFT JOIN review_schedules s ON s.training_task_id = t.id AND s.status = 'scheduled'
         GROUP BY t.id
         ORDER BY CASE t.status WHEN 'active' THEN 0 WHEN 'queued' THEN 1 ELSE 2 END, t.updated_at DESC`
      )
      .all() as TaskRow[]
    return Object.freeze(
      rows.map((row) => {
        const { role, priority } = readPriority(row.priority_json)
        return Object.freeze({
          id: row.id,
          capabilityId: row.capability_id,
          capabilityName: row.capability_name,
          type: row.type,
          status: row.status,
          role,
          score: priority.score,
          factors: visibleFactors(priority.factors),
          ...(row.due_date ? { dueDate: row.due_date } : {})
        })
      })
    )
  }

  getToday(): TodayAction {
    const tasks = this.listTraining()
    const due = tasks.find(
      (task) =>
        task.dueDate !== undefined && task.dueDate <= this.now() && task.status !== 'completed'
    )
    if (due) {
      return Object.freeze({
        kind: 'review',
        title: `复测：${due.capabilityName}`,
        description: `复测已到期（${due.dueDate}），优先验证能力是否稳定。`,
        trainingTaskId: due.id,
        factors: due.factors
      })
    }
    const main = tasks
      .filter((task) => task.status === 'active')
      .sort((left, right) => right.score - left.score)[0]
    if (main) {
      return Object.freeze({
        kind: 'training',
        title: `训练：${main.capabilityName}`,
        description: '这是当前收益最高的一个行动。',
        trainingTaskId: main.id,
        factors: main.factors
      })
    }
    return Object.freeze({
      kind: 'empty',
      title: '记录最近一次真实面试',
      description: '暂时没有到期复测或活跃训练，从真实经历开始建立证据。',
      factors: []
    })
  }
}
