import { useEffect, useState, type FormEvent } from 'react'
import type { ModelSettings } from '@devreplay/shared'

export function ModelSettingsPanel({ onClose }: { onClose(): void }): React.JSX.Element {
  const [settings, setSettings] = useState<ModelSettings>()
  const [modelId, setModelId] = useState('deepseek-chat')
  const [apiKey, setApiKey] = useState('')
  const [status, setStatus] = useState('正在读取配置…')

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
  }, [])

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    setStatus('正在保存…')
    const result = await window.devReplay.model.saveSettings({ modelId, apiKey })
    if (result.ok) {
      setSettings(result.data)
      setApiKey('')
      setStatus('配置已安全保存在本机')
    } else {
      setStatus(result.error.message)
    }
  }

  return (
    <section className="form-card">
      <button className="text-button" onClick={onClose}>
        ← 返回面试
      </button>
      <div className="section-heading">
        <p className="eyebrow">设置 / DEEPSEEK</p>
        <h1>云模型配置</h1>
        <p>DevReplay 只接入 DeepSeek。API Key 由 Windows 安全凭据能力保护，不写入业务数据库。</p>
      </div>
      {settings && <p className="notice">{settings.cloudNotice}</p>}
      <form className="settings-form" onSubmit={submit}>
        <label>
          模型 ID
          <input value={modelId} onChange={(event) => setModelId(event.target.value)} />
        </label>
        <label>
          API Key
          <input
            type="password"
            autoComplete="off"
            value={apiKey}
            placeholder={
              settings?.keyConfigured ? '已配置；留空表示不修改' : '请输入 DeepSeek API Key'
            }
            onChange={(event) => setApiKey(event.target.value)}
          />
        </label>
        <p className="save-status" role="status">
          {settings?.keyConfigured ? '密钥状态：已配置（不会回显）' : '密钥状态：未配置'}
          {status ? ` · ${status}` : ''}
        </p>
        <button
          type="submit"
          disabled={!modelId.trim() || (!settings?.keyConfigured && !apiKey.trim())}
        >
          保存 DeepSeek 配置
        </button>
      </form>
    </section>
  )
}
