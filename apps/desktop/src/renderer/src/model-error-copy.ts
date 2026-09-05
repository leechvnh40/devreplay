import type { IpcError } from '@devreplay/shared'

const MODEL_ERROR_COPY: Partial<Record<IpcError['code'], string>> = {
  MODEL_NETWORK: '当前无法连接 DeepSeek。请检查网络后重试；你的输入仍保存在本机。',
  MODEL_AUTHENTICATION: 'DeepSeek 鉴权失败。请检查 API Key 后重试；不会自动改用其他模型。',
  MODEL_RATE_LIMIT: 'DeepSeek 暂时限流。稍后可从当前阶段重试；你的输入不会丢失。',
  MODEL_TIMEOUT: 'DeepSeek 请求超时。可直接重试；不会自动切换模型。',
  MODEL_INVALID_RESPONSE: 'DeepSeek 返回的结构无法验证。原始输入已保留，可重新发送。',
  MODEL_CANCELLED: '请求已取消。原始输入已保留。'
}

export function modelErrorMessage(error: IpcError): string {
  return MODEL_ERROR_COPY[error.code] ?? error.message
}
