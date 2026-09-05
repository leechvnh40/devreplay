import { describe, expect, it } from 'vitest'
import { runInSandbox, toModelEvaluationContext } from './sandbox'

describe('QuickJS 训练沙箱', () => {
  it('在独立 Worker 中执行最小函数测试协议且无宿主权限', async () => {
    const result = await runInSandbox({
      language: 'javascript',
      functionName: 'inspectHost',
      source: `function inspectHost() {
        return [typeof process, typeof require, typeof fetch, typeof XMLHttpRequest, typeof electron]
      }`,
      publicTests: [
        {
          name: '宿主全局不可见',
          args: [],
          expected: ['undefined', 'undefined', 'undefined', 'undefined', 'undefined']
        }
      ],
      hiddenTests: []
    })
    expect(result.passed).toBe(true)
  })

  it('在内存中转换 TypeScript 并区分公开与隐藏测试摘要', async () => {
    const hiddenTests = [{ name: '不得泄露的边界源码', args: [0], expected: 0 }]
    const result = await runInSandbox({
      language: 'typescript',
      functionName: 'double',
      source: 'function double(value: number): number { return value * 2 }',
      publicTests: [{ name: '正数', args: [2], expected: 4 }],
      hiddenTests
    })
    expect(result).toMatchObject({
      passed: true,
      publicResults: [{ name: '正数', passed: true }],
      hiddenResults: [{ passed: true, category: 'passed' }]
    })
    const serialized = JSON.stringify(toModelEvaluationContext(result))
    expect(serialized).not.toContain(hiddenTests[0]!.name)
    expect(serialized).not.toContain(JSON.stringify(hiddenTests))
  })

  it('用户代码篡改客体 JSON 也不能伪造测试通过', async () => {
    const result = await runInSandbox({
      language: 'javascript',
      functionName: 'cheat',
      source: 'JSON.stringify = () => "same"; function cheat() { return 1 }',
      publicTests: [{ name: '必须返回二', args: [], expected: 2 }],
      hiddenTests: []
    })
    expect(result.passed).toBe(false)
  })

  it('父线程硬终止无限循环并返回超时', async () => {
    const startedAt = Date.now()
    const result = await runInSandbox({
      language: 'javascript',
      functionName: 'loop',
      source: 'function loop() { while (true) {} }',
      publicTests: [{ name: '终止', args: [], expected: null }],
      hiddenTests: [],
      limits: { timeoutMs: 50 }
    })
    expect(result.error?.kind).toBe('timeout')
    expect(Date.now() - startedAt).toBeLessThan(2_000)
  })

  it('限制大对象内存和超长输出', async () => {
    const memory = await runInSandbox({
      language: 'javascript',
      functionName: 'allocate',
      source: 'function allocate() { return new Array(10000000).fill("x") }',
      publicTests: [{ name: '内存', args: [], expected: [] }],
      hiddenTests: [],
      limits: { memoryLimitBytes: 4 * 1024 * 1024, timeoutMs: 500 }
    })
    expect(memory.error?.kind).toBe('memory_limit')

    const output = await runInSandbox({
      language: 'javascript',
      functionName: 'large',
      source: 'function large() { return "x".repeat(10000) }',
      publicTests: [{ name: '输出', args: [], expected: '' }],
      hiddenTests: [],
      limits: { maxOutputChars: 100 }
    })
    expect(output.error?.kind).toBe('output_limit')
  })
})
