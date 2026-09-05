import { useEffect, useRef, useState } from 'react'
import type { ContextPreview, ReviewDraft, ReviewFlowState } from '@devreplay/shared'
import { ContextPreviewDialog } from './ContextPreviewDialog'
import { DiagnosisCard } from './DiagnosisCard'
import { PersistentReviewWorkspace } from './ReviewWorkspace'
import { zhCN } from './i18n/zh-CN'
import { modelErrorMessage } from './model-error-copy'

export function FreeRecallEditor({
  interviewId,
  onBack
}: {
  interviewId: string
  onBack(): void
}): React.JSX.Element {
  const [draft, setDraft] = useState<ReviewDraft>()
  const [content, setContent] = useState('')
  const [status, setStatus] = useState(zhCN.recall.loading)
  const [flow, setFlow] = useState<ReviewFlowState>()
  const [preview, setPreview] = useState<ContextPreview>()
  const changedByUser = useRef(false)

  useEffect(() => {
    changedByUser.current = false
    void window.devReplay.reviews.getDraft({ interviewId }).then((result) => {
      if (result.ok) {
        setDraft(result.data)
        setContent(result.data.freeRecall)
        setStatus(zhCN.recall.restored)
      } else {
        setStatus(result.error.message)
      }
    })
    void window.devReplay.reviews.getState({ interviewId }).then((result) => {
      if (result.ok) setFlow(result.data)
    })
  }, [interviewId])

  useEffect(() => {
    if (!draft || !changedByUser.current) return
    setStatus(zhCN.recall.waiting)
    const timer = window.setTimeout(() => {
      void window.devReplay.reviews.saveFreeRecall({ interviewId, content }).then((result) => {
        setStatus(result.ok ? zhCN.recall.saved : result.error.message)
        if (result.ok) changedByUser.current = false
      })
    }, 500)
    return () => window.clearTimeout(timer)
  }, [content, draft, interviewId])

  if (!draft) {
    return (
      <section className="form-card">
        <p>{status}</p>
        <button onClick={onBack}>{zhCN.recall.back}</button>
      </section>
    )
  }

  if (preview) {
    return (
      <ContextPreviewDialog
        items={preview.items}
        onCancel={() => {
          void window.devReplay.reviews.cancelAnalysis({ interviewId })
          setPreview(undefined)
        }}
        onConfirm={async (includedItemIds) => {
          const result = await window.devReplay.reviews.analyze({
            interviewId,
            includedItemIds: [...includedItemIds]
          })
          if (!result.ok) throw new Error(modelErrorMessage(result.error))
          setFlow(result.data)
          setPreview(undefined)
        }}
      />
    )
  }

  if (flow && flow.stage !== 'free_recall') {
    return (
      <ReviewProgress
        flow={flow}
        onChange={setFlow}
        onBack={onBack}
        onRetry={() => {
          void window.devReplay.reviews
            .getAnalysisPreview({ interviewId })
            .then((result) => result.ok && setPreview(result.data))
        }}
      />
    )
  }

  return (
    <section className="form-card recall-card">
      <button className="text-button" onClick={onBack}>
        {zhCN.recall.backArrow}
      </button>
      <div className="section-heading">
        <p className="eyebrow">{zhCN.recall.eyebrow}</p>
        <h1>{draft.interview.company}</h1>
        <p>
          {draft.interview.role} · {draft.interview.round}
        </p>
      </div>
      <p className="recall-guidance">{zhCN.recall.guidance}</p>
      <label>
        {zhCN.recall.label}
        <textarea
          className="recall-input"
          value={content}
          autoFocus
          onChange={(event) => {
            changedByUser.current = true
            setContent(event.target.value)
          }}
        />
      </label>
      <p className="save-status" role="status">
        {status}
      </p>
      <button
        disabled={!content.trim()}
        onClick={() => {
          void window.devReplay.reviews
            .saveFreeRecall({ interviewId, content })
            .then(async (saved) => {
              if (!saved.ok) {
                setStatus(saved.error.message)
                return
              }
              const result = await window.devReplay.reviews.getAnalysisPreview({ interviewId })
              if (result.ok) setPreview(result.data)
              else setStatus(result.error.message)
            })
        }}
      >
        {zhCN.recall.preview}
      </button>
    </section>
  )
}

