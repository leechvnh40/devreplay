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
    saveFreeRecall: (payload) => invoke('review.save-free-recall', payload)
  }),
  model: Object.freeze({
    getSettings: () => invoke('model.get-settings', {}),
    saveSettings: (payload) => invoke('model.save-settings', payload)
  })
})

contextBridge.exposeInMainWorld('devReplay', devReplayApi)
