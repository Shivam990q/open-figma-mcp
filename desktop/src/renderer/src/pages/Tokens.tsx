import { useState } from 'react'
import { Palette, Sparkles } from 'lucide-react'
import { useApp } from '../store'
import { PageHeader, Segmented, Spinner, CodeBlock, EmptyState } from '../components/ui'

export function TokensPage({ embedded }: { embedded?: boolean } = {}) {
  const { tokenFormats } = useApp()
  const [url, setUrl] = useState('')
  const [format, setFormat] = useState<string>('css')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [text, setText] = useState('')
  const [colors, setColors] = useState<{ name: string; value: string }[]>([])

  async function run() {
    if (!url.trim()) return
    setBusy(true)
    setError('')
    try {
      const res = await window.api.getTokens({ url: url.trim() }, format)
      setText(res.text)
      setColors((res.tokens?.colors || []).slice(0, 24))
    } catch (e: any) {
      setError(e?.message || 'Token extraction failed.')
      setText('')
      setColors([])
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      {!embedded && <PageHeader title="Design Tokens" desc="Extract colors, type, spacing, radii & shadows — export to any format." />}

      <div className="card mb-5 p-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              className="field flex-1"
              placeholder="https://figma.com/design/ABC123/My-File"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && run()}
            />
            <button className="btn-primary" onClick={run} disabled={busy || !url.trim()}>
              {busy ? <Spinner /> : <Sparkles size={16} />} Extract
            </button>
          </div>
          <Segmented options={tokenFormats} value={format} onChange={setFormat} />
        </div>
        {error && <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">{error}</div>}
      </div>

      {!text ? (
        <EmptyState icon={<Palette size={32} />} title="No tokens yet" hint="Extract a design's token system and switch formats instantly — CSS, Tailwind v4, W3C, style-dictionary and more." />
      ) : (
        <div className="space-y-5">
          {colors.length > 0 && (
            <div className="card p-5">
              <div className="label">Color palette</div>
              <div className="flex flex-wrap gap-3">
                {colors.map((c) => (
                  <div key={c.name + c.value} className="flex flex-col items-center gap-1.5">
                    <div className="h-12 w-12 rounded-xl border border-border shadow-soft" style={{ background: c.value }} />
                    <span className="font-mono text-[10px] text-faint">{c.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <CodeBlock code={text} lang={format} />
        </div>
      )}
    </div>
  )
}
