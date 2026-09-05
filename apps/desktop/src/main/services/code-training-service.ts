import type { AssessmentContractContent, TrainingAssessmentResult } from '@devreplay/domain'
import { runInSandbox, type SandboxResult } from '@devreplay/sandbox'
import type { CodeTrainingTask } from '@devreplay/shared'
import type { AppDatabase } from '../database'
import { PreconditionError } from './onboarding-service'
import { TrainingAttemptService } from './training-attempt-service'

interface TaskRow {
  id: string
  type: string
  priority_json: string
}

interface ContractRow {
  id: string
  version: number
  contract_json: string
}

interface TaskPresentation {
  title?: string
  prompt?: string
  starterCode?: string
}

export class CodeTrainingService {
  private readonly attempts: TrainingAttemptService

  constructor(
    private readonly database: AppDatabase,
    now: () => string = () => new Date().toISOString(),
    nextId: () => string = () => crypto.randomUUID()
  ) {
    this.attempts = new TrainingAttemptService(database, now, nextId)
  }

  getTask(trainingTaskId: string): CodeTrainingTask {
    const { task, contract } = this.requireTask(trainingTaskId)
    const content = JSON.parse(contract.contract_json) as AssessmentContractContent
    if (content.type !== 'code') throw new PreconditionError('训练任务不是代码题')
    const presentation = JSON.parse(task.priority_json) as TaskPresentation
    return Object.freeze({
      id: task.id,
      title: presentation.title ?? '代码训练',
      prompt: presentation.prompt ?? content.objective,
      starterCode: presentation.starterCode ?? '',
      language: content.language,
      assessmentContractId: contract.id,
      assessmentContractVersion: contract.version,
      publicTests: content.publicTests.map((test) => ({
        name: test.name,
        args: [...test.args],
        expected: test.expected
      }))
    })
  }

  async run(trainingTaskId: string, source: string): Promise<SandboxResult> {
    const { contract } = this.requireTask(trainingTaskId)
    const content = JSON.parse(contract.contract_json) as AssessmentContractContent
    if (content.type !== 'code') throw new PreconditionError('训练任务不是代码题')
    return runInSandbox({
      source,
      language: content.language,
      functionName: content.functionName,
      publicTests: content.publicTests,
      hiddenTests: content.hiddenTests
    })
  }

  async submit(
    trainingTaskId: string,
    source: string,
    modelEvaluation?: string
  ): Promise<{
    readonly attemptId: string
    readonly passed: boolean
    readonly testResult: SandboxResult
  }> {
    const { contract } = this.requireTask(trainingTaskId)
    const testResult = await this.run(trainingTaskId, source)
    const assessment: TrainingAssessmentResult = Object.freeze({
      passed: testResult.passed,
      evidence: Object.freeze([
        `公开测试 ${testResult.publicResults.filter((item) => item.passed).length}/${testResult.publicResults.length}`,
        `隐藏测试 ${testResult.hiddenResults.filter((item) => item.passed).length}/${testResult.hiddenResults.length}`,
        ...(modelEvaluation ? [`模型补充评价：${modelEvaluation}`] : [])
      ]),
      reason: testResult.passed ? '全部必需测试通过' : '至少一个必需测试失败'
    })
    const attempt = this.attempts.record(trainingTaskId, contract.id, source, assessment)
    return Object.freeze({ attemptId: attempt.id, passed: testResult.passed, testResult })
  }

  private requireTask(trainingTaskId: string): { task: TaskRow; contract: ContractRow } {
    const task = this.database.sqlite
      .prepare('SELECT id, type, priority_json FROM training_tasks WHERE id = ?')
      .get(trainingTaskId) as TaskRow | undefined
    if (!task) throw new PreconditionError('训练任务不存在')
    if (task.type !== 'code') throw new PreconditionError('训练任务不是代码题')
    const contract = this.database.sqlite
      .prepare(
        `SELECT id, version, contract_json FROM assessment_contracts
         WHERE training_task_id = ? ORDER BY version DESC LIMIT 1`
      )
      .get(trainingTaskId) as ContractRow | undefined
    if (!contract) throw new PreconditionError('验收契约尚未持久化，不能开始作答')
    return { task, contract }
  }
}
