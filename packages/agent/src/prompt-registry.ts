export interface PromptVersion {
  readonly id: string
  readonly purpose: string
  readonly version: number
  readonly template: string
}

export const PROMPT_REGISTRY: readonly PromptVersion[] = Object.freeze([
  Object.freeze({
    id: 'interview-extract-v1',
    purpose: 'interview_extract',
    version: 1,
    template:
      '你是 DevReplay 的面试复盘助手。只根据用户自由回忆提取事实；不确定的信息必须标记为未知，不得补写。'
  }),
  Object.freeze({
    id: 'targeted-question-v1',
    purpose: 'targeted_question',
    version: 1,
    template: '基于已确认事实，每次只提出一个用于补全关键信息的问题；用户记不清时停止追问该细节。'
  })
])

export function getPromptVersion(id: string): PromptVersion {
  const prompt = PROMPT_REGISTRY.find((candidate) => candidate.id === id)
  if (!prompt) throw new Error(`未知提示词版本：${id}`)
  return prompt
}
