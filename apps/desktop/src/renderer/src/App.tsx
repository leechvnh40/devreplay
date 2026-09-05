import { useEffect, useState, type FormEvent } from 'react'
import type {
  CapabilityProfileData,
  InterviewSummary,
  OnboardingState,
  TodayAction,
  TrainingTaskSummary
} from '@devreplay/shared'
import { FreeRecallEditor } from './FreeRecallEditor'
import { InterviewCreateForm } from './InterviewCreateForm'
import { ModelSettingsPanel } from './ModelSettingsPanel'
import { TodayWorkspace } from './TodayWorkspace'
import { TrainingWorkspace } from './TrainingWorkspace'
import { ProfileWorkspace } from './ProfileWorkspace'
import { CodeTrainingEditor } from './CodeTrainingEditor'
import { zhCN } from './i18n/zh-CN'
import { ExplanationTrainingEditor } from './ExplanationTrainingEditor'

type Workspace = 'today' | 'interviews' | 'training' | 'profile'

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
  if (!state) return <main className="app-shell">{zhCN.app.loading}</main>
  if (!state.initialized) return <OnboardingForm onSaved={setState} />
  return <ProductShell onboarding={state} />
}

function ProductShell({ onboarding }: { onboarding: OnboardingState }): React.JSX.Element {
  const [interviews, setInterviews] = useState<readonly InterviewSummary[]>([])
  const [today, setToday] = useState<TodayAction>()
  const [trainingTasks, setTrainingTasks] = useState<readonly TrainingTaskSummary[]>([])
  const [profile, setProfile] = useState<CapabilityProfileData>()
  const [workspace, setWorkspace] = useState<Workspace>('today')
  const [selectedId, setSelectedId] = useState<string>()
  const [selectedTrainingId, setSelectedTrainingId] = useState<string>()
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

  const refreshProduct = async (): Promise<void> => {
    const [todayResult, trainingResult, profileResult] = await Promise.all([
      window.devReplay.workspace.getToday(),
      window.devReplay.training.list(),
      window.devReplay.capabilities.getProfile()
    ])
    if (todayResult.ok) setToday(todayResult.data)
    else setError(todayResult.error.message)
    if (trainingResult.ok) setTrainingTasks(trainingResult.data)
    else setError(trainingResult.error.message)
    if (profileResult.ok) setProfile(profileResult.data)
    else setError(profileResult.error.message)
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
    void Promise.all([
      window.devReplay.workspace.getToday(),
      window.devReplay.training.list(),
      window.devReplay.capabilities.getProfile()
    ]).then(([todayResult, trainingResult, profileResult]) => {
      if (todayResult.ok) setToday(todayResult.data)
      else setError(todayResult.error.message)
      if (trainingResult.ok) setTrainingTasks(trainingResult.data)
      else setError(trainingResult.error.message)
      if (profileResult.ok) setProfile(profileResult.data)
      else setError(profileResult.error.message)
    })
  }, [])

  if (selectedId) {
    return (
      <main className="app-shell">
        <FreeRecallEditor interviewId={selectedId} onBack={() => setSelectedId(undefined)} />
      </main>
    )
  }

  if (selectedTrainingId) {
    const task = trainingTasks.find((item) => item.id === selectedTrainingId)
    return (
      <main className="app-shell">
        <button className="text-button" onClick={() => setSelectedTrainingId(undefined)}>
          {zhCN.app.backTraining}
        </button>
        {task?.type === 'code' ? (
          <CodeTrainingEditor trainingTaskId={selectedTrainingId} />
        ) : task?.type === 'explanation' ? (
          <ExplanationTrainingEditor trainingTaskId={selectedTrainingId} />
        ) : (
          <section className="workspace-card notice">{zhCN.app.explanationPlaceholder}</section>
        )}
      </main>
    )
  }

  if (showSettings) {
    return (
      <main className="app-shell">
        <ModelSettingsPanel
          onClose={() => {
            setShowSettings(false)
            void refresh()
            void refreshProduct()
          }}
        />
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
            {zhCN.nav.settings}
          </button>
        </span>
      </header>

      <nav className="primary-nav" aria-label={zhCN.app.primaryNav}>
        {(
          [
            ['today', zhCN.nav.today],
            ['interviews', zhCN.nav.interviews],
            ['training', zhCN.nav.training],
            ['profile', zhCN.nav.profile]
          ] as const
        ).map(([id, label]) => (
          <button
            className={workspace === id ? 'nav-button active' : 'nav-button'}
            key={id}
            onClick={() => setWorkspace(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      {error && <p className="notice error">{error}</p>}

      {workspace === 'today' && today && (
        <TodayWorkspace
          action={today}
          onOpenInterview={() => setWorkspace('interviews')}
          onOpenTraining={(id) => {
            setWorkspace('training')
            if (id) setSelectedTrainingId(id)
          }}
        />
      )}
      {workspace === 'training' && (
        <TrainingWorkspace tasks={trainingTasks} onOpen={setSelectedTrainingId} />
      )}
      {workspace === 'profile' && profile && (
        <ProfileWorkspace
          profile={profile}
          onSwitchTarget={async (targetProfileId) => {
            const result = await window.devReplay.capabilities.switchTarget({ targetProfileId })
            if (result.ok) {
              setProfile(result.data)
              await refreshProduct()
            } else setError(result.error.message)
          }}
        />
      )}
      {workspace === 'interviews' &&
        (creating || (loaded && interviews.length === 0) ? (
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
                <p className="eyebrow">{zhCN.app.realInterview}</p>
                <h1>{zhCN.app.interviewRecords}</h1>
              </div>
              <button onClick={() => setCreating(true)}>{zhCN.app.newInterview}</button>
            </div>
            {!loaded ? (
              <p>{zhCN.app.loadingInterviews}</p>
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
                    <span className="stage-pill">{zhCN.app.freeRecall}</span>
                  </button>
                ))}
              </div>
            )}
          </section>
        ))}
    </main>
  )
}

function OnboardingForm({ onSaved }: { onSaved(state: OnboardingState): void }): React.JSX.Element {
  const [targetRole, setTargetRole] = useState('')
  const [resumeLabel, setResumeLabel] = useState(zhCN.app.defaultResumeLabel)
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
          <p className="eyebrow">{zhCN.app.onboardingEyebrow}</p>
          <h1>{zhCN.app.onboardingTitle}</h1>
          <p>{zhCN.app.onboardingDescription}</p>
        </div>
        <label>
          {zhCN.app.targetRole}
          <input value={targetRole} onChange={(event) => setTargetRole(event.target.value)} />
        </label>
        <label>
          {zhCN.app.resumeLabel}
          <input value={resumeLabel} onChange={(event) => setResumeLabel(event.target.value)} />
        </label>
        <label>
          {zhCN.app.resumeText}
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
          {zhCN.app.riskNotice}
        </label>
        {error && <p className="notice error">{error}</p>}
        <button
          type="submit"
          disabled={
            !targetRole.trim() || !resumeLabel.trim() || !resumeContent.trim() || !riskAccepted
          }
        >
          {zhCN.app.saveContinue}
        </button>
      </form>
    </main>
  )
}

export default App
