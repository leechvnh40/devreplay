import type { DiagnosticHypothesis, DiagnosisResolution } from '@devreplay/domain'
import { zhCN } from './i18n/zh-CN'

export function DiagnosisCard({
  hypothesis,
  onResolve
}: {
  hypothesis: DiagnosticHypothesis
  onResolve(resolution: Exclude<DiagnosisResolution, 'unresolved'>): void
}): React.JSX.Element {
  return (
    <article className="review-item-card">
      <p className="eyebrow">{zhCN.diagnosis.eyebrow}</p>
      <h3>{hypothesis.claim}</h3>
      <p>
        {zhCN.diagnosis.confidence}：{hypothesis.confidence}
      </p>
      <p>
        {zhCN.diagnosis.alternatives}：{hypothesis.alternativeExplanations.join('、')}
      </p>
      <p>
        {zhCN.diagnosis.verification}：{hypothesis.verificationPlan}
      </p>
      <div className="dialog-actions">
        <button onClick={() => onResolve('confirmed')}>{zhCN.diagnosis.confirm}</button>
        <button className="secondary-button" onClick={() => onResolve('rejected')}>
          {zhCN.diagnosis.reject}
        </button>
        <button className="secondary-button" onClick={() => onResolve('kept_pending')}>
          {zhCN.diagnosis.pending}
        </button>
      </div>
    </article>
  )
}
