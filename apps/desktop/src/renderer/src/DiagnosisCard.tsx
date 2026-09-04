import type { DiagnosticHypothesis, DiagnosisResolution } from '@devreplay/domain'

export function DiagnosisCard({
  hypothesis,
  onResolve
}: {
  hypothesis: DiagnosticHypothesis
  onResolve(resolution: Exclude<DiagnosisResolution, 'unresolved'>): void
}): React.JSX.Element {
  return (
    <article className="review-item-card">
      <p className="eyebrow">待确认诊断</p>
      <h3>{hypothesis.claim}</h3>
      <p>置信度：{hypothesis.confidence}</p>
      <p>其他解释：{hypothesis.alternativeExplanations.join('、')}</p>
      <p>验证方式：{hypothesis.verificationPlan}</p>
      <div className="dialog-actions">
        <button onClick={() => onResolve('confirmed')}>确认</button>
        <button className="secondary-button" onClick={() => onResolve('rejected')}>
          驳回
        </button>
        <button className="secondary-button" onClick={() => onResolve('kept_pending')}>
          保留待验证
        </button>
      </div>
    </article>
  )
}
