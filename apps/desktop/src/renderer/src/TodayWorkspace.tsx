import type { TodayAction } from '@devreplay/shared'
import { zhCN } from './i18n/zh-CN'

export function TodayWorkspace({
  action,
  onOpenInterview,
  onOpenTraining
}: {
  action: TodayAction
  onOpenInterview(): void
  onOpenTraining(trainingTaskId?: string): void
}): React.JSX.Element {
  const open = (): void => {
    if (action.kind === 'empty') onOpenInterview()
    else onOpenTraining(action.trainingTaskId)
  }
  return (
    <section className="workspace-card" aria-label={zhCN.today.label}>
      <div className="workspace-title">
        <div>
          <p className="eyebrow">{zhCN.today.eyebrow}</p>
          <h1>{action.title}</h1>
        </div>
      </div>
      <article className="today-action">
        <p>{action.description}</p>
        {action.factors.length > 0 && (
          <div aria-label={zhCN.today.factors} className="factor-list">
            {action.factors.map((factor) => (
              <span className="stage-pill" key={factor.key}>
                {factor.label} +{factor.contribution}
              </span>
            ))}
          </div>
        )}
        <button onClick={open}>
          {action.kind === 'empty' ? zhCN.today.record : zhCN.today.start}
        </button>
      </article>
    </section>
  )
}
