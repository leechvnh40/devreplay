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

const knownAnswerSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('known'), value: z.string() }).strict(),
  z.object({ status: z.literal('unknown') }).strict()
])

const reviewFlowStateSchema = z
  .object({
    interviewId: z.string(),
    interview: z
      .object({
        company: z.string(),
        role: z.string(),
        occurredAt: z.string(),
        round: z.string()
      })
      .strict(),
    stage: z.enum([
      'draft_context',
      'free_recall',
      'extract_review',
      'targeted_questions',
      'propose_diagnoses',
      'user_resolution',
      'evidence_preview',
      'training_decision',
      'completed'
    ]),
    operationStatus: z.enum(['idle', 'running', 'retryable_error']),
    lastError: z.string().optional(),
    freeRecall: z.string(),
    items: z.array(
      z
        .object({
          id: z.string(),
          question: z.string(),
          originalQuestion: z.string().optional(),
          answer: knownAnswerSchema,
          sourceType: z.string(),
          sourceId: z.string().optional(),
          status: z.string()
        })
        .strict()
    ),
    diagnoses: z.array(
      z
        .object({
          id: z.string(),
          capabilityId: z.string(),
          claim: z.string(),
          evidence: z.array(
            z
              .object({
                id: z.string(),
                description: z.string(),
                specificity: z.enum(['vague', 'specific'])
              })
              .strict()
          ),
          alternativeExplanations: z.array(z.string()),
          confidence: z.enum(['low', 'medium', 'high']),
          verificationPlan: z.string(),
          resolution: z.enum(['unresolved', 'confirmed', 'rejected', 'kept_pending'])
        })
        .strict()
    ),
    evidence: z.array(
      z
        .object({
          id: z.string(),
          capabilityId: z.string(),
          sourceType: z.string(),
          polarity: z.enum(['positive', 'negative', 'neutral']),
          strength: z.number().int(),
          summary: z.string(),
          createdAt: z.string()
        })
        .strict()
    )
  })
  .strict()

const contextPreviewSchema = z
  .object({
    items: z.array(
      z
        .object({
          id: z.string(),
          kind: z.string(),
          sourceId: z.string(),
          label: z.string(),
          content: z.string(),
          required: z.boolean(),
          included: z.boolean(),
          estimatedChars: z.number().int(),
          estimatedTokens: z.number().int()
        })
        .strict()
    ),
    includedChars: z.number().int(),
    includedTokens: z.number().int()
  })
  .strict()

const sandboxResultSchema = z
  .object({
    passed: z.boolean(),
    publicResults: z.array(
      z
        .object({
          name: z.string(),
          passed: z.boolean(),
          actual: z.unknown().optional(),
          expected: z.unknown()
        })
        .strict()
    ),
    hiddenResults: z.array(
      z
        .object({
          passed: z.boolean(),
          category: z.enum(['passed', 'assertion_failed', 'runtime_error'])
        })
        .strict()
    ),
    error: z
      .object({
        kind: z.enum(['timeout', 'memory_limit', 'output_limit', 'compile_error', 'runtime_error']),
        message: z.string()
      })
      .strict()
      .optional()
  })
  .strict()

const codeTrainingTaskSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    prompt: z.string(),
    starterCode: z.string(),
    language: z.enum(['javascript', 'typescript']),
    assessmentContractId: z.string(),
    assessmentContractVersion: z.number().int().positive(),
    publicTests: z.array(
      z.object({ name: z.string(), args: z.array(z.unknown()), expected: z.unknown() }).strict()
    )
  })
  .strict()

const explanationTrainingTaskSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    prompt: z.string(),
    assessmentContractId: z.string(),
    assessmentContractVersion: z.number().int(),
    requiredPointCount: z.number().int()
  })
  .strict()

const priorityFactorSchema = z
  .object({ key: z.string(), label: z.string(), contribution: z.number() })
  .strict()

