import { useEffect, useState } from 'react'
import type { CodeSandboxResult, CodeTrainingTask } from '@devreplay/shared'
import { zhCN } from './i18n/zh-CN'

export function CodeTrainingEditor({
  trainingTaskId,
  onBack
}: {
  readonly trainingTaskId: string
  readonly onBack?: () => void
}): React.JSX.Element {
  const [task, setTask] = useState<CodeTrainingTask>()
  const [source, setSource] = useState('')
  const [result, setResult] = useState<CodeSandboxResult>()
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    void window.devReplay.training.getCodeTask({ trainingTaskId }).then((response) => {
      if (response.ok) {
        setTask(response.data)
        setSource(response.data.starterCode)
      } else setError(response.error.message)
    })
  }, [trainingTaskId])

  const execute = async (submit: boolean): Promise<void> => {
    setError('')
    if (submit) {
      const response = await window.devReplay.training.submitCode({ trainingTaskId, source })
      if (!response.ok) {
        setError(response.error.message)
        return
      }
      setResult(response.data.testResult)
      setSubmitted(true)
    } else {
      const response = await window.devReplay.training.runCode({ trainingTaskId, source })
      if (!response.ok) {
        setError(response.error.message)
        return
      }
      setResult(response.data)
      setSubmitted(false)
    }
  }

  if (error && !task) return <p className="notice error">{error}</p>
  if (!task) return <p>{zhCN.code.loading}</p>

  return (
    <section className="workspace-card" aria-label={zhCN.code.label}>
      {onBack ? <button onClick={onBack}>{zhCN.common.back}</button> : null}
      <p className="eyebrow">
        {zhCN.code.eyebrow} v{task.assessmentContractVersion}
      </p>
      <h1>{task.title}</h1>
      <p>{task.prompt}</p>
      <section aria-label={zhCN.code.publicTests}>
        <h2>{zhCN.code.publicTests}</h2>
        <ul>
          {task.publicTests.map((test) => (
            <li key={test.name}>
              {test.name}：{JSON.stringify(test.args)} → {JSON.stringify(test.expected)}
            </li>
          ))}
        </ul>
      </section>
      <label>
        {task.language === 'typescript' ? 'TypeScript' : 'JavaScript'} {zhCN.code.answer}
        <textarea value={source} onChange={(event) => setSource(event.target.value)} rows={16} />
      </label>
      <div className="topbar-actions">
        <button onClick={() => void execute(false)}>{zhCN.code.run}</button>
        <button onClick={() => void execute(true)}>{zhCN.common.submit}</button>
      </div>
      {error ? <p className="notice error">{error}</p> : null}
      {result ? (
        <section aria-label={zhCN.code.results}>
          <h2>
            {submitted ? zhCN.code.submitResult : zhCN.code.runResult}：
            {result.passed ? zhCN.common.pass : zhCN.common.fail}
          </h2>
          {result.publicResults.map((item) => (
            <p key={item.name}>
              {item.name}：{item.passed ? zhCN.common.pass : zhCN.common.fail}
            </p>
          ))}
          <p>
            {zhCN.code.hiddenTests}：{result.hiddenResults.filter((item) => item.passed).length}/
            {result.hiddenResults.length} {zhCN.code.passedCount}
          </p>
          {result.hiddenResults.some((item) => !item.passed) ? (
            <p>{zhCN.code.hiddenFailure}</p>
          ) : null}
          {result.error ? <p>{result.error.message}</p> : null}
        </section>
      ) : null}
    </section>
  )
}
