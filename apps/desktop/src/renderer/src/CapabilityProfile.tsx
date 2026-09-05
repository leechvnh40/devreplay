import {
  CAPABILITY_STATE_LABELS,
  type CapabilityNode,
  type CapabilityState
} from '@devreplay/domain'
import { zhCN } from './i18n/zh-CN'

export interface CapabilityView {
  readonly node: CapabilityNode
  readonly state: CapabilityState
  readonly reason: string
}

export function CapabilityProfile({
  capabilities,
  proposedNode,
  onConfirmNode
}: {
  capabilities: readonly CapabilityView[]
  proposedNode?: { readonly name: string; readonly parentName: string; readonly reason: string }
  onConfirmNode?(): void
}): React.JSX.Element {
  return (
    <section aria-label={zhCN.capability.label} className="workspace-card">
      <p className="eyebrow">{zhCN.capability.eyebrow}</p>
      <h2>{zhCN.capability.title}</h2>
      <div className="capability-list">
        {capabilities.map(({ node, state, reason }) => (
          <article className="review-item-card" key={node.id}>
            <div className="workspace-title">
              <h3>{node.name}</h3>
              <span className="stage-pill">{CAPABILITY_STATE_LABELS[state]}</span>
            </div>
            <p>{reason}</p>
          </article>
        ))}
      </div>
      {proposedNode && (
        <article className="warning-box">
          <strong>
            {zhCN.capability.propose}：{proposedNode.name}
          </strong>
          <p>
            {zhCN.capability.belongsTo} {proposedNode.parentName}：{proposedNode.reason}
          </p>
          <button onClick={onConfirmNode}>{zhCN.capability.confirm}</button>
        </article>
      )}
    </section>
  )
}
