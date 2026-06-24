import { useState } from 'react'
import { ArrowRight, ExternalLink, KeyRound, ShieldCheck } from 'lucide-react'
import { useApp } from '../store'
import { Logo, Spinner } from '../components/ui'

export function Onboarding() {
  const { setConnected } = useApp()
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function connect() {
    if (!token.trim()) return
    setBusy(true)
    setError('')
    try {
      const res = await window.api.saveToken(token.trim())
      setConnected(true, res.handle)
    } catch (e: any) {
      setError(e?.message || 'Could not validate token. Check it and try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid flex-1 place-items-center px-6">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="mb-7 flex flex-col items-center text-center">
          <Logo size={48} />
          <h1 className="mt-5 text-lg font-semibold tracking-tight text-ink">Connect your Figma account</h1>
          <p className="mt-1.5 text-sm text-muted">
            Paste a free Personal Access Token. No paid Dev Mode seat required.
          </p>
        </div>

        <label className="label">Personal Access Token</label>
        <div className="relative">
          <KeyRound size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <input
            type="password"
            className="field pl-9"
            placeholder="figd_xxxxxxxxxxxxxxxx"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && connect()}
            autoFocus
          />
        </div>

        {error && (
          <div className="mt-3 rounded-lg border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-sm text-danger">
            {error}
          </div>
        )}

        <button className="btn-primary mt-4 w-full" onClick={connect} disabled={busy || !token.trim()}>
          {busy ? <Spinner /> : <ArrowRight size={15} />}
          {busy ? 'Validating…' : 'Connect'}
        </button>

        <button
          className="mt-3.5 flex w-full items-center justify-center gap-1.5 text-xs font-medium text-muted hover:text-ink"
          onClick={() => window.api.openExternal('https://www.figma.com/developers/api#access-tokens')}
        >
          How to generate a token <ExternalLink size={12} />
        </button>

        <div className="mt-6 flex items-start gap-2 rounded-lg border border-border bg-surface px-3.5 py-3 text-xs text-faint">
          <ShieldCheck size={14} className="mt-0.5 shrink-0 text-ok" />
          Stored locally on this machine. Sent only to Figma's API — never anywhere else.
        </div>
      </div>
    </div>
  )
}
