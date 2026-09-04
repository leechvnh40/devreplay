import type { InterviewRepository } from '@devreplay/domain'
import { openAppDatabase, type AppDatabase } from './database'
import { SqliteInterviewRepository } from './repositories/sqlite-interview-repository'
import { OnboardingService } from './services/onboarding-service'
import { InterviewReviewService } from './services/interview-review-service'
import { ModelSettingsService } from './services/model-settings-service'
import { CapabilityCatalogService } from './services/capability-catalog-service'
import { ElectronSafeStorageCipher } from './secrets/electron-safe-storage-cipher'
import { SecretStore } from './secrets/secret-store'

export interface CompositionRoot {
  readonly database: AppDatabase
  readonly interviews: InterviewRepository
  readonly onboarding: OnboardingService
  readonly reviews: InterviewReviewService
  readonly modelSettings: ModelSettingsService
  readonly capabilities: CapabilityCatalogService
  dispose(): void
}

export function createCompositionRoot(databasePath: string, secretsPath: string): CompositionRoot {
  const database = openAppDatabase(databasePath)

  const interviews = new SqliteInterviewRepository(database)
  const capabilities = new CapabilityCatalogService(database)
  capabilities.ensureInitialSkeleton()
  return Object.freeze({
    database,
    interviews,
    capabilities,
    onboarding: new OnboardingService(database, interviews),
    reviews: new InterviewReviewService(database, interviews),
    modelSettings: new ModelSettingsService(
      database,
      new SecretStore(secretsPath, new ElectronSafeStorageCipher())
    ),
    dispose: () => database.close()
  })
}
