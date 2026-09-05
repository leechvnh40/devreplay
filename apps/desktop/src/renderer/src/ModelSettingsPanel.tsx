import { useEffect, useState, type FormEvent } from 'react'
import { zhCN } from './i18n/zh-CN'
import type { ModelSettings } from '@devreplay/shared'
import { DataManagementPanel } from './DataManagementPanel'

export function ModelSettingsPanel({ onClose }: { onClose(): void }): React.JSX.Element {
  const [settings, setSettings] = useState<ModelSettings>()
  const [modelId, setModelId] = useState('deepseek-chat')
  const [apiKey, setApiKey] = useState('')
  const [status, setStatus] = useState(zhCN.settings.loading)
  const [demoLoaded, setDemoLoaded] = useState(false)

  useEffect(() => {
    void window.devReplay.model.getSettings().then((result) => {
      if (result.ok) {
        setSettings(result.data)
        setModelId(result.data.modelId)
        setStatus('')
      } else {
        setStatus(result.error.message)
      }
    })
    void window.devReplay.demo.getStatus().then((result) => {
      if (result.ok) setDemoLoaded(result.data.loaded)
    })
  }, [])

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    setStatus(zhCN.settings.saving)
    const result = await window.devReplay.model.saveSettings({ modelId, apiKey })
    if (result.ok) {
      setSettings(result.data)
      setApiKey('')
      setStatus(zhCN.settings.saved)
    } else {
      setStatus(result.error.message)
    }
  }

  return (
    <section className="form-card">
      <button className="text-button" onClick={onClose}>
        {zhCN.settings.back}
      </button>
      <div className="section-heading">
        <p className="eyebrow">{zhCN.settings.eyebrow}</p>
        <h1>{zhCN.settings.title}</h1>
        <p>{zhCN.settings.description}</p>
      </div>
      {settings && <p className="notice">{settings.cloudNotice}</p>}
      <form className="settings-form" onSubmit={submit}>
        <label>
          {zhCN.settings.modelId}
          <input value={modelId} onChange={(event) => setModelId(event.target.value)} />
        </label>
        <label>
          API Key
          <input
            type="password"
            autoComplete="off"
            value={apiKey}
            placeholder={
              settings?.keyConfigured
                ? zhCN.settings.keySetPlaceholder
                : zhCN.settings.keyPlaceholder
            }
            onChange={(event) => setApiKey(event.target.value)}
          />
        </label>
        <p className="save-status" role="status">
          {settings?.keyConfigured ? zhCN.settings.keySet : zhCN.settings.keyMissing}
          {status ? ` · ${status}` : ''}
        </p>
        <button
          type="submit"
          disabled={!modelId.trim() || (!settings?.keyConfigured && !apiKey.trim())}
        >
          {zhCN.settings.save}
        </button>
      </form>
      <section className="settings-form warning-box">
        <h2>{zhCN.settings.demoTitle}</h2>
        <p>{zhCN.settings.demoDescription}</p>
        <button
          className="secondary-button"
          onClick={async () => {
            const result = await window.devReplay.demo.load()
            if (result.ok) {
              setDemoLoaded(true)
              setStatus(zhCN.settings.demoLoaded)
            } else setStatus(result.error.message)
          }}
        >
          {zhCN.settings.loadDemo}
        </button>
        {demoLoaded && (
          <button
            className="secondary-button"
            onClick={async () => {
              const result = await window.devReplay.demo.clear()
              if (result.ok) {
                setDemoLoaded(false)
                setStatus(zhCN.settings.demoCleared)
              } else setStatus(result.error.message)
            }}
          >
            {zhCN.settings.clearDemo}
          </button>
        )}
      </section>
      <DataManagementPanel />
    </section>
  )
}
