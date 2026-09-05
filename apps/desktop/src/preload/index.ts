import { contextBridge, ipcRenderer } from 'electron'
import {
  IPC_TRANSPORT_CHANNEL,
  parseIpcResponse,
  type DevReplayApi,
  type IpcChannel,
  type IpcRequestPayload,
  type IpcResponseData,
  type IpcResult
} from '@devreplay/shared'

async function invoke<C extends IpcChannel>(
  channel: C,
  payload: IpcRequestPayload<C>
): Promise<IpcResult<IpcResponseData<C>>> {
  const response: unknown = await ipcRenderer.invoke(IPC_TRANSPORT_CHANNEL, { channel, payload })
  return parseIpcResponse(channel, response)
}

const devReplayApi: DevReplayApi = Object.freeze({
  system: Object.freeze({
    getStatus: () => invoke('system.get-status', {})
  }),
  onboarding: Object.freeze({
    getState: () => invoke('onboarding.get-state', {}),
    save: (payload) => invoke('onboarding.save', payload)
  }),
  interviews: Object.freeze({
    create: (payload) => invoke('interview.create', payload),
    list: () => invoke('interview.list', {})
  }),
  reviews: Object.freeze({
    getDraft: (payload) => invoke('review.get-draft', payload),
    saveFreeRecall: (payload) => invoke('review.save-free-recall', payload),
    getState: (payload) => invoke('review.get-state', payload),
    getAnalysisPreview: (payload) => invoke('review.get-analysis-preview', payload),
    analyze: (payload) => invoke('review.analyze', payload),
    cancelAnalysis: (payload) => invoke('review.cancel-analysis', payload),
    reviseItem: (payload) => invoke('review.revise-item', payload),
    answerQuestion: (payload) => invoke('review.answer-question', payload),
    finishQuestions: (payload) => invoke('review.finish-questions', payload),
    resolveDiagnosis: (payload) => invoke('review.resolve-diagnosis', payload),
    skipEmptyDiagnoses: (payload) => invoke('review.skip-empty-diagnoses', payload),
    acknowledgeEvidence: (payload) => invoke('review.acknowledge-evidence', payload),
    completeWithoutTraining: (payload) => invoke('review.complete-without-training', payload)
  }),
  model: Object.freeze({
    getSettings: () => invoke('model.get-settings', {}),
    saveSettings: (payload) => invoke('model.save-settings', payload)
  }),
  training: Object.freeze({
    list: () => invoke('training.list', {}),
    getCodeTask: (payload) => invoke('training.get-code-task', payload),
    runCode: (payload) => invoke('training.run-code', payload),
    submitCode: (payload) => invoke('training.submit-code', payload),
    getExplanationTask: (payload) => invoke('training.get-explanation-task', payload),
    submitExplanation: (payload) => invoke('training.submit-explanation', payload)
  }),
  workspace: Object.freeze({
    getToday: () => invoke('workspace.get-today', {})
  }),
  capabilities: Object.freeze({
    getProfile: () => invoke('capability.get-profile', {}),
    switchTarget: (payload) => invoke('capability.switch-target', payload)
  }),
  demo: Object.freeze({
    getStatus: () => invoke('demo.get-status', {}),
    load: () => invoke('demo.load', {}),
    clear: () => invoke('demo.clear', {})
  }),
  data: Object.freeze({
    export: () => invoke('data.export', {}),
    import: (payload) => invoke('data.import', payload),
    clearPlan: () => invoke('data.clear-plan', {}),
    clearAll: (payload) => invoke('data.clear-all', payload)
  })
})

contextBridge.exposeInMainWorld('devReplay', devReplayApi)
