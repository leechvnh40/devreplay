import { useState, type FormEvent } from 'react'
import { zhCN } from './i18n/zh-CN'
import type { IpcRequestPayload } from '@devreplay/shared'

interface InterviewCreateFormProps {
  hasResume: boolean
  onCreate(payload: IpcRequestPayload<'interview.create'>): Promise<void>
}

export function InterviewCreateForm({
  hasResume,
  onCreate
}: InterviewCreateFormProps): React.JSX.Element {
  const [company, setCompany] = useState('')
  const [role, setRole] = useState('')
  const [occurredAt, setOccurredAt] = useState('')
  const [round, setRound] = useState('')
  const [jobDescription, setJobDescription] = useState('')
  const [confirmWithoutJobDescription, setConfirmWithoutJobDescription] = useState(false)

  const requiredFieldsComplete = Boolean(company && role && occurredAt && round)
  const jobDescriptionReady = Boolean(jobDescription.trim() || confirmWithoutJobDescription)
  const canSubmit = hasResume && requiredFieldsComplete && jobDescriptionReady

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    if (!canSubmit) return
    await onCreate({
      company,
      role,
      occurredAt,
      round,
      jobDescription,
      confirmWithoutJobDescription
    })
  }

  return (
    <form className="form-card" onSubmit={submit}>
      <div className="section-heading">
        <p className="eyebrow">{zhCN.createInterview.eyebrow}</p>
        <h1>{zhCN.createInterview.title}</h1>
        <p>{zhCN.createInterview.description}</p>
      </div>

      {!hasResume && <p className="notice error">{zhCN.createInterview.missingResume}</p>}

      <div className="field-grid">
        <label>
          {zhCN.createInterview.company}
          <input value={company} onChange={(event) => setCompany(event.target.value)} />
        </label>
        <label>
          {zhCN.createInterview.role}
          <input value={role} onChange={(event) => setRole(event.target.value)} />
        </label>
        <label>
          {zhCN.createInterview.occurredAt}
          <input
            type="datetime-local"
            value={occurredAt}
            onChange={(event) => setOccurredAt(event.target.value)}
          />
        </label>
        <label>
          {zhCN.createInterview.round}
          <input value={round} onChange={(event) => setRound(event.target.value)} />
        </label>
      </div>

      <label>
        {zhCN.createInterview.jd}
        <textarea
          value={jobDescription}
          onChange={(event) => {
            setJobDescription(event.target.value)
            if (event.target.value.trim()) setConfirmWithoutJobDescription(false)
          }}
        />
      </label>

      {!jobDescription.trim() && (
        <label className="check-row">
          <input
            type="checkbox"
            checked={confirmWithoutJobDescription}
            onChange={(event) => setConfirmWithoutJobDescription(event.target.checked)}
          />
          {zhCN.createInterview.noJdConfirm}
        </label>
      )}

      <button type="submit" disabled={!canSubmit}>
        {zhCN.createInterview.submit}
      </button>
    </form>
  )
}
