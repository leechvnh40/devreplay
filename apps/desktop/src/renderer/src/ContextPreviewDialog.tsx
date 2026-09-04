import { useMemo, useRef, useState } from 'react'

export interface ContextPreviewItem {
  readonly id: string
  readonly label: string
  readonly content: string
  readonly required: boolean
  readonly included: boolean
  readonly estimatedChars: number
  readonly estimatedTokens: number
}

export function ContextPreviewDialog({
  items,
  onConfirm,
  onCancel
}: {
  items: readonly ContextPreviewItem[]
  onConfirm(includedItemIds: readonly string[], signal: AbortSignal): Promise<void>
  onCancel(): void
}): React.JSX.Element {
  const [selection, setSelection] = useState(() =>
    Object.fromEntries(items.map((item) => [item.id, item.required || item.included]))
  )
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const controller = useRef<AbortController | undefined>(undefined)
  const includedItems = useMemo(
    () => items.filter((item) => selection[item.id]),
    [items, selection]
  )
  const totals = includedItems.reduce(
    (result, item) => ({
      characters: result.characters + item.estimatedChars,
      tokens: result.tokens + item.estimatedTokens
    }),
    { characters: 0, tokens: 0 }
  )

  const cancel = (): void => {
    controller.current?.abort()
    onCancel()
  }

  const confirm = async (): Promise<void> => {
    const nextController = new AbortController()
    controller.current = nextController
    setSending(true)
    setError('')
    try {
      await onConfirm(
        includedItems.map((item) => item.id),
        nextController.signal
      )
    } catch (reason) {
      if (!nextController.signal.aborted) {
        setError(reason instanceof Error ? reason.message : '发送失败')
      }
    } finally {
      setSending(false)
      controller.current = undefined
    }
  }

  return (
    <section className="preview-dialog" role="dialog" aria-labelledby="context-preview-title">
      <div className="section-heading">
        <p className="eyebrow">发送前确认</p>
        <h2 id="context-preview-title">将发送到 DeepSeek 的内容</h2>
        <p>仅本次勾选内容会离开本机。展开每项可检查原文。</p>
      </div>
      <p className="preview-total">
        约 {totals.characters} 字符 / {totals.tokens} tokens
      </p>
      <div className="preview-items">
        {items.map((item) => (
          <details key={item.id} className="preview-item">
            <summary>
              <label className="check-row" onClick={(event) => event.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={Boolean(selection[item.id])}
                  disabled={item.required || sending}
                  onChange={(event) =>
                    setSelection((current) => ({
                      ...current,
                      [item.id]: event.target.checked
                    }))
                  }
                />
                {item.label} {item.required ? '（必需）' : '（可选）'}
              </label>
              <small>{item.estimatedChars} 字符</small>
            </summary>
            <pre>{item.content}</pre>
          </details>
        ))}
      </div>
      {error && <p className="notice error">{error}</p>}
      <div className="dialog-actions">
        <button className="secondary-button" onClick={cancel}>
          {sending ? '取消请求' : '取消'}
        </button>
        <button disabled={sending} onClick={() => void confirm()}>
          {sending ? '正在发送…' : '确认并发送'}
        </button>
      </div>
    </section>
  )
}
