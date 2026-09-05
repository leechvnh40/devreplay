import { useState } from 'react'
import {
  createReviewItem,
  currentReviewItemRevision,
  reviseReviewItem,
  type ReviewItem
} from '@devreplay/domain'
import { zhCN } from './i18n/zh-CN'

const initialItems: readonly ReviewItem[] = [
  createReviewItem({
    id: 'question-1',
    kind: 'question',
    content: '面试官询问了 React 渲染优化。',
    sourceId: 'free-recall',
    createdAt: '2026-09-04T00:00:00.000Z'
  })
]

export function ReviewWorkspace(): React.JSX.Element {
  const [items, setItems] = useState(initialItems)

  const revise = (item: ReviewItem, content: string): void => {
    setItems((current) =>
      current.map((candidate) =>
        candidate.id === item.id
          ? reviseReviewItem(candidate, {
              id: `${candidate.id}:revision:${candidate.revisions.length + 1}`,
              content,
              createdAt: new Date().toISOString()
            })
          : candidate
      )
    )
  }

  return (
    <section className="review-workspace" aria-label={zhCN.review.workspace}>
      <div className="review-column conversation-column">
        <p className="eyebrow">{zhCN.review.recall}</p>
        <h2>{zhCN.review.conversation}</h2>
        <p className="recall-guidance">{zhCN.review.guidance}</p>
      </div>
      <div className="review-column structured-column">
        <p className="eyebrow">{zhCN.review.result}</p>
        <h2>{zhCN.review.card}</h2>
        {items.map((item) => {
          const current = currentReviewItemRevision(item)
          return (
            <article className="review-item-card" key={item.id}>
              <label>
                {zhCN.review.question}
                <textarea
                  aria-label={zhCN.review.question}
                  value={current.content}
                  onChange={(event) => revise(item, event.target.value)}
                />
              </label>
              <div className="source-row">
                <span className="source-badge">
                  {zhCN.review.currentSource}：{current.provenance.sourceType}
                </span>
                <details>
                  <summary>{zhCN.review.originalSource}</summary>
                  <p>{item.original.content}</p>
                  <small>{item.original.provenance.sourceType}</small>
                </details>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}

export function PersistentReviewWorkspace({
  items,
  onRevise
}: {
  items: readonly {
    id: string
    question: string
    originalQuestion?: string
    sourceType: string
  }[]
  onRevise(itemId: string, question: string): void
}): React.JSX.Element {
  return (
    <section className="review-workspace" aria-label={zhCN.review.workspace}>
      <div className="review-column conversation-column">
        <p className="eyebrow">{zhCN.review.recall}</p>
        <h2>{zhCN.review.conversation}</h2>
        <p className="recall-guidance">{zhCN.review.questionGuidance}</p>
      </div>
      <div className="review-column structured-column">
        <p className="eyebrow">{zhCN.review.result}</p>
        <h2>{zhCN.review.card}</h2>
        {items.map((item) => (
          <article className="review-item-card" key={item.id}>
            <label>
              {zhCN.review.question}
              <textarea
                aria-label={`${zhCN.review.question}-${item.id}`}
                value={item.question}
                onChange={(event) => onRevise(item.id, event.target.value)}
              />
            </label>
            <div className="source-row">
              <span className="source-badge">
                {zhCN.review.currentSource}：{item.sourceType}
              </span>
              {item.originalQuestion && (
                <details>
                  <summary>{zhCN.review.originalSource}</summary>
                  <p>{item.originalQuestion}</p>
                </details>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
