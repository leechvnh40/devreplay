import { createRequire } from 'node:module'
import { Worker } from 'node:worker_threads'
import ts from 'typescript'
import {
  DEFAULT_SANDBOX_LIMITS,
  type SandboxFailureKind,
  type SandboxLimits,
  type SandboxRequest,
  type SandboxResult
} from './types'

const nodeRequire = createRequire(import.meta.url)
const quickJsPath = nodeRequire.resolve('quickjs-emscripten')

const WORKER_SOURCE = String.raw`
const { parentPort, workerData } = require('node:worker_threads')
const { getQuickJS } = require(workerData.quickJsPath)

void (async () => {
  const { request, limits } = workerData
  const QuickJS = await getQuickJS()
  const runtime = QuickJS.newRuntime()
  const deadline = Date.now() + limits.timeoutMs
  runtime.setMemoryLimit(limits.memoryLimitBytes)
  runtime.setMaxStackSize(Math.min(512 * 1024, Math.floor(limits.memoryLimitBytes / 4)))
  runtime.setInterruptHandler(() => Date.now() > deadline)
  const context = runtime.newContext()
  try {
    const evaluated = context.evalCode('"use strict";\n' + request.source, 'candidate.js')
    if (evaluated.error) {
      const dumped = context.dump(evaluated.error)
      evaluated.error.dispose()
      const message = String(dumped && dumped.message || dumped)
      const kind = /out of memory|memory/i.test(message)
        ? 'memory_limit'
        : /interrupted/i.test(message)
          ? 'timeout'
          : 'runtime_error'
      parentPort.postMessage({ ok: false, kind, message })
      return
    }
    evaluated.value.dispose()
    const candidate = context.getProp(context.global, request.functionName)
    if (context.typeof(candidate) !== 'function') {
      candidate.dispose()
      parentPort.postMessage({ ok: false, kind: 'runtime_error', message: '未找到约定函数' })
      return
    }
    const results = []
    for (const test of [...request.publicTests, ...request.hiddenTests]) {
      const argumentHandles = []
      let argumentError
      for (const argument of test.args) {
        const encoded = context.evalCode('(' + JSON.stringify(argument) + ')', 'test-input.js')
        if (encoded.error) {
          argumentError = String(context.dump(encoded.error))
          encoded.error.dispose()
          break
        }
        argumentHandles.push(encoded.value)
      }
      if (argumentError) {
        argumentHandles.forEach((handle) => handle.dispose())
        results.push({ passed: false, runtimeError: argumentError })
        continue
      }
      const called = context.callFunction(candidate, context.undefined, argumentHandles)
      argumentHandles.forEach((handle) => handle.dispose())
      if (called.error) {
        const dumped = context.dump(called.error)
        called.error.dispose()
        results.push({ passed: false, runtimeError: String(dumped && dumped.message || dumped) })
        continue
      }
      const actual = context.dump(called.value)
      called.value.dispose()
      results.push({ passed: JSON.stringify(actual) === JSON.stringify(test.expected), actual })
    }
    candidate.dispose()
    const serialized = JSON.stringify(results)
    if (serialized.length > limits.maxOutputChars) {
      parentPort.postMessage({ ok: false, kind: 'output_limit', message: '运行结果超过输出上限' })
      return
    }
    parentPort.postMessage({ ok: true, results })
  } finally {
    context.dispose()
    runtime.dispose()
  }
})().catch((error) => {
  const message = String(error && error.message || error)
  parentPort.postMessage({
    ok: false,
    kind: /out of memory|memory/i.test(message) ? 'memory_limit' : 'runtime_error',
    message
  })
})
`

interface WorkerSuccess {
  readonly ok: true
  readonly results: readonly { passed: boolean; actual?: unknown; runtimeError?: string }[]
}

interface WorkerFailure {
  readonly ok: false
  readonly kind: SandboxFailureKind
  readonly message: string
}

type WorkerResponse = WorkerSuccess | WorkerFailure

