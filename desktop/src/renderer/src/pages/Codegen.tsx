import { useState } from 'react'
import { Code2, Wand2 } from 'lucide-react'
import { useApp } from '../store'
import { PageHeader, Segmented, Spinner, CodeBlock, EmptyState } from '../components/ui'

const LANG: Record<string, string> = {
  'react-tailwind': 'tsx',
  'react-inline': 'tsx',
  vue: 'vue',
  svelte: 'svelte',
  angular: 'ts',
  html: 'html',
  flutter: 'dart',
  swiftui: 'swift'
}

export function Codegen() {
  const { frameworks } = useApp()
  const [url, setUrl] = useState('')
  const [framework, setFramework] = useState('react-tailwind')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [code, setCode] = useState('')

  async function run() {
    if (!url.trim()) return
    setBusy(true)
    setError('')
    try {
      const res = await window.api.generateCode({ url: url.trim() }, framework)
      setCode(res.code)
    } catch (e: any) {
      setError(e?.message || 'Code generation failed.')
      setCode('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeader title="Code Gen" desc="Turn any frame or component into a starting point — 8 framework targets." />

      <div className="card mb-5 p-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              className="field flex-1"
              placeholder="https://figma.com/design/ABC123/My-File?node-id=12-822  (a node id is required)"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && run()}
            />
            <button className="btn-primary" onClick={run} disabled={busy || !url.trim()}>
              {busy ? <Spinner /> : <Wand2 size={16} />} Generate
            </button>
          </div>
          <Segmented options={frameworks} value={framework} onChange={setFramework} />
        </div>
        {error && <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">{error}</div>}
      </div>

      {!code ? (
        <EmptyState icon={<Code2 size={32} />} title="No code generated yet" hint="Paste a URL with a node-id, pick a framework, and get layout-faithful scaffold code you can drop into your project." />
      ) : (
        <CodeBlock code={code} lang={LANG[framework] || framework} />
      )}
    </div>
  )
}
