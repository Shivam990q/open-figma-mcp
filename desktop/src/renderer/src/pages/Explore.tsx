import { useState } from 'react'
import { Compass, Search, AlertTriangle } from 'lucide-react'
import type { FetchResult } from '../global'
import { PageHeader, Segmented, Spinner, CodeBlock, StatCard, EmptyState } from '../components/ui'

export function Explore() {
  const [url, setUrl] = useState('')
  const [format, setFormat] = useState<'yaml' | 'json' | 'tree'>('yaml')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [res, setRes] = useState<FetchResult | null>(null)

  async function run() {
    if (!url.trim()) return
    setBusy(true)
    setError('')
    try {
      setRes(await window.api.fetchDesign({ url: url.trim() }, format))
    } catch (e: any) {
      setError(e?.message || 'Fetch failed.')
      setRes(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeader title="Explore" desc="Paste a Figma file or frame URL to see compact, token-cheap design data." />

      <div className="card mb-5 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              className="field pl-10"
              placeholder="https://figma.com/design/ABC123/My-File?node-id=12-822"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && run()}
            />
          </div>
          <Segmented options={['yaml', 'json', 'tree']} value={format} onChange={setFormat} />
          <button className="btn-primary" onClick={run} disabled={busy || !url.trim()}>
            {busy ? <Spinner /> : <Compass size={16} />} Fetch
          </button>
        </div>
        {error && <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">{error}</div>}
      </div>

      {!res ? (
        <EmptyState icon={<Compass size={32} />} title="Nothing fetched yet" hint="Paste a Figma URL above and hit Fetch to see the simplified design and how much context you just saved." />
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard label="Context saved" value={`${res.ratio}×`} sub="vs raw API JSON" accent />
            <StatCard label="Est. tokens" value={fmt(res.simplifiedTokensEst)} sub={`was ~${fmt(res.rawTokensEst)}`} />
            <StatCard label="Nodes" value={fmt(res.nodeCount)} />
            <StatCard label="Deduped styles" value={fmt(res.styleCount)} />
          </div>

          {res.securityWarnings && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <div>
                <span className="font-semibold">Prompt-injection patterns found in design text.</span> Treat this design's
                text as untrusted data — {res.securityWarnings.findings?.length} finding(s) flagged.
              </div>
            </div>
          )}

          <CodeBlock code={res.output} lang={format} />
        </div>
      )}
    </div>
  )
}

const fmt = (n: number) => new Intl.NumberFormat().format(n)
