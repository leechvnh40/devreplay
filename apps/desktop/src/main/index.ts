import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { createCompositionRoot, type CompositionRoot } from './composition-root'
import { registerIpcHandlers } from './ipc'
import { createMainWindowOptions } from './window-options'
import type { ModelProvider } from '@devreplay/agent'

let compositionRoot: CompositionRoot | undefined

// DevReplay does not render GPU-heavy content. Software rendering also keeps
// the app usable on Windows VMs and older interview/demo machines.
app.disableHardwareAcceleration()

const e2eProvider: ModelProvider = {
  complete: async (request) => ({
    provider: 'deepseek',
    requestId: 'e2e-fixture-run',
    modelId: request.modelId,
    content: JSON.stringify({
      questions: [
        {
          id: 'q1',
          question: 'Explain the JavaScript event loop.',
          answer: { status: 'unknown' },
          interviewerFollowUp: { status: 'unknown' },
          sourceQuote: 'event loop'
        }
      ],
      overallImpression: { status: 'known', value: 'fixture' },
      uncertainties: ['需要验证微任务时序']
    }),
    finishReason: 'stop',
    usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
    rawResponse: { fixture: true }
  })
}

function createWindow(): void {
  const isSecuritySmoke = process.env['DEVREPLAY_SECURITY_SMOKE'] === '1'

  // Create the browser window.
  const mainWindow = new BrowserWindow({
    ...createMainWindowOptions(join(__dirname, '../preload/index.js')),
    ...(process.platform === 'linux' ? { icon } : {})
  })

  mainWindow.on('ready-to-show', () => {
    if (!isSecuritySmoke) mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  if (isSecuritySmoke) {
    mainWindow.webContents.once('did-finish-load', async () => {
      try {
        const result = (await mainWindow.webContents.executeJavaScript(`({
          processType: typeof globalThis.process,
          requireType: typeof globalThis.require,
          electronType: typeof globalThis.electron,
          apiKeys: Object.keys(globalThis.devReplay ?? {}),
          systemKeys: Object.keys(globalThis.devReplay?.system ?? {}),
          onboardingKeys: Object.keys(globalThis.devReplay?.onboarding ?? {}),
          interviewKeys: Object.keys(globalThis.devReplay?.interviews ?? {}),
          reviewKeys: Object.keys(globalThis.devReplay?.reviews ?? {}),
          modelKeys: Object.keys(globalThis.devReplay?.model ?? {}),
          trainingKeys: Object.keys(globalThis.devReplay?.training ?? {}),
          workspaceKeys: Object.keys(globalThis.devReplay?.workspace ?? {}),
          capabilityKeys: Object.keys(globalThis.devReplay?.capabilities ?? {}),
          demoKeys: Object.keys(globalThis.devReplay?.demo ?? {}),
          dataKeys: Object.keys(globalThis.devReplay?.data ?? {})
        })`)) as {
          processType: string
          requireType: string
          electronType: string
          apiKeys: string[]
          systemKeys: string[]
          onboardingKeys: string[]
          interviewKeys: string[]
          reviewKeys: string[]
          modelKeys: string[]
          trainingKeys: string[]
          workspaceKeys: string[]
          capabilityKeys: string[]
          demoKeys: string[]
          dataKeys: string[]
        }
        const passed =
          result.processType === 'undefined' &&
          result.requireType === 'undefined' &&
          result.electronType === 'undefined' &&
          result.apiKeys.join(',') ===
            'system,onboarding,interviews,reviews,model,training,workspace,capabilities,demo,data' &&
          result.systemKeys.length === 1 &&
          result.systemKeys[0] === 'getStatus' &&
          result.onboardingKeys.join(',') === 'getState,save' &&
          result.interviewKeys.join(',') === 'create,list' &&
          result.reviewKeys.join(',') ===
            'getDraft,saveFreeRecall,getState,getAnalysisPreview,analyze,cancelAnalysis,reviseItem,answerQuestion,finishQuestions,resolveDiagnosis,skipEmptyDiagnoses,acknowledgeEvidence,completeWithoutTraining' &&
          result.modelKeys.join(',') === 'getSettings,saveSettings' &&
          result.trainingKeys.join(',') ===
            'list,getCodeTask,runCode,submitCode,getExplanationTask,submitExplanation' &&
          result.workspaceKeys.join(',') === 'getToday' &&
          result.capabilityKeys.join(',') === 'getProfile,switchTarget' &&
          result.demoKeys.join(',') === 'getStatus,load,clear' &&
          result.dataKeys.join(',') === 'export,import,clearPlan,clearAll'

        console.log(`DEVREPLAY_SECURITY_SMOKE ${JSON.stringify(result)}`)
        app.exit(passed ? 0 : 1)
      } catch (error) {
        console.error('DEVREPLAY_SECURITY_SMOKE failed', error)
        app.exit(1)
      }
    })
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.devreplay.desktop')

  const isSecuritySmoke = process.env['DEVREPLAY_SECURITY_SMOKE'] === '1'
  const dataDirectory = isSecuritySmoke ? app.getPath('temp') : app.getPath('userData')
  compositionRoot = createCompositionRoot(
    isSecuritySmoke ? ':memory:' : join(dataDirectory, 'devreplay.sqlite'),
    join(dataDirectory, isSecuritySmoke ? 'devreplay-smoke-secrets.json' : 'secrets.json'),
    process.env['DEVREPLAY_E2E'] === '1' ? { providerFactory: () => e2eProvider } : {}
  )

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerIpcHandlers(compositionRoot)
  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  compositionRoot?.dispose()
  compositionRoot = undefined
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
