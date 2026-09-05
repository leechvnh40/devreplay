import { useMemo, useRef, useState } from 'react'
import { zhCN } from './i18n/zh-CN'

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
        setError(reason instanceof Error ? reason.message : zhCN.preview.sendFailed)
      }
    } finally {
      setSending(false)
      controller.current = undefined
    }
  }

  return (
    <section className="preview-dialog" role="dialog" aria-labelledby="context-preview-title">
      <div className="section-heading">
        <p className="eyebrow">{zhCN.preview.eyebrow}</p>
        <h2 id="context-preview-title">{zhCN.preview.title}</h2>
        <p>{zhCN.preview.description}</p>
      </div>
      <p className="preview-total">
        {zhCN.preview.approximate} {totals.characters} {zhCN.preview.characters} / {totals.tokens}{' '}
        tokens
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
                {item.label} {item.required ? zhCN.preview.required : zhCN.preview.optional}
              </label>
              <small>
                {item.estimatedChars} {zhCN.preview.characters}
              </small>
            </summary>
            <pre>{item.content}</pre>
          </details>
        ))}
      </div>
      {error && <p className="notice error">{error}</p>}
      <div className="dialog-actions">
        <button className="secondary-button" onClick={cancel}>
          {sending ? zhCN.preview.cancelRequest : zhCN.common.cancel}
        </button>
        <button disabled={sending} onClick={() => void confirm()}>
          {sending ? zhCN.preview.sending : zhCN.preview.confirm}
        </button>
      </div>
    </section>
  )
}
