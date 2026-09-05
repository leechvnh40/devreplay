import { ipcMain } from 'electron'
import { ModelProviderError } from '@devreplay/agent'
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
  ipcMain.handle(IPC_TRANSPORT_CHANNEL, (_event, input: unknown) => handleIpcRequest(root, input))
}

export async function handleIpcRequest(
  root: CompositionRoot,
  input: unknown
): Promise<IpcResponseEnvelope> {
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
      case 'review.get-state':
        return { ok: true, data: root.reviewFlow.getState(request.payload.interviewId) }
      case 'review.get-analysis-preview':
        return { ok: true, data: root.analysis.preview(request.payload.interviewId) }
      case 'review.analyze':
        await root.analysis.analyze(request.payload.interviewId, request.payload.includedItemIds)
        return { ok: true, data: root.reviewFlow.getState(request.payload.interviewId) }
      case 'review.cancel-analysis':
        return {
          ok: true,
          data: { cancelled: root.analysis.cancel(request.payload.interviewId) }
        }
      case 'review.revise-item':
        return {
          ok: true,
          data: root.reviewFlow.reviseItem(
            request.payload.interviewId,
            request.payload.itemId,
            request.payload.question
          )
        }
      case 'review.answer-question':
        return {
          ok: true,
          data: root.reviewFlow.answerQuestion(
            request.payload.interviewId,
            request.payload.itemId,
            request.payload.answer,
            request.payload.unknown
          )
        }
      case 'review.finish-questions':
        return {
          ok: true,
          data: root.reviewFlow.finishQuestions(request.payload.interviewId)
        }
      case 'review.resolve-diagnosis':
        return {
          ok: true,
          data: root.reviewFlow.resolveDiagnosis(
            request.payload.interviewId,
            request.payload.diagnosisId,
            request.payload.resolution
          )
        }
      case 'review.skip-empty-diagnoses':
        return {
          ok: true,
          data: root.reviewFlow.skipEmptyDiagnosisResolution(request.payload.interviewId)
        }
      case 'review.acknowledge-evidence':
        return {
          ok: true,
          data: root.reviewFlow.acknowledgeEvidence(request.payload.interviewId)
        }
      case 'review.complete-without-training':
        return {
          ok: true,
          data: root.reviewFlow.completeWithoutTraining(
            request.payload.interviewId,
            request.payload.reason
          )
        }
      case 'model.get-settings':
        return { ok: true, data: root.modelSettings.getSettings() }
      case 'model.save-settings':
        return { ok: true, data: root.modelSettings.saveSettings(request.payload) }
      case 'training.get-code-task':
        return { ok: true, data: root.codeTraining.getTask(request.payload.trainingTaskId) }
      case 'training.run-code':
        return {
          ok: true,
          data: await root.codeTraining.run(request.payload.trainingTaskId, request.payload.source)
        }
      case 'training.submit-code':
        return {
          ok: true,
          data: await root.codeTraining.submit(
            request.payload.trainingTaskId,
            request.payload.source
          )
        }
      case 'training.get-explanation-task':
        return { ok: true, data: root.explanationTraining.getTask(request.payload.trainingTaskId) }
      case 'training.submit-explanation':
        return {
          ok: true,
          data: root.explanationTraining.submit(
            request.payload.trainingTaskId,
            request.payload.answer
          )
        }
      case 'workspace.get-today':
        return { ok: true, data: root.workspace.getToday() }
      case 'training.list':
        return { ok: true, data: root.workspace.listTraining() }
      case 'capability.get-profile':
        return { ok: true, data: root.capabilityProfile.getProfile() }
      case 'capability.switch-target':
        return {
          ok: true,
          data: root.capabilityProfile.switchTarget(request.payload.targetProfileId)
        }
      case 'demo.get-status':
        return { ok: true, data: root.demo.status() }
      case 'demo.load':
        return { ok: true, data: root.demo.load() }
      case 'demo.clear':
        return { ok: true, data: root.demo.clear() }
      case 'data.export':
        return { ok: true, data: { content: root.dataLifecycle.exportJson(), formatVersion: 1 } }
      case 'data.import':
        return { ok: true, data: root.dataLifecycle.importJson(request.payload.content) }
      case 'data.clear-plan':
        return { ok: true, data: root.dataLifecycle.clearPlan() }
      case 'data.clear-all':
        return { ok: true, data: root.dataLifecycle.clearAll(request.payload.confirmation) }
    }
  } catch (error) {
    if (isIpcValidationError(error)) {
      return createIpcError('INVALID_REQUEST', '请求不符合 DevReplay IPC 契约')
    }

    if (error instanceof PreconditionError) {
      return createIpcError('PRECONDITION_FAILED', error.message)
    }

    if (error instanceof ModelProviderError) {
      const code = {
        authentication: 'MODEL_AUTHENTICATION',
        rate_limit: 'MODEL_RATE_LIMIT',
        timeout: 'MODEL_TIMEOUT',
        cancelled: 'MODEL_CANCELLED',
        network: 'MODEL_NETWORK',
        provider: 'MODEL_INVALID_RESPONSE',
        invalid_response: 'MODEL_INVALID_RESPONSE'
      } as const
      return createIpcError(code[error.kind], error.message)
    }

    return createIpcError('INTERNAL_ERROR', '桌面进程处理请求失败')
  }
}
