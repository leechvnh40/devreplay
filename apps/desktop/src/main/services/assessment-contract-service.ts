import type { AssessmentContract, AssessmentContractContent } from '@devreplay/domain'
import { runInTransaction, type AppDatabase } from '../database'
import { PreconditionError } from './onboarding-service'

interface ContractRow {
  id: string
  training_task_id: string
  version: number
  contract_json: string
  created_at: string
}

export class AssessmentContractService {
  constructor(
    private readonly database: AppDatabase,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly nextId: () => string = () => crypto.randomUUID()
  ) {}

  persistInitial(trainingTaskId: string, content: AssessmentContractContent): AssessmentContract {
    return runInTransaction(this.database.sqlite, () => {
      this.requireTask(trainingTaskId)
      const existing = this.latestRow(trainingTaskId)
      if (existing) throw new PreconditionError('训练任务已经存在验收契约')
      return this.insert(trainingTaskId, 1, content)
    })
  }

  revise(trainingTaskId: string, content: AssessmentContractContent): AssessmentContract {
    return runInTransaction(this.database.sqlite, () => {
      const previous = this.latestRow(trainingTaskId)
      if (!previous) throw new PreconditionError('必须先持久化初始验收契约')
      return this.insert(trainingTaskId, previous.version + 1, content)
    })
  }

  getForAnswering(trainingTaskId: string): AssessmentContract {
    const row = this.latestRow(trainingTaskId)
    if (!row) throw new PreconditionError('验收契约尚未持久化，不能开始作答')
    return this.map(row)
  }

  listVersions(trainingTaskId: string): readonly AssessmentContract[] {
    return Object.freeze(
      (
        this.database.sqlite
          .prepare(
            `SELECT id, training_task_id, version, contract_json, created_at
           FROM assessment_contracts WHERE training_task_id = ? ORDER BY version`
          )
          .all(trainingTaskId) as ContractRow[]
      ).map((row) => this.map(row))
    )
  }

  private insert(
    trainingTaskId: string,
    version: number,
    content: AssessmentContractContent
  ): AssessmentContract {
    const contract: AssessmentContract = Object.freeze({
      id: this.nextId(),
      trainingTaskId,
      version,
      content,
      createdAt: this.now()
    })
    this.database.sqlite
      .prepare(
        `INSERT INTO assessment_contracts
         (id, training_task_id, version, contract_json, created_at) VALUES (?, ?, ?, ?, ?)`
      )
      .run(
        contract.id,
        contract.trainingTaskId,
        contract.version,
        JSON.stringify(contract.content),
        contract.createdAt
      )
    return contract
  }

  private latestRow(trainingTaskId: string): ContractRow | undefined {
    return this.database.sqlite
      .prepare(
        `SELECT id, training_task_id, version, contract_json, created_at
         FROM assessment_contracts WHERE training_task_id = ? ORDER BY version DESC LIMIT 1`
      )
      .get(trainingTaskId) as ContractRow | undefined
  }

  private map(row: ContractRow): AssessmentContract {
    return Object.freeze({
      id: row.id,
      trainingTaskId: row.training_task_id,
      version: row.version,
      content: JSON.parse(row.contract_json) as AssessmentContractContent,
      createdAt: row.created_at
    })
  }

  private requireTask(trainingTaskId: string): void {
    const row = this.database.sqlite
      .prepare('SELECT id FROM training_tasks WHERE id = ?')
      .get(trainingTaskId)
    if (!row) throw new PreconditionError('训练任务不存在')
  }
}
