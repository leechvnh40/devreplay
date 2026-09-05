import { useEffect, useState } from 'react'
import type { IpcResponseData } from '@devreplay/shared'
import { zhCN } from './i18n/zh-CN'

export function ExplanationTrainingEditor({
  trainingTaskId
}: {
  trainingTaskId: string
}): React.JSX.Element {
  const [task, setTask] = useState<IpcResponseData<'training.get-explanation-task'>>()
  const [answer, setAnswer] = useState('')
  const [result, setResult] = useState<IpcResponseData<'training.submit-explanation'>>()
  const [error, setError] = useState('')
  useEffect(() => {
    void window.devReplay.training.getExplanationTask({ trainingTaskId }).then((response) => {
      if (response.ok) setTask(response.data)
      else setError(response.error.message)
    })
  }, [trainingTaskId])
  if (!task) return <p>{error || zhCN.explanation.loading}</p>
  return (
    <section className="workspace-card" aria-label={zhCN.explanation.label}>
      <p className="eyebrow">
        {zhCN.explanation.contract} v{task.assessmentContractVersion}
      </p>
      <h1>{task.title}</h1>
      <p>{task.prompt}</p>
      <label>
        {zhCN.explanation.answer}
        <textarea value={answer} onChange={(event) => setAnswer(event.target.value)} />
      </label>
      <button
        disabled={!answer.trim()}
        onClick={async () => {
          const response = await window.devReplay.training.submitExplanation({
            trainingTaskId,
            answer
          })
          if (response.ok) setResult(response.data)
          else setError(response.error.message)
        }}
      >
        {zhCN.explanation.submit}
      </button>
      {error && <p className="notice error">{error}</p>}
      {result && (
        <section className={result.passed ? 'notice' : 'notice error'} role="status">
          <strong>{result.passed ? zhCN.explanation.passed : zhCN.explanation.failed}</strong>
          <p>{result.reason}</p>
          {result.retestDueDate && (
            <p>
              {zhCN.explanation.retest}：{result.retestDueDate}
            </p>
          )}
        </section>
      )}
    </section>
  )
}
