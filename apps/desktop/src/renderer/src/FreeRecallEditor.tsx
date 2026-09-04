import { useEffect, useRef, useState } from 'react'
import type { ReviewDraft } from '@devreplay/shared'

export function FreeRecallEditor({
  interviewId,
  onBack
}: {
  interviewId: string
  onBack(): void
}): React.JSX.Element {
  const [draft, setDraft] = useState<ReviewDraft>()
  const [content, setContent] = useState('')
  const [status, setStatus] = useState('正在读取本地草稿…')
  const changedByUser = useRef(false)

  useEffect(() => {
    changedByUser.current = false
    void window.devReplay.reviews.getDraft({ interviewId }).then((result) => {
      if (result.ok) {
        setDraft(result.data)
        setContent(result.data.freeRecall)
        setStatus('已从本地恢复')
      } else {
        setStatus(result.error.message)
      }
    })
  }, [interviewId])

  useEffect(() => {
    if (!draft || !changedByUser.current) return
    setStatus('等待保存…')
    const timer = window.setTimeout(() => {
      void window.devReplay.reviews.saveFreeRecall({ interviewId, content }).then((result) => {
        setStatus(result.ok ? '已保存到本地' : result.error.message)
        if (result.ok) changedByUser.current = false
      })
    }, 500)
    return () => window.clearTimeout(timer)
  }, [content, draft, interviewId])

  if (!draft) {
    return (
      <section className="form-card">
        <p>{status}</p>
        <button onClick={onBack}>返回面试列表</button>
      </section>
    )
  }

  return (
    <section className="form-card recall-card">
      <button className="text-button" onClick={onBack}>
        ← 返回面试列表
      </button>
      <div className="section-heading">
        <p className="eyebrow">自由回忆 / 自动保存</p>
        <h1>{draft.interview.company}</h1>
        <p>
          {draft.interview.role} · {draft.interview.round}
        </p>
      </div>
      <p className="recall-guidance">
        先连续写下题目、你的回答、面试官反应和当时不确定的地方。此阶段不会生成诊断，也不会更新能力画像。
      </p>
      <label>
        我记得的面试过程
        <textarea
          className="recall-input"
          value={content}
          autoFocus
          onChange={(event) => {
            changedByUser.current = true
            setContent(event.target.value)
          }}
        />
      </label>
      <p className="save-status" role="status">
        {status}
      </p>
    </section>
  )
}