function normalizeLimits(input: Partial<SandboxLimits> | undefined): SandboxLimits {
  return Object.freeze({
    timeoutMs: input?.timeoutMs ?? DEFAULT_SANDBOX_LIMITS.timeoutMs,
    memoryLimitBytes: input?.memoryLimitBytes ?? DEFAULT_SANDBOX_LIMITS.memoryLimitBytes,
    maxOutputChars: input?.maxOutputChars ?? DEFAULT_SANDBOX_LIMITS.maxOutputChars
  })
}

function compile(request: SandboxRequest): string {
  if (request.language === 'javascript') return request.source
  const result = ts.transpileModule(request.source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.None,
      strict: true
    },
    reportDiagnostics: true
  })
  const errors = result.diagnostics?.filter(
    (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error
  )
  if (errors?.length) {
    throw new Error(
      errors
        .map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'))
        .join('; ')
    )
  }
  return result.outputText
}

export async function runInSandbox(request: SandboxRequest): Promise<SandboxResult> {
  let source: string
  try {
    source = compile(request)
  } catch (error) {
    return Object.freeze({
      passed: false,
      publicResults: Object.freeze([]),
      hiddenResults: Object.freeze([]),
      error: Object.freeze({
        kind: 'compile_error' as const,
        message: error instanceof Error ? error.message : 'TypeScript 转换失败'
      })
    })
  }
  const limits = normalizeLimits(request.limits)
  const response = await new Promise<WorkerResponse>((resolve) => {
    const worker = new Worker(WORKER_SOURCE, {
      eval: true,
      workerData: { quickJsPath, request: { ...request, source }, limits }
    })
    let settled = false
    const finish = (result: WorkerResponse): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      void worker.terminate()
      resolve(result)
    }
    const timer = setTimeout(
      () => finish({ ok: false, kind: 'timeout', message: '执行超过时间上限' }),
      limits.timeoutMs + 500
    )
    worker.once('message', (message: WorkerResponse) => finish(message))
    worker.once('error', (error) =>
      finish({ ok: false, kind: 'runtime_error', message: error.message })
    )
    worker.once('exit', (code) => {
      if (!settled && code !== 0) {
        finish({ ok: false, kind: 'runtime_error', message: `沙箱 Worker 异常退出：${code}` })
      }
    })
  })

  if (!response.ok) {
    return Object.freeze({
      passed: false,
      publicResults: Object.freeze([]),
      hiddenResults: Object.freeze([]),
      error: Object.freeze({ kind: response.kind, message: response.message })
    })
  }
  const fatalRuntimeError = response.results
    .map((result) => result.runtimeError)
    .find((message) => message && /out of memory|memory limit|interrupted/i.test(message))
  if (fatalRuntimeError) {
    return Object.freeze({
      passed: false,
      publicResults: Object.freeze([]),
      hiddenResults: Object.freeze([]),
      error: Object.freeze({
        kind: /interrupted/i.test(fatalRuntimeError)
          ? ('timeout' as const)
          : ('memory_limit' as const),
        message: fatalRuntimeError
      })
    })
  }
  const publicCount = request.publicTests.length
  const publicResults = Object.freeze(
    response.results.slice(0, publicCount).map((result, index) =>
      Object.freeze({
        name: request.publicTests[index]!.name,
        passed: result.passed,
        ...(result.runtimeError ? {} : { actual: result.actual }),
        expected: request.publicTests[index]!.expected
      })
    )
  )
  const hiddenResults = Object.freeze(
    response.results.slice(publicCount).map((result) =>
      Object.freeze({
        passed: result.passed,
        category: result.runtimeError
          ? ('runtime_error' as const)
          : result.passed
            ? ('passed' as const)
            : ('assertion_failed' as const)
      })
    )
  )
  return Object.freeze({
    passed: [...publicResults, ...hiddenResults].every((result) => result.passed),
    publicResults,
    hiddenResults
  })
}

export function toModelEvaluationContext(result: SandboxResult): Readonly<Record<string, unknown>> {
  return Object.freeze({
    passed: result.passed,
    publicResults: result.publicResults,
    hiddenSummary: Object.freeze({
      total: result.hiddenResults.length,
      passed: result.hiddenResults.filter((item) => item.passed).length,
      categories: Object.freeze(result.hiddenResults.map((item) => item.category))
    }),
    ...(result.error ? { error: result.error } : {})
  })
}
