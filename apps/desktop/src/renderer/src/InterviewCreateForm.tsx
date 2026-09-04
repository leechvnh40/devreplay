import { useState, type FormEvent } from 'react'
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
        <p className="eyebrow">第一场真实面试</p>
        <h1>创建面试复盘</h1>
        <p>创建后先自由回忆，不会立即产生能力结论。</p>
      </div>

      {!hasResume && <p className="notice error">请先保存简历快照，才能创建面试。</p>}

      <div className="field-grid">
        <label>
          公司
          <input value={company} onChange={(event) => setCompany(event.target.value)} />
        </label>
        <label>
          岗位
          <input value={role} onChange={(event) => setRole(event.target.value)} />
        </label>
        <label>
          面试时间
          <input
            type="datetime-local"
            value={occurredAt}
            onChange={(event) => setOccurredAt(event.target.value)}
          />
        </label>
        <label>
          轮次
          <input value={round} onChange={(event) => setRound(event.target.value)} />
        </label>
      </div>

      <label>
        JD 文本（可选）
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
          我知道缺少 JD 会降低诊断相关性，仍然继续
        </label>
      )}

      <button type="submit" disabled={!canSubmit}>
        创建并开始自由回忆
      </button>
    </form>
  )
}
