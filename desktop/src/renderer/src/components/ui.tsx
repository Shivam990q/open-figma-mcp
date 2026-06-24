import { useState, type ReactNode } from 'react'
import { Check, Copy, Loader2 } from 'lucide-react'

export function Logo({ size = 28 }: { size?: number }) {
  // Restrained mark: a single rounded square with the F, accent only.
  return (
    <div
      className="grid place-items-center rounded-[10px] bg-accent font-bold text-white"
      style={{ width: size, height: size, fontSize: size * 0.5 }}
    >
      F
    </div>
  )
}

export function Spinner({ className = '' }: { className?: string }) {
  return <Loader2 className={`animate-spin ${className}`} size={15} />
}

export function CopyButton({ text, label = 'Copy', className = '' }: { text: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      className={`btn-secondary px-2.5 py-1.5 text-xs ${className}`}
      onClick={async () => {
        await window.api.copy(text)
        setDone(true)
        setTimeout(() => setDone(false), 1200)
      }}
    >
      {done ? <Check size={13} className="text-ok" /> : <Copy size={13} />}
      {done ? 'Copied' : label}
    </button>
  )
}

export function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-3.5 py-2">
        <span className="text-xs font-medium text-faint">{lang || 'output'}</span>
        <CopyButton text={code} />
      </div>
      <pre className="selectable max-h-[52vh] overflow-auto p-4 text-[12.5px] leading-relaxed font-mono text-muted">
        <code>{code}</code>
      </pre>
    </div>
  )
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = 'md'
}: {
  options: readonly T[]
  value: T
  onChange: (v: T) => void
  size?: 'sm' | 'md'
}) {
  const pad = size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-[13px]'
  return (
    <div className="no-drag inline-flex flex-wrap gap-0.5 rounded-lg border border-border bg-bg p-0.5">
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          className={`rounded-md font-medium transition-colors ${pad} ${
            value === o ? 'bg-elevated text-ink shadow-soft' : 'text-faint hover:text-muted'
          }`}
        >
          {o}
        </button>
      ))}
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
    <div className="card p-4">
      <div className="text-xs font-medium text-faint">{label}</div>
      <div className={`mt-1.5 text-2xl font-semibold tracking-tight ${accent ? 'text-accent' : 'text-ink'}`}>
        {value}
      </div>
      {sub && <div className="mt-0.5 text-xs text-faint">{sub}</div>}
    </div>
  )
}

export function EmptyState({ icon, title, hint }: { icon: ReactNode; title: string; hint: string }) {
  return (
    <div className="grid place-items-center rounded-2xl border border-dashed border-border py-16 text-center">
      <div className="mb-3 text-faint">{icon}</div>
      <div className="text-sm font-medium text-muted">{title}</div>
      <div className="mt-1 max-w-sm text-sm text-faint">{hint}</div>
    </div>
  )
}

export function PageHeader({ title, desc, action }: { title: string; desc?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-ink">{title}</h1>
        {desc && <p className="mt-1 text-sm text-muted">{desc}</p>}
      </div>
      {action}
    </div>
  )
}

export function Field({
  label,
  hint,
  children
}: {
  label?: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div>
      {label && <label className="label">{label}</label>}
      {children}
      {hint && <p className="mt-1.5 text-xs text-faint">{hint}</p>}
    </div>
  )
}
