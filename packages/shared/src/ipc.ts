import { z } from 'zod'

export const IPC_TRANSPORT_CHANNEL = 'devreplay:invoke' as const

const onboardingStateSchema = z
  .object({
    initialized: z.boolean(),
    targetRole: z.string(),
    riskAccepted: z.boolean(),
    resumeSnapshotId: z.string().optional(),
    resumeLabel: z.string().optional()
  })
  .strict()

const interviewSummarySchema = z
  .object({
    id: z.string(),
    company: z.string(),
    role: z.string(),
    occurredAt: z.string(),
    round: z.string(),
    stage: z.string(),
    updatedAt: z.string()
  })
  .strict()

const reviewDraftSchema = z
  .object({
    interview: interviewSummarySchema,
    freeRecall: z.string()
  })
  .strict()

const modelSettingsSchema = z
  .object({
    provider: z.literal('deepseek'),
    modelId: z.string(),
    keyConfigured: z.boolean(),
    cloudNotice: z.string()
  })
  .strict()

export const ipcContracts = {
  'system.get-status': {
    request: z.object({}).strict(),
    response: z.object({ appName: z.literal('DevReplay'), ready: z.boolean() }).strict()
  },
  'onboarding.get-state': {
    request: z.object({}).strict(),
    response: onboardingStateSchema
  },
  'onboarding.save': {
    request: z
      .object({
        targetRole: z.string().trim().min(1),
        riskAccepted: z.literal(true),
        resumeLabel: z.string().trim().min(1),
        resumeContent: z.string().trim().min(1)
      })
      .strict(),
    response: onboardingStateSchema
  },
  'interview.create': {
    request: z
      .object({
        company: z.string().trim().min(1),
        role: z.string().trim().min(1),
        occurredAt: z.string().trim().min(1),
        round: z.string().trim().min(1),
        jobDescription: z.string(),
        confirmWithoutJobDescription: z.boolean()
      })
      .strict(),
    response: z.object({ interviewId: z.string().min(1) }).strict()
  },
  'interview.list': {
    request: z.object({}).strict(),
    response: z.array(interviewSummarySchema)
  },
  'review.get-draft': {
    request: z.object({ interviewId: z.string().min(1) }).strict(),
    response: reviewDraftSchema
  },
  'review.save-free-recall': {
    request: z
      .object({ interviewId: z.string().min(1), content: z.string().max(200_000) })
      .strict(),
    response: z.object({ savedAt: z.string(), stage: z.literal('free_recall') }).strict()
  },
  'model.get-settings': {
    request: z.object({}).strict(),
    response: modelSettingsSchema
  },
  'model.save-settings': {
    request: z
      .object({
        modelId: z.string().trim().min(1).max(200),
        apiKey: z.string().trim().max(1_000)
      })
      .strict(),
    response: modelSettingsSchema
  }
} as const

export type IpcChannel = keyof typeof ipcContracts
export type IpcRequestPayload<C extends IpcChannel> = z.infer<(typeof ipcContracts)[C]['request']>
export type IpcResponseData<C extends IpcChannel> = z.infer<(typeof ipcContracts)[C]['response']>
export type IpcRequest = {
  [C in IpcChannel]: { channel: C; payload: IpcRequestPayload<C> }
}[IpcChannel]

export const ipcRequestEnvelopeSchema = z
  .object({
    channel: z.enum(Object.keys(ipcContracts) as [IpcChannel, ...IpcChannel[]]),
    payload: z.unknown()
  })
  .strict()

export const ipcErrorSchema = z
  .object({
    code: z.enum(['INVALID_REQUEST', 'PRECONDITION_FAILED', 'INTERNAL_ERROR']),
    message: z.string()
  })
  .strict()

export const ipcResponseEnvelopeSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), data: z.unknown() }).strict(),
  z.object({ ok: z.literal(false), error: ipcErrorSchema }).strict()
])

export type IpcError = z.infer<typeof ipcErrorSchema>
export type IpcResult<T> = { ok: true; data: T } | { ok: false; error: IpcError }
export type IpcResponseEnvelope = IpcResult<unknown>
export type SystemStatus = IpcResponseData<'system.get-status'>
export type OnboardingState = IpcResponseData<'onboarding.get-state'>
export type InterviewSummary = z.infer<typeof interviewSummarySchema>
export type ReviewDraft = z.infer<typeof reviewDraftSchema>
export type ModelSettings = z.infer<typeof modelSettingsSchema>

export interface DevReplayApi {
  system: { getStatus(): Promise<IpcResult<SystemStatus>> }
  onboarding: {
    getState(): Promise<IpcResult<OnboardingState>>
    save(payload: IpcRequestPayload<'onboarding.save'>): Promise<IpcResult<OnboardingState>>
  }
  interviews: {
    create(
      payload: IpcRequestPayload<'interview.create'>
    ): Promise<IpcResult<IpcResponseData<'interview.create'>>>
    list(): Promise<IpcResult<IpcResponseData<'interview.list'>>>
  }
  reviews: {
    getDraft(
      payload: IpcRequestPayload<'review.get-draft'>
    ): Promise<IpcResult<IpcResponseData<'review.get-draft'>>>
    saveFreeRecall(
      payload: IpcRequestPayload<'review.save-free-recall'>
    ): Promise<IpcResult<IpcResponseData<'review.save-free-recall'>>>
  }
  model: {
    getSettings(): Promise<IpcResult<IpcResponseData<'model.get-settings'>>>
    saveSettings(
      payload: IpcRequestPayload<'model.save-settings'>
    ): Promise<IpcResult<IpcResponseData<'model.save-settings'>>>
  }
}

export function parseIpcRequest(input: unknown): IpcRequest {
  const envelope = ipcRequestEnvelopeSchema.parse(input)
  const payload: unknown = ipcContracts[envelope.channel].request.parse(envelope.payload)
  return { channel: envelope.channel, payload } as IpcRequest
}

export function parseIpcResponse<C extends IpcChannel>(
  channel: C,
  input: unknown
): IpcResult<IpcResponseData<C>> {
  const envelope = ipcResponseEnvelopeSchema.parse(input)
  if (!envelope.ok) return envelope
  const data = ipcContracts[channel].response.parse(envelope.data) as IpcResponseData<C>
  return { ok: true, data }
}

export function createIpcError(code: IpcError['code'], message: string): IpcResponseEnvelope {
  return { ok: false, error: { code, message } }
}

export function isIpcValidationError(error: unknown): boolean {
  return error instanceof z.ZodError
}
