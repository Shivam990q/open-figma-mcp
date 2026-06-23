import { useState } from 'react'
import { motion } from 'framer-motion'
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
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass w-full max-w-md p-8"
      >
        <div className="mb-6 flex flex-col items-center text-center">
          <Logo size={56} />
          <h1 className="mt-5 text-2xl font-extrabold tracking-tight text-white">Connect Figma</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Paste a free Personal Access Token. No paid Dev Mode seat required — everything runs locally.
          </p>
        </div>

        <label className="label">Personal Access Token</label>
        <div className="relative">
          <KeyRound size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="password"
            className="field pl-10"
            placeholder="figd_xxxxxxxxxxxxxxxx"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && connect()}
            autoFocus
          />
        </div>

        {error && (
          <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">
            {error}
          </div>
        )}

        <button className="btn-primary mt-5 w-full" onClick={connect} disabled={busy || !token.trim()}>
          {busy ? <Spinner /> : <ArrowRight size={16} />}
          {busy ? 'Validating…' : 'Connect'}
        </button>

        <button
          className="mt-4 flex w-full items-center justify-center gap-1.5 text-xs font-medium text-brand-400 hover:text-brand-50"
          onClick={() => window.api.openExternal('https://www.figma.com/developers/api#access-tokens')}
        >
          Generate a token in Figma settings <ExternalLink size={13} />
        </button>

        <div className="mt-6 flex items-start gap-2 rounded-xl border border-line bg-black/20 px-4 py-3 text-xs text-zinc-500">
          <ShieldCheck size={15} className="mt-0.5 shrink-0 text-emerald-400" />
          Your token is stored locally on this machine and is never sent anywhere except Figma's API.
        </div>
      </motion.div>
    </div>
  )
}
