import { useState } from 'react'
import { ImageDown, Download, FolderOpen, FileImage } from 'lucide-react'
import { useApp } from '../store'
import { PageHeader, Segmented, Spinner, EmptyState } from '../components/ui'

export function Assets() {
  const { settings } = useApp()
  const [url, setUrl] = useState('')
  const [nodes, setNodes] = useState('')
  const [format, setFormat] = useState<'png' | 'svg'>('png')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [out, setOut] = useState<{ dir: string; results: any[] } | null>(null)

  async function run() {
    if (!url.trim()) return
    setBusy(true)
    setError('')
    try {
      const nodeIds = nodes
        .split(',')
        .map((n) => n.trim())
        .filter(Boolean)
      const res = await window.api.downloadImages(
        { url: url.trim(), nodeIds: nodeIds.length ? nodeIds : undefined },
        format,
        settings.imageDir || undefined
      )
      setOut(res)
    } catch (e: any) {
      setError(e?.message || 'Export failed.')
      setOut(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeader title="Assets" desc="Render and export frames, icons & images at source quality." />

      <div className="card mb-5 p-4">
        <div className="flex flex-col gap-3">
          <input
            className="field"
            placeholder="https://figma.com/design/ABC123/My-File?node-id=12-822"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              className="field flex-1"
              placeholder="Extra node ids, comma-separated (optional)"
              value={nodes}
              onChange={(e) => setNodes(e.target.value)}
            />
            <Segmented options={['png', 'svg']} value={format} onChange={setFormat} />
            <button className="btn-primary" onClick={run} disabled={busy || !url.trim()}>
              {busy ? <Spinner /> : <Download size={16} />} Export
            </button>
          </div>
        </div>
        {error && <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">{error}</div>}
      </div>

      {!out ? (
        <EmptyState icon={<ImageDown size={32} />} title="No assets exported yet" hint="Export images and SVGs; they're saved to a figma-export folder you can open with one click." />
      ) : (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <span className="text-sm font-semibold text-zinc-300">{out.results.length} file(s) exported</span>
            <button className="btn-ghost px-3 py-1.5 text-xs" onClick={() => window.api.showFolder(out.dir)}>
              <FolderOpen size={14} /> Open folder
            </button>
          </div>
          <div className="divide-y divide-line">
            {out.results.map((r) => (
              <div key={r.nodeId} className="flex items-center gap-3 px-4 py-3">
                <FileImage size={18} className="text-brand-400" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-zinc-200">{r.fileName}</div>
                  <div className="truncate font-mono text-xs text-zinc-500">{r.localUrl}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
