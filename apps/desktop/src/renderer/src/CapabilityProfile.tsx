import {
  CAPABILITY_STATE_LABELS,
  type CapabilityNode,
  type CapabilityState
} from '@devreplay/domain'

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
    <section aria-label="能力画像" className="workspace-card">
      <p className="eyebrow">能力画像</p>
      <h2>证据驱动的离散状态</h2>
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
          <strong>建议新增：{proposedNode.name}</strong>
          <p>
            归入 {proposedNode.parentName}：{proposedNode.reason}
          </p>
          <button onClick={onConfirmNode}>确认加入画像</button>
        </article>
      )}
    </section>
  )
}
