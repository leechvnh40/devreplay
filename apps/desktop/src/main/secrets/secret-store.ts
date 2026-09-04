import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

export interface SecretCipher {
  isAvailable(): boolean
  encrypt(value: string): Buffer
  decrypt(value: Buffer): string
}

interface SecretsFileV1 {
  version: 1
  deepseekApiKey: string
}

export class SecretStore {
  constructor(
    private readonly filename: string,
    private readonly cipher: SecretCipher
  ) {}

  hasDeepSeekApiKey(): boolean {
    return this.readFile() !== undefined
  }

  setDeepSeekApiKey(apiKey: string): void {
    if (!this.cipher.isAvailable()) {
      throw new Error('当前系统安全凭据能力不可用，无法保存 API Key')
    }

    const normalized = apiKey.trim()
    if (!normalized) throw new Error('DeepSeek API Key 不能为空')

    const document: SecretsFileV1 = {
      version: 1,
      deepseekApiKey: this.cipher.encrypt(normalized).toString('base64')
    }
    mkdirSync(dirname(this.filename), { recursive: true })
    const temporaryFilename = `${this.filename}.tmp`
    writeFileSync(temporaryFilename, JSON.stringify(document), { encoding: 'utf8', mode: 0o600 })
    renameSync(temporaryFilename, this.filename)
  }

  getDeepSeekApiKey(): string | undefined {
    const document = this.readFile()
    if (!document) return undefined
    return this.cipher.decrypt(Buffer.from(document.deepseekApiKey, 'base64'))
  }

  private readFile(): SecretsFileV1 | undefined {
    let raw: string
    try {
      raw = readFileSync(this.filename, 'utf8')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
      throw error
    }

    const parsed: unknown = JSON.parse(raw)
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('version' in parsed) ||
      parsed.version !== 1 ||
      !('deepseekApiKey' in parsed) ||
      typeof parsed.deepseekApiKey !== 'string'
    ) {
      throw new Error('DevReplay 凭据文件格式无效')
    }
    return { version: 1, deepseekApiKey: parsed.deepseekApiKey }
  }
}
