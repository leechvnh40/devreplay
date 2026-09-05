import { useState } from 'react'
import { zhCN } from './i18n/zh-CN'

export function DataManagementPanel(): React.JSX.Element {
  const [plan, setPlan] = useState<{
    confirmation: string
    deletes: string[]
    preserves: string[]
  }>()
  const [confirmation, setConfirmation] = useState('')
  const [status, setStatus] = useState('')

  const download = async (): Promise<void> => {
    const result = await window.devReplay.data.export()
    if (!result.ok) return setStatus(result.error.message)
    const url = URL.createObjectURL(new Blob([result.data.content], { type: 'application/json' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'devreplay-export-v1.json'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="settings-form warning-box">
      <h2>{zhCN.data.title}</h2>
      <button className="secondary-button" onClick={() => void download()}>
        {zhCN.data.export}
      </button>
      <label>
        {zhCN.data.import}
        <input
          type="file"
          accept="application/json,.json"
          onChange={async (event) => {
            const file = event.target.files?.[0]
            if (!file) return
            const result = await window.devReplay.data.import({ content: await file.text() })
            setStatus(result.ok ? zhCN.data.importSuccess : result.error.message)
          }}
        />
      </label>
      {!plan ? (
        <button
          className="secondary-button"
          onClick={async () => {
            const result = await window.devReplay.data.clearPlan()
            if (result.ok) setPlan(result.data)
            else setStatus(result.error.message)
          }}
        >
          {zhCN.data.clear}
        </button>
      ) : (
        <div className="settings-form">
          <strong>{zhCN.data.deleteHeading}</strong>
          <ul>
            {plan.deletes.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <strong>{zhCN.data.preserveHeading}</strong>
          <ul>
            {plan.preserves.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <label>
            {zhCN.data.typeConfirmation}
            <input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
          </label>
          <button
            disabled={confirmation !== plan.confirmation}
            onClick={async () => {
              const result = await window.devReplay.data.clearAll({ confirmation })
              if (result.ok) {
                setStatus(zhCN.data.cleared)
                setPlan(undefined)
                setConfirmation('')
              } else setStatus(result.error.message)
            }}
          >
            {zhCN.data.confirmClear}
          </button>
          <button
            className="secondary-button"
            onClick={() => {
              setPlan(undefined)
              setConfirmation('')
            }}
          >
            {zhCN.data.cancelClear}
          </button>
        </div>
      )}
      {status && <p role="status">{status}</p>}
    </section>
  )
}
