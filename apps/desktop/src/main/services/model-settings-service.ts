import type { IpcRequestPayload, ModelSettings } from '@devreplay/shared'
import { eq } from 'drizzle-orm'
import { settings, type AppDatabase } from '../database'
import type { SecretStore } from '../secrets/secret-store'
import { PreconditionError } from './onboarding-service'

const DEFAULT_MODEL_ID = 'deepseek-chat'
const CLOUD_NOTICE = '生成、诊断和评分时，只有你在发送预览中确认的内容会发送到 DeepSeek 云端。'

export interface SettingsLogSink {
  info(message: string, metadata: Readonly<Record<string, unknown>>): void
}

const silentLog: SettingsLogSink = { info: () => undefined }

export class ModelSettingsService {
  constructor(
    private readonly database: AppDatabase,
    private readonly secretStore: SecretStore,
    private readonly log: SettingsLogSink = silentLog,
    private readonly now: () => string = () => new Date().toISOString()
  ) {}

  getSettings(): ModelSettings {
    const model = this.database.orm
      .select()
      .from(settings)
      .where(eq(settings.key, 'deepseek-model-id'))
      .get()

    return {
      provider: 'deepseek',
      modelId: model ? this.parseModelId(model.valueJson) : DEFAULT_MODEL_ID,
      keyConfigured: this.secretStore.hasDeepSeekApiKey(),
      cloudNotice: CLOUD_NOTICE
    }
  }

  saveSettings(payload: IpcRequestPayload<'model.save-settings'>): ModelSettings {
    const hasExistingKey = this.secretStore.hasDeepSeekApiKey()
    if (!payload.apiKey && !hasExistingKey) {
      throw new PreconditionError('首次配置必须提供 DeepSeek API Key')
    }

    if (payload.apiKey) this.secretStore.setDeepSeekApiKey(payload.apiKey)

    this.database.orm
      .insert(settings)
      .values({
        key: 'deepseek-model-id',
        valueJson: JSON.stringify(payload.modelId),
        updatedAt: this.now()
      })
      .onConflictDoUpdate({
        target: settings.key,
        set: { valueJson: JSON.stringify(payload.modelId), updatedAt: this.now() }
      })
      .run()

    const state = this.getSettings()
    this.log.info('DeepSeek settings updated', {
      provider: state.provider,
      modelId: state.modelId,
      keyConfigured: state.keyConfigured
    })
    return state
  }

  getApiKeyForModelRequest(): string {
    const apiKey = this.secretStore.getDeepSeekApiKey()
    if (!apiKey) throw new PreconditionError('尚未配置 DeepSeek API Key')
    return apiKey
  }

  private parseModelId(value: string): string {
    const parsed: unknown = JSON.parse(value)
    if (typeof parsed !== 'string' || !parsed.trim()) throw new Error('模型 ID 设置损坏')
    return parsed
  }
}
