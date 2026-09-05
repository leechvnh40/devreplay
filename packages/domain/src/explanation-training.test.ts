import { describe, expect, it } from 'vitest'
import type { AssessmentContract } from './assessment-contract'
import { startExplanationTraining, submitExplanationAnswer } from './explanation-training'

const contract: AssessmentContract = {
  id: 'contract-1',
  trainingTaskId: 'task-1',
  version: 1,
  createdAt: '2026-09-04T00:00:00.000Z',
  content: {
    type: 'explanation',
    objective: '解释事件循环',
    requiredPoints: ['调用栈', '微任务', '宏任务'],
    allowedVariants: ['task 可称宏任务'],
    commonMisconceptions: ['Promise 回调同步执行'],
    passRule: '覆盖全部必备点且无关键误区',
    maxFollowUps: 2
  }
}

describe('解释题训练状态机', () => {
  it('主回答覆盖契约即可直接通过', () => {
    const state = submitExplanationAnswer(
      startExplanationTraining(contract, '解释执行顺序'),
      '回答',
      {
        coveredRequiredPoints: ['调用栈', '微任务', '宏任务'],
        triggeredMisconceptions: [],
        evidence: ['回答准确说明三者顺序']
      }
    )
    expect(state.phase).toBe('completed')
    expect(state.result?.passed).toBe(true)
  })

  it('两次定向追问后必须结束，不会发生第三次追问', () => {
    let state = submitExplanationAnswer(
      startExplanationTraining(contract, '解释执行顺序'),
      '只提到栈',
      {
        coveredRequiredPoints: ['调用栈'],
        triggeredMisconceptions: [],
        evidence: ['提到调用栈'],
        nextFollowUp: '微任务何时执行？'
      }
    )
    state = submitExplanationAnswer(state, '微任务清空后继续', {
      coveredRequiredPoints: ['微任务'],
      triggeredMisconceptions: [],
      evidence: ['说明微任务'],
      nextFollowUp: '宏任务何时执行？'
    })
    state = submitExplanationAnswer(state, '不清楚', {
      coveredRequiredPoints: [],
      triggeredMisconceptions: [],
      evidence: ['未说明宏任务']
    })
    expect(state.phase).toBe('completed')
    expect(state.result).toMatchObject({ passed: false, missingRequiredPoints: ['宏任务'] })
    expect(state.turns.filter((turn) => turn.kind === 'follow_up')).toHaveLength(2)
    expect(() =>
      submitExplanationAnswer(state, '第三次回答', {
        coveredRequiredPoints: ['宏任务'],
        triggeredMisconceptions: [],
        evidence: []
      })
    ).toThrow('已经结束')
  })

  it('拒绝评分器引用冻结契约外的标准', () => {
    expect(() =>
      submitExplanationAnswer(startExplanationTraining(contract, '解释执行顺序'), '回答', {
        coveredRequiredPoints: ['浏览器渲染'],
        triggeredMisconceptions: [],
        evidence: []
      })
    ).toThrow('契约外')
  })
})
