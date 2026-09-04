import { useEffect, useState, type FormEvent } from 'react'
import type { InterviewSummary, OnboardingState } from '@devreplay/shared'
import { FreeRecallEditor } from './FreeRecallEditor'
import { InterviewCreateForm } from './InterviewCreateForm'
import { ModelSettingsPanel } from './ModelSettingsPanel'

function App(): React.JSX.Element {
  const [state, setState] = useState<OnboardingState>()
  const [error, setError] = useState('')

  useEffect(() => {
    void window.devReplay.onboarding.getState().then((result) => {
      if (result.ok) setState(result.data)
      else setError(result.error.message)
    })
  }, [])

  if (error) return <main className="app-shell notice error">{error}</main>
  if (!state) return <main className="app-shell">正在读取本地状态…</main>
  if (!state.initialized) return <OnboardingForm onSaved={setState} />
  return <InterviewWorkspace onboarding={state} />
}

function InterviewWorkspace({ onboarding }: { onboarding: OnboardingState }): React.JSX.Element {
  const [interviews, setInterviews] = useState<readonly InterviewSummary[]>([])
  const [selectedId, setSelectedId] = useState<string>()
  const [creating, setCreating] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')
  const [showSettings, setShowSettings] = useState(false)

  const refresh = async (): Promise<void> => {
    const result = await window.devReplay.interviews.list()
    if (result.ok) {
      setInterviews(result.data)
      setLoaded(true)
    } else {
      setError(result.error.message)
    }
  }

  useEffect(() => {
    void window.devReplay.interviews.list().then((result) => {
      if (result.ok) {
        setInterviews(result.data)
        setLoaded(true)
      } else {
        setError(result.error.message)
      }
    })
  }, [])

  if (selectedId) {
    return (
      <main className="app-shell">
        <FreeRecallEditor interviewId={selectedId} onBack={() => setSelectedId(undefined)} />
      </main>
    )
  }

  if (showSettings) {
    return (
      <main className="app-shell">
        <ModelSettingsPanel onClose={() => setShowSettings(false)} />
      </main>
    )
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <strong>DevReplay</strong>
        <span className="topbar-actions">
          <span>{onboarding.targetRole}</span>
          <button className="text-button" onClick={() => setShowSettings(true)}>
            DeepSeek 设置
          </button>
        </span>
      </header>

      {error && <p className="notice error">{error}</p>}

      {creating || (loaded && interviews.length === 0) ? (
        <InterviewCreateForm
          hasResume={Boolean(onboarding.resumeSnapshotId)}
          onCreate={async (payload) => {
            const result = await window.devReplay.interviews.create(payload)
            if (result.ok) {
              await refresh()
              setCreating(false)
              setSelectedId(result.data.interviewId)
            } else {
              setError(result.error.message)
            }
          }}
        />
      ) : (
        <section className="workspace-card">
          <div className="workspace-title">
            <div>
              <p className="eyebrow">真实面试</p>
              <h1>面试记录</h1>
            </div>
            <button onClick={() => setCreating(true)}>新建面试</button>
          </div>
          {!loaded ? (
            <p>正在读取面试…</p>
          ) : (
            <div className="interview-list">
              {interviews.map((interview) => (
                <button
                  className="interview-row"
                  key={interview.id}
                  onClick={() => setSelectedId(interview.id)}
                >
                  <span>
                    <strong>{interview.company}</strong>
                    <small>
                      {interview.role} · {interview.round}
                    </small>
                  </span>
                  <span className="stage-pill">自由回忆</span>
                </button>
              ))}
            </div>
          )}
        </section>
      )}
    </main>
  )
}

function OnboardingForm({ onSaved }: { onSaved(state: OnboardingState): void }): React.JSX.Element {
  const [targetRole, setTargetRole] = useState('')
  const [resumeLabel, setResumeLabel] = useState('当前求职简历')
  const [resumeContent, setResumeContent] = useState('')
  const [riskAccepted, setRiskAccepted] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    const result = await window.devReplay.onboarding.save({
      targetRole,
      resumeLabel,
      resumeContent,
      riskAccepted: true
    })
    if (result.ok) onSaved(result.data)
    else setError(result.error.message)
  }

  return (
    <main className="app-shell onboarding-shell">
      <form className="form-card" onSubmit={submit}>
        <div className="section-heading">
          <p className="eyebrow">DEVREPLAY / 本地初始化</p>
          <h1>先固定你的求职上下文</h1>
          <p>简历会保存为不可变文本快照；之后修改会创建新版本。</p>
        </div>
        <label>
          目标岗位
          <input value={targetRole} onChange={(event) => setTargetRole(event.target.value)} />
        </label>
        <label>
          简历名称
          <input value={resumeLabel} onChange={(event) => setResumeLabel(event.target.value)} />
        </label>
        <label>
          简历文本
          <textarea
            className="resume-input"
            value={resumeContent}
            onChange={(event) => setResumeContent(event.target.value)}
          />
        </label>
        <label className="check-row warning-box">
          <input
            type="checkbox"
            checked={riskAccepted}
            onChange={(event) => setRiskAccepted(event.target.checked)}
          />
          我知道业务文本以明文保存在本机，DevReplay 不收集、不自动上传任何数据
        </label>
        {error && <p className="notice error">{error}</p>}
        <button
          type="submit"
          disabled={
            !targetRole.trim() || !resumeLabel.trim() || !resumeContent.trim() || !riskAccepted
          }
        >
          保存并继续
        </button>
      </form>
    </main>
  )
}

export default App
