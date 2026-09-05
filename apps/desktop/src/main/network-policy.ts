export const DEEPSEEK_API_ORIGIN = 'https://api.deepseek.com'

export function authorizeDeepSeekRequest(userConfirmedPreview: boolean): string {
  if (!userConfirmedPreview) throw new Error('必须由用户确认发送预览后才能请求 DeepSeek')
  return DEEPSEEK_API_ORIGIN
}