const trainingTaskSummarySchema = z
  .object({
    id: z.string(),
    capabilityId: z.string(),
    capabilityName: z.string(),
    type: z.enum(['explanation', 'code']),
    status: z.enum(['active', 'queued', 'completed', 'cancelled']),
    role: z.enum(['main', 'candidate']),
    score: z.number(),
    factors: z.array(priorityFactorSchema),
    dueDate: z.string().optional()
  })
  .strict()

const todayActionSchema = z
  .object({
    kind: z.enum(['review', 'training', 'empty']),
    title: z.string(),
    description: z.string(),
    trainingTaskId: z.string().optional(),
    factors: z.array(priorityFactorSchema)
  })
  .strict()

const capabilityEvidenceSchema = z
  .object({
    id: z.string(),
    polarity: z.enum(['positive', 'negative', 'neutral']),
    sourceType: z.string(),
    summary: z.string(),
    createdAt: z.string()
  })
  .strict()

const capabilityProfileSchema = z
  .object({
    targets: z.array(z.object({ id: z.string(), title: z.string(), active: z.boolean() }).strict()),
    activeTargetId: z.string().optional(),
    capabilities: z.array(
      z
        .object({
          id: z.string(),
          parentId: z.string().optional(),
          name: z.string(),
          category: z.enum(['frontend', 'fullstack', 'ai_application']),
          userConfirmed: z.boolean(),
          state: z.enum(['unknown', 'pending', 'weak', 'basic', 'stable']),
          reason: z.string(),
          targetWeight: z.number(),
          evidence: z.array(capabilityEvidenceSchema)
        })
        .strict()
    )
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
  'review.get-state': {
    request: z.object({ interviewId: z.string().min(1) }).strict(),
    response: reviewFlowStateSchema
  },
  'review.get-analysis-preview': {
    request: z.object({ interviewId: z.string().min(1) }).strict(),
    response: contextPreviewSchema
  },
  'review.analyze': {
    request: z
      .object({ interviewId: z.string().min(1), includedItemIds: z.array(z.string().min(1)) })
      .strict(),
    response: reviewFlowStateSchema
  },
  'review.cancel-analysis': {
    request: z.object({ interviewId: z.string().min(1) }).strict(),
    response: z.object({ cancelled: z.boolean() }).strict()
  },
  'review.revise-item': {
    request: z
      .object({ interviewId: z.string().min(1), itemId: z.string().min(1), question: z.string() })
      .strict(),
    response: reviewFlowStateSchema
  },
  'review.answer-question': {
    request: z
      .object({
        interviewId: z.string().min(1),
        itemId: z.string().min(1),
        answer: z.string(),
        unknown: z.boolean()
      })
      .strict(),
    response: reviewFlowStateSchema
  },
  'review.finish-questions': {
    request: z.object({ interviewId: z.string().min(1) }).strict(),
    response: reviewFlowStateSchema
  },
  'review.resolve-diagnosis': {
    request: z
      .object({
        interviewId: z.string().min(1),
        diagnosisId: z.string().min(1),
        resolution: z.enum(['confirmed', 'rejected', 'kept_pending'])
      })
      .strict(),
    response: reviewFlowStateSchema
  },
  'review.skip-empty-diagnoses': {
    request: z.object({ interviewId: z.string().min(1) }).strict(),
    response: reviewFlowStateSchema
  },
  'review.acknowledge-evidence': {
    request: z.object({ interviewId: z.string().min(1) }).strict(),
    response: reviewFlowStateSchema
  },
  'review.complete-without-training': {
    request: z.object({ interviewId: z.string().min(1), reason: z.string() }).strict(),
    response: reviewFlowStateSchema
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
  },
  'training.get-code-task': {
    request: z.object({ trainingTaskId: z.string().min(1) }).strict(),
    response: codeTrainingTaskSchema
  },
  'training.run-code': {
    request: z
      .object({ trainingTaskId: z.string().min(1), source: z.string().max(200_000) })
      .strict(),
    response: sandboxResultSchema
  },
  'training.submit-code': {
    request: z
      .object({ trainingTaskId: z.string().min(1), source: z.string().max(200_000) })
      .strict(),
    response: z
      .object({ attemptId: z.string(), passed: z.boolean(), testResult: sandboxResultSchema })
      .strict()
  },
  'training.get-explanation-task': {
    request: z.object({ trainingTaskId: z.string().min(1) }).strict(),
    response: explanationTrainingTaskSchema
  },
  'training.submit-explanation': {
    request: z
      .object({ trainingTaskId: z.string().min(1), answer: z.string().max(200_000) })
      .strict(),
    response: z
      .object({
        attemptId: z.string(),
        passed: z.boolean(),
        evidence: z.array(z.string()),
        reason: z.string(),
        capabilityState: z.enum(['unknown', 'pending', 'weak', 'basic', 'stable']),
        retestDueDate: z.string().optional()
      })
      .strict()
  },
  'workspace.get-today': {
    request: z.object({}).strict(),
    response: todayActionSchema
  },
  'training.list': {
    request: z.object({}).strict(),
    response: z.array(trainingTaskSummarySchema)
  },
  'capability.get-profile': {
    request: z.object({}).strict(),
    response: capabilityProfileSchema
  },
  'capability.switch-target': {
    request: z.object({ targetProfileId: z.string().min(1) }).strict(),
    response: capabilityProfileSchema
  },
  'demo.get-status': {
    request: z.object({}).strict(),
    response: z.object({ loaded: z.boolean(), datasetKind: z.literal('demo') }).strict()
  },
  'demo.load': {
    request: z.object({}).strict(),
    response: z
      .object({
        loaded: z.literal(true),
        interviewId: z.string(),
        trainingTaskId: z.string(),
        datasetKind: z.literal('demo')
      })
      .strict()
  },
  'demo.clear': {
    request: z.object({}).strict(),
    response: z.object({ cleared: z.boolean(), datasetKind: z.literal('demo') }).strict()
  },
  'data.export': {
    request: z.object({}).strict(),
    response: z.object({ content: z.string(), formatVersion: z.literal(1) }).strict()
  },
  'data.import': {
    request: z.object({ content: z.string().max(50_000_000) }).strict(),
    response: z
      .object({ imported: z.literal(true), rowCount: z.number().int(), version: z.literal(1) })
      .strict()
  },
  'data.clear-plan': {
    request: z.object({}).strict(),
    response: z
      .object({
        confirmation: z.string(),
        deletes: z.array(z.string()),
        preserves: z.array(z.string())
      })
      .strict()
  },
  'data.clear-all': {
    request: z.object({ confirmation: z.string() }).strict(),
    response: z.object({ cleared: z.literal(true) }).strict()
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
    code: z.enum([
      'INVALID_REQUEST',
      'PRECONDITION_FAILED',
      'MODEL_AUTHENTICATION',
      'MODEL_RATE_LIMIT',
      'MODEL_TIMEOUT',
      'MODEL_CANCELLED',
      'MODEL_NETWORK',
      'MODEL_INVALID_RESPONSE',
      'INTERNAL_ERROR'
    ]),
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
export type ReviewFlowState = z.infer<typeof reviewFlowStateSchema>
export type ContextPreview = z.infer<typeof contextPreviewSchema>
export type CodeTrainingTask = z.infer<typeof codeTrainingTaskSchema>
export type CodeSandboxResult = z.infer<typeof sandboxResultSchema>
export type TodayAction = z.infer<typeof todayActionSchema>
export type TrainingTaskSummary = z.infer<typeof trainingTaskSummarySchema>
export type CapabilityProfileData = z.infer<typeof capabilityProfileSchema>

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
    getState(
      payload: IpcRequestPayload<'review.get-state'>
    ): Promise<IpcResult<IpcResponseData<'review.get-state'>>>
    getAnalysisPreview(
      payload: IpcRequestPayload<'review.get-analysis-preview'>
    ): Promise<IpcResult<IpcResponseData<'review.get-analysis-preview'>>>
    analyze(
      payload: IpcRequestPayload<'review.analyze'>
    ): Promise<IpcResult<IpcResponseData<'review.analyze'>>>
    cancelAnalysis(
      payload: IpcRequestPayload<'review.cancel-analysis'>
    ): Promise<IpcResult<IpcResponseData<'review.cancel-analysis'>>>
    reviseItem(
      payload: IpcRequestPayload<'review.revise-item'>
    ): Promise<IpcResult<IpcResponseData<'review.revise-item'>>>
    answerQuestion(
      payload: IpcRequestPayload<'review.answer-question'>
    ): Promise<IpcResult<IpcResponseData<'review.answer-question'>>>
    finishQuestions(
      payload: IpcRequestPayload<'review.finish-questions'>
    ): Promise<IpcResult<IpcResponseData<'review.finish-questions'>>>
    resolveDiagnosis(
      payload: IpcRequestPayload<'review.resolve-diagnosis'>
    ): Promise<IpcResult<IpcResponseData<'review.resolve-diagnosis'>>>
    skipEmptyDiagnoses(
      payload: IpcRequestPayload<'review.skip-empty-diagnoses'>
    ): Promise<IpcResult<IpcResponseData<'review.skip-empty-diagnoses'>>>
    acknowledgeEvidence(
      payload: IpcRequestPayload<'review.acknowledge-evidence'>
    ): Promise<IpcResult<IpcResponseData<'review.acknowledge-evidence'>>>
    completeWithoutTraining(
      payload: IpcRequestPayload<'review.complete-without-training'>
    ): Promise<IpcResult<IpcResponseData<'review.complete-without-training'>>>
  }
  model: {
    getSettings(): Promise<IpcResult<IpcResponseData<'model.get-settings'>>>
    saveSettings(
      payload: IpcRequestPayload<'model.save-settings'>
    ): Promise<IpcResult<IpcResponseData<'model.save-settings'>>>
  }
  training: {
    list(): Promise<IpcResult<IpcResponseData<'training.list'>>>
    getCodeTask(
      payload: IpcRequestPayload<'training.get-code-task'>
    ): Promise<IpcResult<IpcResponseData<'training.get-code-task'>>>
    runCode(
      payload: IpcRequestPayload<'training.run-code'>
    ): Promise<IpcResult<IpcResponseData<'training.run-code'>>>
    submitCode(
      payload: IpcRequestPayload<'training.submit-code'>
    ): Promise<IpcResult<IpcResponseData<'training.submit-code'>>>
    getExplanationTask(
      payload: IpcRequestPayload<'training.get-explanation-task'>
    ): Promise<IpcResult<IpcResponseData<'training.get-explanation-task'>>>
    submitExplanation(
      payload: IpcRequestPayload<'training.submit-explanation'>
    ): Promise<IpcResult<IpcResponseData<'training.submit-explanation'>>>
  }
  workspace: {
    getToday(): Promise<IpcResult<IpcResponseData<'workspace.get-today'>>>
  }
  capabilities: {
    getProfile(): Promise<IpcResult<IpcResponseData<'capability.get-profile'>>>
    switchTarget(
      payload: IpcRequestPayload<'capability.switch-target'>
    ): Promise<IpcResult<IpcResponseData<'capability.switch-target'>>>
  }
  demo: {
    getStatus(): Promise<IpcResult<IpcResponseData<'demo.get-status'>>>
    load(): Promise<IpcResult<IpcResponseData<'demo.load'>>>
    clear(): Promise<IpcResult<IpcResponseData<'demo.clear'>>>
  }
  data: {
    export(): Promise<IpcResult<IpcResponseData<'data.export'>>>
    import(
      payload: IpcRequestPayload<'data.import'>
    ): Promise<IpcResult<IpcResponseData<'data.import'>>>
    clearPlan(): Promise<IpcResult<IpcResponseData<'data.clear-plan'>>>
    clearAll(
      payload: IpcRequestPayload<'data.clear-all'>
    ): Promise<IpcResult<IpcResponseData<'data.clear-all'>>>
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
