import { ipcMain } from 'electron'
import {
  createIpcError,
  IPC_TRANSPORT_CHANNEL,
  isIpcValidationError,
  parseIpcRequest,
  type IpcResponseEnvelope
} from '@devreplay/shared'
import type { CompositionRoot } from './composition-root'
import { PreconditionError } from './services/onboarding-service'

export function registerIpcHandlers(root: CompositionRoot): void {
  ipcMain.handle(IPC_TRANSPORT_CHANNEL, (_event, input: unknown): IpcResponseEnvelope => {
    try {
      const request = parseIpcRequest(input)

      switch (request.channel) {
        case 'system.get-status':
          return {
            ok: true,
            data: {
              appName: 'DevReplay',
              ready: true
            }
          }
        case 'onboarding.get-state':
          return { ok: true, data: root.onboarding.getState() }
        case 'onboarding.save':
          return { ok: true, data: root.onboarding.save(request.payload) }
        case 'interview.create':
          return { ok: true, data: root.onboarding.createInterview(request.payload) }
        case 'interview.list':
          return { ok: true, data: root.reviews.list() }
        case 'review.get-draft':
          return { ok: true, data: root.reviews.getDraft(request.payload.interviewId) }
        case 'review.save-free-recall':
          return {
            ok: true,
            data: root.reviews.saveFreeRecall(request.payload.interviewId, request.payload.content)
          }
        case 'model.get-settings':
          return { ok: true, data: root.modelSettings.getSettings() }
        case 'model.save-settings':
          return { ok: true, data: root.modelSettings.saveSettings(request.payload) }
      }
    } catch (error) {
      if (isIpcValidationError(error)) {
        return createIpcError('INVALID_REQUEST', '请求不符合 DevReplay IPC 契约')
      }

      if (error instanceof PreconditionError) {
        return createIpcError('PRECONDITION_FAILED', error.message)
      }

      return createIpcError('INTERNAL_ERROR', '桌面进程处理请求失败')
    }
  })
}
