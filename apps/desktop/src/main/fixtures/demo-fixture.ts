export const DEMO_DATASET_ID = 'demo-golden-path-v1'
export const DEMO_TIMESTAMP = '2026-08-18T09:00:00.000Z'

export const DEMO_FIXTURE = Object.freeze({
  candidate: Object.freeze({
    targetId: 'demo-target',
    targetRole: '高级前端工程师',
    resumeId: 'demo-resume',
    resumeLabel: '合成候选资料',
    resumeContent: '七年前端工程经验；熟悉 TypeScript、React 与性能诊断。'
  }),
  interview: Object.freeze({
    id: 'demo-interview',
    company: '合成组织',
    role: '高级前端工程师',
    round: '技术面',
    occurredAt: '2026-08-18T09:00',
    jdId: 'demo-jd',
    jdContent: '负责复杂前端应用、性能优化与工程质量。'
  }),
  review: Object.freeze({
    id: 'demo-review',
    freeRecall: 'Question: How does the event loop work?\n回答时遗漏了微任务清空时机。'
  }),
  diagnosis: Object.freeze({
    id: 'demo-diagnosis',
    capabilityId: 'frontend-javascript',
    claim: '事件循环的微任务时序解释不完整',
    verificationPlan: '完成解释题并在七天后复测'
  }),
  evidence: Object.freeze({ id: 'demo-evidence', summary: '微任务时序回答缺少关键步骤' }),
  training: Object.freeze({
    id: 'demo-training',
    contractId: 'demo-contract',
    scheduleId: 'demo-schedule',
    title: '解释事件循环与微任务',
    prompt: '请解释一次事件循环中宏任务、微任务与渲染的顺序。'
  }),
  modelRun: Object.freeze({ id: 'demo-model-run', promptId: 'demo-prompt' })
})
