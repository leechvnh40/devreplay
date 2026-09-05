import { describe, expect, it } from 'vitest'
import { generatedTrainingSchema } from './training-schemas'

const codeTraining = {
  type: 'code',
  capabilityId: 'frontend-javascript',
  title: '数组去重',
  objective: '实现保持顺序的数组去重',
  estimatedMinutes: 20,
  retestAfterDays: 7,
  prompt: '实现 unique(values)',
  starterCode: 'function unique(values) {}',
  contract: {
    functionName: 'unique',
    language: 'javascript',
    publicTests: [{ name: '基础输入', args: [[1, 1, 2]], expected: [1, 2] }],
    hiddenTests: [{ name: '空数组', args: [[]], expected: [] }],
    requiresDom: false,
    requiresNode: false,
    externalDependencies: [],
    passRule: 'all_tests'
  }
}

describe('训练生成 schema', () => {
  it('接受 15 至 30 分钟的解释题', () => {
    expect(
      generatedTrainingSchema.parse({
        type: 'explanation',
        capabilityId: 'frontend-javascript',
        title: '解释事件循环',
        objective: '说明微任务与宏任务顺序',
        estimatedMinutes: 15,
        retestAfterDays: 7,
        prompt: '解释以下代码的输出顺序',
        contract: {
          requiredPoints: ['调用栈', '微任务'],
          allowedVariants: ['宏任务可称 task'],
          commonMisconceptions: ['Promise 回调同步执行'],
          passRule: '覆盖全部必备点且无关键误区',
          maxFollowUps: 2
        }
      }).type
    ).toBe('explanation')
  })

  it.each([
    ['DOM', { requiresDom: true }],
    ['Node', { requiresNode: true }],
    ['外部依赖', { externalDependencies: ['lodash'] }]
  ])('拒绝要求 %s 的代码题', (_label, override) => {
    expect(() =>
      generatedTrainingSchema.parse({
        ...codeTraining,
        contract: { ...codeTraining.contract, ...override }
      })
    ).toThrow()
  })

  it('拒绝不支持的题型', () => {
    expect(() =>
      generatedTrainingSchema.parse({ ...codeTraining, type: 'system_design' })
    ).toThrow()
  })

  it('即使限制字段被错误标为 false，也拒绝正文中的宿主依赖', () => {
    expect(() =>
      generatedTrainingSchema.parse({
        ...codeTraining,
        prompt: '请使用 node:fs 读取文件并返回内容'
      })
    ).toThrow('不得依赖')
  })
})
