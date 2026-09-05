import type { InterviewRepository } from '@devreplay/domain'
import { openAppDatabase, type AppDatabase } from './database'
import { SqliteInterviewRepository } from './repositories/sqlite-interview-repository'
import { OnboardingService } from './services/onboarding-service'
import { InterviewReviewService } from './services/interview-review-service'
import { ModelSettingsService } from './services/model-settings-service'
import { ReviewAnalysisService } from './services/review-analysis-service'
import type { ReviewAnalysisProviderFactory } from './services/review-analysis-service'
import { ReviewFlowService } from './services/review-flow-service'
import { CapabilityCatalogService } from './services/capability-catalog-service'
import { ElectronSafeStorageCipher } from './secrets/electron-safe-storage-cipher'
import { SecretStore } from './secrets/secret-store'
import { CodeTrainingService } from './services/code-training-service'
import { WorkspaceService } from './services/workspace-service'
import { CapabilityProfileService } from './services/capability-profile-service'
import { DemoDataService } from './services/demo-data-service'
import { DataLifecycleService } from './services/data-lifecycle-service'
import { ExplanationTrainingService } from './services/explanation-training-service'

export interface CompositionRoot {
  readonly database: AppDatabase
  readonly interviews: InterviewRepository
  readonly onboarding: OnboardingService
  readonly reviews: InterviewReviewService
  readonly modelSettings: ModelSettingsService
  readonly analysis: ReviewAnalysisService
  readonly reviewFlow: ReviewFlowService
  readonly capabilities: CapabilityCatalogService
  readonly codeTraining: CodeTrainingService
  readonly workspace: WorkspaceService
  readonly capabilityProfile: CapabilityProfileService
  readonly demo: DemoDataService
  readonly dataLifecycle: DataLifecycleService
  readonly explanationTraining: ExplanationTrainingService
  dispose(): void
}

export interface CompositionRootOptions {
  readonly providerFactory?: ReviewAnalysisProviderFactory
}

export function createCompositionRoot(
  databasePath: string,
  secretsPath: string,
  options: CompositionRootOptions = {}
): CompositionRoot {
  const database = openAppDatabase(databasePath)

  const interviews = new SqliteInterviewRepository(database)
  const capabilities = new CapabilityCatalogService(database)
  capabilities.ensureInitialSkeleton()
  const secretStore = new SecretStore(secretsPath, new ElectronSafeStorageCipher())
  const modelSettings = new ModelSettingsService(database, secretStore)
  const reviewFlow = new ReviewFlowService(database)
  reviewFlow.recoverInterruptedOperations()
  return Object.freeze({
    database,
    interviews,
    capabilities,
    codeTraining: new CodeTrainingService(database),
    workspace: new WorkspaceService(database),
    capabilityProfile: new CapabilityProfileService(database),
    demo: new DemoDataService(database),
    dataLifecycle: new DataLifecycleService(database, modelSettings),
    explanationTraining: new ExplanationTrainingService(database),
    onboarding: new OnboardingService(database, interviews),
    reviews: new InterviewReviewService(database, interviews),
    modelSettings,
    analysis: options.providerFactory
      ? new ReviewAnalysisService(database, modelSettings, options.providerFactory)
      : new ReviewAnalysisService(database, modelSettings),
    reviewFlow,
    dispose: () => database.close()
  })
}
