import { CAPABILITY_STATE_LABELS } from '@devreplay/domain'
import type { CapabilityProfileData } from '@devreplay/shared'
import { useState } from 'react'
import { zhCN } from './i18n/zh-CN'

const POLARITY_LABELS = {
  positive: zhCN.profile.supporting,
  negative: zhCN.profile.challenging,
  neutral: zhCN.profile.neutral
} as const

export function ProfileWorkspace({
  profile,
  onSwitchTarget
}: {
  profile: CapabilityProfileData
  onSwitchTarget(id: string): void
}): React.JSX.Element {
  const [selectedId, setSelectedId] = useState<string>()
  const selected = profile.capabilities.find((item) => item.id === selectedId)
  return (
    <section className="workspace-card" aria-label={zhCN.profile.label}>
      <div className="workspace-title">
        <div>
          <p className="eyebrow">{zhCN.profile.eyebrow}</p>
          <h1>{zhCN.profile.title}</h1>
        </div>
        {profile.targets.length > 0 && (
          <label>
            {zhCN.profile.target}
            <select
              aria-label={zhCN.profile.target}
              value={profile.activeTargetId}
              onChange={(event) => onSwitchTarget(event.target.value)}
            >
              {profile.targets.map((target) => (
                <option key={target.id} value={target.id}>
                  {target.title}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <div className="capability-layout">
        <div className="capability-list">
          {profile.capabilities.map((capability) => (
            <button
              className="interview-row"
              key={capability.id}
              onClick={() => setSelectedId(capability.id)}
            >
              <span>
                <strong>{capability.name}</strong>
                <small>
                  {zhCN.profile.weight} {capability.targetWeight}
                </small>
              </span>
              <span className="stage-pill">{CAPABILITY_STATE_LABELS[capability.state]}</span>
            </button>
          ))}
        </div>
        {selected && (
          <aside className="review-column" aria-label={zhCN.profile.detail}>
            <h2>{selected.name}</h2>
            <p>{selected.reason}</p>
            <h3>{zhCN.profile.timeline}</h3>
            {selected.evidence.length === 0 && <p>{zhCN.profile.noEvidence}</p>}
            {selected.evidence.map((item) => (
              <article className="evidence-row" key={item.id}>
                <span className={`evidence-polarity ${item.polarity}`}>
                  {POLARITY_LABELS[item.polarity]}
                </span>
                <p>{item.summary}</p>
                <small>
                  {item.createdAt} · {item.sourceType}
                </small>
              </article>
            ))}
          </aside>
        )}
      </div>
    </section>
  )
}
