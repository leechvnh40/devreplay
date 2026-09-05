/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { _electron as electron } from 'playwright'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const userData = mkdtempSync(join(tmpdir(), 'devreplay-e2e-'))
const appDirectory = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const installedExecutable = process.env.DEVREPLAY_E2E_EXECUTABLE
const launch = () => {
  console.log('E2E stage: launch')
  return electron.launch({
    executablePath:
      installedExecutable ?? join(appDirectory, 'node_modules/electron/dist/electron.exe'),
    args: [
      `--user-data-dir=${userData}`,
      '--no-sandbox',
      ...(installedExecutable ? [] : [join(appDirectory, 'out/main/index.js')])
    ],
    cwd: appDirectory,
    timeout: 15_000,
    env: { ...process.env, DEVREPLAY_E2E: '1' }
  })
}

const closeApplication = async (instance) => {
  if (!instance) return
  const child = instance.process()
  await instance.evaluate(({ app }) => app.quit()).catch(() => undefined)
  await instance.close().catch(() => undefined)
  if (child.exitCode === null) child.kill()
}

let app
try {
  app = await launch()
  app.process().stdout?.on('data', (data) => console.log(`electron stdout: ${data}`))
  app.process().stderr?.on('data', (data) => console.error(`electron stderr: ${data}`))
  console.log('E2E stage: first window')
  console.log(
    'E2E windows:',
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)
  )
  let page = await app.firstWindow()
  page.setDefaultTimeout(10_000)
  console.log('E2E stage: onboarding')
  await page.getByLabel('目标岗位').fill('前端工程师')
  await page.getByLabel('简历名称').fill('E2E 合成资料')
  await page.getByLabel('简历文本').fill('TypeScript 与 React 工程经验')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: '保存并继续' }).click()

  console.log('E2E stage: settings and demo')
  await page.getByRole('button', { name: 'DeepSeek 设置' }).click()
  await page.getByLabel('API Key').fill('e2e-fixture-key')
  await page.getByRole('button', { name: '保存 DeepSeek 配置' }).click()
  await page.getByRole('button', { name: '一键装载 Demo' }).click()
  await page.getByRole('button', { name: '← 返回面试' }).click()

  console.log('E2E stage: interview review')
  await page.getByRole('button', { name: '面试', exact: true }).click()
  await page.getByRole('button', { name: '新建面试' }).click()
  await page.getByLabel('公司').fill('E2E 合成组织')
  await page.getByLabel('岗位', { exact: true }).fill('前端工程师')
  await page.getByLabel('面试时间').fill('2026-09-04T10:00')
  await page.getByLabel('轮次').fill('技术面')
  await page.getByLabel('JD 文本（可选）').fill('JavaScript 运行时与工程质量')
  await page.getByRole('button', { name: '创建并开始自由回忆' }).click()
  await page
    .getByLabel('我记得的面试过程')
    .fill('Question: Explain the event loop. 回答时不确定微任务顺序。')
  await page.getByRole('button', { name: '完成回忆并预览发送内容' }).click()
  await page.getByRole('button', { name: '确认并发送' }).click()
  await page.getByText('Explain the JavaScript event loop.').first().waitFor()
  await page.getByText('记不清，明确标为未知').click()
  await page.getByRole('button', { name: '保存该题' }).click()
  await page.getByRole('button', { name: '完成追问，进入诊断处理' }).click()
  await page.getByRole('button', { name: '确认', exact: true }).click()
  await page.getByRole('button', { name: '确认证据并继续' }).click()
  await page.getByRole('button', { name: '完成本次复盘' }).click()
  await page.getByText('复盘已完成').waitFor()
  await page.getByRole('button', { name: /返回面试列表/ }).click()

  console.log('E2E stage: explanation assessment')
  await page.getByRole('button', { name: '训练', exact: true }).click()
  await page.getByRole('button', { name: /事件循环与任务调度/ }).click()
  await page.getByLabel('你的回答').fill('一次宏任务结束后清空微任务，然后浏览器进行渲染。')
  await page.getByRole('button', { name: '提交验收' }).click()
  await page.getByText('验收通过').waitFor()
  await page.getByText(/已安排间隔复测/).waitFor()

  await closeApplication(app)
  app = undefined
  console.log('E2E stage: restart recovery')
  app = await launch()
  page = await app.firstWindow()
  page.setDefaultTimeout(10_000)
  await page.getByRole('navigation', { name: '一级工作区' }).waitFor()
  await page.getByRole('button', { name: '画像', exact: true }).click()
  await page.getByRole('button', { name: /事件循环与任务调度/ }).waitFor()
  console.log('DEVREPLAY_GOLDEN_PATH_E2E passed')
} finally {
  await closeApplication(app)
  rmSync(userData, { recursive: true, force: true })
}
