import { useState, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { Check, Copy, Loader2 } from 'lucide-react'

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <div
      className="grid place-items-center rounded-xl bg-brand-gradient shadow-glow font-extrabold text-white"
      style={{ width: size, height: size, fontSize: size * 0.5 }}
    >
      F
    </div>
  )
}

export function Spinner({ className = '' }: { className?: string }) {
  return <Loader2 className={`animate-spin ${className}`} size={16} />
}

export function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      className="btn-ghost px-3 py-1.5 text-xs"
      onClick={async () => {
        await window.api.copy(text)
        setDone(true)
        setTimeout(() => setDone(false), 1400)
      }}
    >
      {done ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
      {done ? 'Copied' : label}
    </button>
  )
}

export function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  return (
    <div className="relative card overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-4 py-2">
        <span className="chip">{lang || 'output'}</span>
        <CopyButton text={code} />
      </div>
      <pre className="selectable max-h-[55vh] overflow-auto p-4 text-[13px] leading-relaxed font-mono text-zinc-200">
        <code>{code}</code>
      </pre>
    </div>
  )
}

export function StatCard({
  label,
  value,
  sub,
  accent
}: {
  label: string
  value: ReactNode
  sub?: string
  accent?: boolean
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`card p-5 ${accent ? 'bg-brand-gradient !border-transparent text-white shadow-glow' : ''}`}
    >
      <div className={`text-xs font-semibold uppercase tracking-wider ${accent ? 'text-white/80' : 'text-zinc-500'}`}>
        {label}
      </div>
      <div className="mt-2 text-3xl font-extrabold tracking-tight">{value}</div>
      {sub && <div className={`mt-1 text-sm ${accent ? 'text-white/80' : 'text-zinc-500'}`}>{sub}</div>}
    </motion.div>
  )
}

export function Segmented<T extends string>({
  options,
  value,
  onChange
}: {
  options: T[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="no-drag inline-flex flex-wrap gap-1 rounded-xl border border-line bg-black/30 p-1">
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          className={`relative rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
            value === o ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          {value === o && (
            <motion.span layoutId="seg" className="absolute inset-0 rounded-lg bg-brand-gradient shadow-glow" />
          )}
          <span className="relative">{o}</span>
        </button>
      ))}
    </div>
  )
}

export function EmptyState({ icon, title, hint }: { icon: ReactNode; title: string; hint: string }) {
  return (
    <div className="grid place-items-center rounded-2xl border border-dashed border-line py-16 text-center">
      <div className="mb-3 text-brand-400">{icon}</div>
      <div className="text-sm font-semibold text-zinc-300">{title}</div>
      <div className="mt-1 max-w-sm text-sm text-zinc-500">{hint}</div>
    </div>
  )
}

export function PageHeader({ title, desc, action }: { title: string; desc: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-white">{title}</h1>
        <p className="mt-1 text-sm text-zinc-500">{desc}</p>
      </div>
      {action}
    </div>
  )
}
