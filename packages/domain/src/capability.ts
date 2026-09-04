import type { CapabilityState } from './evidence'

export interface CapabilityNode {
  readonly id: string
  readonly parentId?: string
  readonly name: string
  readonly category: 'frontend' | 'fullstack' | 'ai_application'
  readonly userConfirmed: boolean
}

export const INITIAL_CAPABILITY_SKELETON: readonly CapabilityNode[] = Object.freeze([
  { id: 'frontend', name: '前端工程', category: 'frontend', userConfirmed: true },
  {
    id: 'frontend-javascript',
    parentId: 'frontend',
    name: 'JavaScript / TypeScript',
    category: 'frontend',
    userConfirmed: true
  },
  {
    id: 'frontend-react',
    parentId: 'frontend',
    name: 'React 工程化',
    category: 'frontend',
    userConfirmed: true
  },
  { id: 'fullstack', name: '全栈工程', category: 'fullstack', userConfirmed: true },
  {
    id: 'fullstack-node',
    parentId: 'fullstack',
    name: 'Node.js 服务端',
    category: 'fullstack',
    userConfirmed: true
  },
  {
    id: 'fullstack-data',
    parentId: 'fullstack',
    name: '数据库与 API',
    category: 'fullstack',
    userConfirmed: true
  },
  { id: 'ai-application', name: 'AI 应用工程', category: 'ai_application', userConfirmed: true },
  {
    id: 'ai-model-api',
    parentId: 'ai-application',
    name: '模型 API 与结构化输出',
    category: 'ai_application',
    userConfirmed: true
  },
  {
    id: 'ai-rag-agent',
    parentId: 'ai-application',
    name: 'RAG 与 Agent 工程',
    category: 'ai_application',
    userConfirmed: true
  }
])

export const CAPABILITY_STATE_LABELS: Readonly<Record<CapabilityState, string>> = Object.freeze({
  unknown: '未知',
  pending: '待验证',
  weak: '薄弱',
  basic: '基本可靠',
  stable: '稳定'
})
