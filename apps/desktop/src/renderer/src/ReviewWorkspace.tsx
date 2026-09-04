import { useState } from 'react'
import {
  createReviewItem,
  currentReviewItemRevision,
  reviseReviewItem,
  type ReviewItem
} from '@devreplay/domain'

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
    <section className="review-workspace" aria-label="结构化复盘工作区">
      <div className="review-column conversation-column">
        <p className="eyebrow">回忆与追问</p>
        <h2>面试对话</h2>
        <p className="recall-guidance">先按记忆还原；记不清的内容可以明确标为未知。</p>
      </div>
      <div className="review-column structured-column">
        <p className="eyebrow">结构化结果</p>
        <h2>复盘卡</h2>
        {items.map((item) => {
          const current = currentReviewItemRevision(item)
          return (
            <article className="review-item-card" key={item.id}>
              <label>
                面试问题
                <textarea
                  aria-label="面试问题"
                  value={current.content}
                  onChange={(event) => revise(item, event.target.value)}
                />
              </label>
              <div className="source-row">
                <span className="source-badge">当前来源：{current.provenance.sourceType}</span>
                <details>
                  <summary>查看原始来源</summary>
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
