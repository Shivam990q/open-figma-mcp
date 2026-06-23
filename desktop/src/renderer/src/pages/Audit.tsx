import { useState } from 'react'
import { ShieldCheck, Play } from 'lucide-react'
import { PageHeader, Spinner, StatCard, EmptyState } from '../components/ui'

interface ContrastFinding {
  nodeId: string
  name: string
  text?: string
  ratio: number
  required: number
  level: 'AA' | 'AAA' | 'fail'
  textColor: string
  bgColor: string
}

export function Audit() {
  const [url, setUrl] = useState('')
  const [bg, setBg] = useState('#ffffff')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [report, setReport] = useState<any>(null)

  async function run() {
    if (!url.trim()) return
    setBusy(true)
    setError('')
    try {
      setReport(await window.api.audit({ url: url.trim() }, bg))
    } catch (e: any) {
      setError(e?.message || 'Audit failed.')
      setReport(null)
    } finally {
      setBusy(false)
    }
  }

  const s = report?.summary
  const failures: ContrastFinding[] = report?.contrastFailures || []

  return (
    <div>
      <PageHeader title="Accessibility" desc="WCAG contrast & tap-target audit — catch issues before you write code." />

      <div className="card mb-5 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            className="field flex-1"
            placeholder="https://figma.com/design/ABC123/My-File?node-id=12-822"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && run()}
          />
          <div className="no-drag flex items-center gap-2 rounded-xl border border-line bg-black/30 px-3 py-2">
            <span className="text-xs text-zinc-500">Page bg</span>
            <input type="color" value={bg} onChange={(e) => setBg(e.target.value)} className="h-7 w-9 cursor-pointer rounded bg-transparent" />
          </div>
          <button className="btn-primary" onClick={run} disabled={busy || !url.trim()}>
            {busy ? <Spinner /> : <Play size={16} />} Audit
          </button>
        </div>
        {error && <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">{error}</div>}
      </div>

      {!report ? (
        <EmptyState icon={<ShieldCheck size={32} />} title="No audit yet" hint="Run a WCAG audit to see contrast pass/fail for every text layer and flag tap targets under 24px." />
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard label="AA pass rate" value={`${s.aaPassRate}%`} accent />
            <StatCard label="Text checked" value={s.textLayersChecked} />
            <StatCard label="Contrast fails" value={s.contrastFailures} sub={`${s.passAAA} pass AAA`} />
            <StatCard label="Small targets" value={s.undersizedTargets} sub="< 24px" />
          </div>

          {failures.length > 0 && (
            <div className="card overflow-hidden">
              <div className="border-b border-line px-4 py-2.5 text-sm font-semibold text-zinc-300">Contrast failures</div>
              <div className="max-h-[45vh] divide-y divide-line overflow-auto">
                {failures.map((f) => (
                  <div key={f.nodeId} className="flex items-center gap-4 px-4 py-3">
                    <div
                      className="grid h-10 w-16 shrink-0 place-items-center rounded-lg border border-line text-xs font-semibold"
                      style={{ background: f.bgColor, color: f.textColor }}
                    >
                      Aa
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-zinc-200">{f.name}</div>
                      {f.text && <div className="truncate text-xs text-zinc-500">"{f.text}"</div>}
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-sm font-semibold text-red-300">{f.ratio}:1</div>
                      <div className="text-[11px] text-zinc-500">needs {f.required}:1</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
