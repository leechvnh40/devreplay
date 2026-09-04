import type {
  ModelRunAuditStore,
  ModelRunFailure,
  ModelRunStart,
  ModelRunSuccess,
  PromptVersion
} from '@devreplay/agent'
import { eq } from 'drizzle-orm'
import { modelRuns, promptVersions, type AppDatabase } from '../database'

export class SqliteModelRunAuditStore implements ModelRunAuditStore {
  constructor(private readonly database: AppDatabase) {}

  ensurePrompt(prompt: PromptVersion, createdAt: string): void {
    this.database.orm
      .insert(promptVersions)
      .values({ ...prompt, createdAt })
      .onConflictDoNothing()
      .run()
  }

  start(run: ModelRunStart): void {
    this.ensurePrompt(run.prompt, run.createdAt)
    this.database.orm
      .insert(modelRuns)
      .values({
        id: run.id,
        ...(run.interviewId ? { interviewId: run.interviewId } : {}),
        promptVersionId: run.prompt.id,
        provider: run.provider,
        modelId: run.modelId,
        status: 'running',
        requestJson: JSON.stringify(run.request),
        createdAt: run.createdAt,
        updatedAt: run.createdAt
      })
      .run()
  }

  succeed(runId: string, result: ModelRunSuccess): void {
    this.database.orm
      .update(modelRuns)
      .set({
        status: 'succeeded',
        responseJson: JSON.stringify(result.rawResponse),
        resultJson: JSON.stringify(result.structuredResult),
        usageJson: JSON.stringify(result.usage),
        updatedAt: result.completedAt
      })
      .where(eq(modelRuns.id, runId))
      .run()
  }

  fail(runId: string, result: ModelRunFailure): void {
    this.database.orm
      .update(modelRuns)
      .set({
        status: 'failed',
        errorJson: JSON.stringify(result.error),
        updatedAt: result.completedAt
      })
      .where(eq(modelRuns.id, runId))
      .run()
  }
}