function ReviewProgress({
  flow,
  onChange,
  onBack,
  onRetry
}: {
  flow: ReviewFlowState
  onChange(state: ReviewFlowState): void
  onBack(): void
  onRetry(): void
}): React.JSX.Element {
  const [reason, setReason] = useState(zhCN.recall.defaultNoTraining)
  const apply = (result: Awaited<ReturnType<typeof window.devReplay.reviews.getState>>): void => {
    if (result.ok) onChange(result.data)
  }

  return (
    <section className="form-card recall-card">
      <button className="text-button" onClick={onBack}>
        {zhCN.recall.backArrow}
      </button>
      <div className="section-heading">
        <p className="eyebrow">
          {zhCN.recall.stage} / {flow.stage}
        </p>
        <h1>{flow.interview.company}</h1>
      </div>

      {flow.stage === 'extract_review' && (
        <div className={flow.operationStatus === 'retryable_error' ? 'notice error' : 'notice'}>
          <h2>
            {flow.operationStatus === 'running' ? zhCN.recall.analyzing : zhCN.recall.incomplete}
          </h2>
          <p>{flow.lastError ?? zhCN.recall.analyzingDescription}</p>
          {flow.operationStatus === 'retryable_error' && (
            <button onClick={onRetry}>{zhCN.recall.retry}</button>
          )}
        </div>
      )}

      {flow.stage === 'targeted_questions' && (
        <>
          <PersistentReviewWorkspace
            items={flow.items}
            onRevise={(itemId, question) => {
              void window.devReplay.reviews
                .reviseItem({ interviewId: flow.interviewId, itemId, question })
                .then(apply)
            }}
          />
          {flow.items.map((item) => (
            <QuestionAnswerEditor key={item.id} flow={flow} item={item} onChange={onChange} />
          ))}
          <button
            onClick={() =>
              void window.devReplay.reviews
                .finishQuestions({ interviewId: flow.interviewId })
                .then(apply)
            }
          >
            {zhCN.recall.finishQuestions}
          </button>
        </>
      )}

      {flow.stage === 'user_resolution' && (
        <>
          <h2>{zhCN.recall.diagnoses}</h2>
          {flow.diagnoses.length === 0 && (
            <button
              onClick={() =>
                void window.devReplay.reviews
                  .skipEmptyDiagnoses({ interviewId: flow.interviewId })
                  .then(apply)
              }
            >
              {zhCN.recall.noDiagnoses}
            </button>
          )}
          {flow.diagnoses.map((diagnosis) =>
            diagnosis.resolution === 'unresolved' ? (
              <DiagnosisCard
                key={diagnosis.id}
                hypothesis={diagnosis}
                onResolve={(resolution) => {
                  void window.devReplay.reviews
                    .resolveDiagnosis({
                      interviewId: flow.interviewId,
                      diagnosisId: diagnosis.id,
                      resolution
                    })
                    .then(apply)
                }}
              />
            ) : (
              <p key={diagnosis.id} className="notice">
                {diagnosis.claim}：{diagnosis.resolution}
              </p>
            )
          )}
        </>
      )}

      {flow.stage === 'evidence_preview' && (
        <>
          <h2>{zhCN.recall.evidencePreview}</h2>
          {flow.evidence.length === 0 ? (
            <p className="notice">{zhCN.recall.noEvidence}</p>
          ) : (
            flow.evidence.map((entry) => (
              <p className="notice" key={entry.id}>
                {entry.summary} · {entry.polarity} · {zhCN.recall.strength} {entry.strength}
              </p>
            ))
          )}
          <button
            onClick={() =>
              void window.devReplay.reviews
                .acknowledgeEvidence({ interviewId: flow.interviewId })
                .then(apply)
            }
          >
            {zhCN.recall.acknowledge}
          </button>
        </>
      )}

      {flow.stage === 'training_decision' && (
        <>
          <h2>{zhCN.recall.decision}</h2>
          <label>
            {zhCN.recall.noTrainingReason}
            <textarea value={reason} onChange={(event) => setReason(event.target.value)} />
          </label>
          <button
            disabled={!reason.trim()}
            onClick={() =>
              void window.devReplay.reviews
                .completeWithoutTraining({ interviewId: flow.interviewId, reason })
                .then(apply)
            }
          >
            {zhCN.recall.complete}
          </button>
        </>
      )}

      {flow.stage === 'completed' && (
        <div className="notice">
          <h2>{zhCN.recall.completed}</h2>
          <p>{zhCN.recall.completedDescription}</p>
        </div>
      )}
    </section>
  )
}

function QuestionAnswerEditor({
  flow,
  item,
  onChange
}: {
  flow: ReviewFlowState
  item: ReviewFlowState['items'][number]
  onChange(state: ReviewFlowState): void
}): React.JSX.Element {
  const [answer, setAnswer] = useState(item.answer.status === 'known' ? item.answer.value : '')
  const [unknown, setUnknown] = useState(item.status === 'unknown')
  return (
    <article className="review-item-card">
      <strong>{item.question}</strong>
      <label>
        {zhCN.recall.answer}
        <textarea
          disabled={unknown}
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
        />
      </label>
      <label className="check-row">
        <input
          type="checkbox"
          checked={unknown}
          onChange={(event) => setUnknown(event.target.checked)}
        />
        {zhCN.common.unknown}
      </label>
      <button
        disabled={!unknown && !answer.trim()}
        onClick={() => {
          void window.devReplay.reviews
            .answerQuestion({
              interviewId: flow.interviewId,
              itemId: item.id,
              answer,
              unknown
            })
            .then((result) => {
              if (result.ok) onChange(result.data)
            })
        }}
      >
        {zhCN.common.save}
      </button>
    </article>
  )
}
