import { useState } from 'react'
import { Save, LogOut, Check } from 'lucide-react'
import { useApp } from '../store'
import { PageHeader, Segmented } from '../components/ui'

export function SettingsPage() {
  const { settings, setSettings, setConnected, handle } = useApp()
  const [draft, setDraft] = useState(settings)
  const [saved, setSaved] = useState(false)

  async function save() {
    const next = await window.api.saveSettings(draft)
    setSettings(next)
    setSaved(true)
    setTimeout(() => setSaved(false), 1400)
  }

  async function disconnect() {
    await window.api.clearToken()
    setConnected(false, '')
  }

  return (
    <div className="max-w-2xl">
      <PageHeader title="Settings" desc="Defaults for the server and design operations." />

      <div className="card space-y-5 p-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Default host</label>
            <input className="field" value={draft.host} onChange={(e) => setDraft({ ...draft, host: e.target.value })} />
          </div>
          <div>
            <label className="label">Default port</label>
            <input
              className="field"
              value={String(draft.port)}
              onChange={(e) => setDraft({ ...draft, port: Number(e.target.value) || 3845 })}
            />
          </div>
        </div>

        <div>
          <label className="label">Default output format</label>
          <Segmented
            options={['yaml', 'json', 'tree']}
            value={draft.format}
            onChange={(format) => setDraft({ ...draft, format })}
          />
        </div>

        <div>
          <label className="label">Image download directory (optional)</label>
          <input
            className="field"
            placeholder="autodetected (public/, src/assets, …)"
            value={draft.imageDir}
            onChange={(e) => setDraft({ ...draft, imageDir: e.target.value })}
          />
        </div>

        <label className="flex cursor-pointer items-center justify-between rounded-xl border border-line bg-black/20 px-4 py-3">
          <span className="text-sm text-zinc-300">Skip image-download tools</span>
          <input
            type="checkbox"
            className="no-drag h-4 w-4 accent-brand-500"
            checked={draft.skipImageDownloads}
            onChange={(e) => setDraft({ ...draft, skipImageDownloads: e.target.checked })}
          />
        </label>

        <div className="flex items-center gap-3 pt-1">
          <button className="btn-primary" onClick={save}>
            {saved ? <Check size={16} /> : <Save size={16} />} {saved ? 'Saved' : 'Save settings'}
          </button>
        </div>
      </div>

      <div className="card mt-5 flex items-center justify-between p-6">
        <div>
          <div className="font-semibold text-white">Figma account</div>
          <div className="text-sm text-zinc-500">Connected as @{handle}</div>
        </div>
        <button className="btn-ghost !text-red-300 hover:!bg-red-500/10" onClick={disconnect}>
          <LogOut size={16} /> Disconnect
        </button>
      </div>
    </div>
  )
}
