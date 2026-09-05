import type { TrainingTaskSummary } from '@devreplay/shared'
import { zhCN } from './i18n/zh-CN'

export function TrainingWorkspace({
  tasks,
  onOpen
}: {
  tasks: readonly TrainingTaskSummary[]
  onOpen(id: string): void
}): React.JSX.Element {
  return (
    <section className="workspace-card" aria-label={zhCN.training.label}>
      <div className="workspace-title">
        <div>
          <p className="eyebrow">{zhCN.training.eyebrow}</p>
          <h1>{zhCN.training.title}</h1>
        </div>
      </div>
      <div className="interview-list">
        {tasks.length === 0 && <p className="notice">{zhCN.training.empty}</p>}
        {tasks.map((task) => (
          <button className="interview-row" key={task.id} onClick={() => onOpen(task.id)}>
            <span>
              <strong>{task.capabilityName}</strong>
              <small>
                {task.type === 'code' ? zhCN.training.code : zhCN.training.explanation} ·{' '}
                {zhCN.training.priority} {task.score}
              </small>
            </span>
            <span className="stage-pill">
              {task.status === 'active' ? zhCN.training.active : zhCN.training.queued}
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}
