import { motion } from 'framer-motion'
import { Radio, Compass, Palette, Code2, Zap, ShieldCheck, GitCompare } from 'lucide-react'
import { useApp } from '../store'
import { PageHeader, StatCard } from '../components/ui'

export function Dashboard() {
  const { handle, server, frameworks, tokenFormats, setRoute } = useApp()

  const quick = [
    { icon: Radio, title: 'Run MCP Server', desc: 'Start the local server for Cursor, Claude, or Lovable.', to: 'server' as const },
    { icon: Compass, title: 'Explore a design', desc: 'Paste a Figma URL and see simplified, token-cheap data.', to: 'explore' as const },
    { icon: Palette, title: 'Extract tokens', desc: 'Export colors, type & spacing to 8 formats.', to: 'tokens' as const },
    { icon: Code2, title: 'Generate code', desc: '8 framework targets from any node.', to: 'codegen' as const }
  ]

  return (
    <div>
      <PageHeader title={`Welcome back, @${handle}`} desc="Your free, local Figma-to-code workbench." />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Context savings" value="3–4×" sub="smaller than raw Figma JSON" accent />
        <StatCard label="Frameworks" value={frameworks.length} sub={frameworks.slice(0, 4).join(', ') + '…'} />
        <StatCard label="Token formats" value={tokenFormats.length} sub="CSS, Tailwind, W3C, …" />
      </div>

      <h2 className="mb-3 mt-8 text-sm font-bold uppercase tracking-wider text-zinc-500">Quick actions</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {quick.map((q, i) => (
          <motion.button
            key={q.title}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            onClick={() => setRoute(q.to)}
            className="card group flex items-center gap-4 p-5 text-left transition-all hover:border-brand-500/40 hover:shadow-glow"
          >
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-500/15 text-brand-400 transition-colors group-hover:bg-brand-gradient group-hover:text-white">
              <q.icon size={20} />
            </div>
            <div>
              <div className="font-semibold text-white">{q.title}</div>
              <div className="text-sm text-zinc-500">{q.desc}</div>
            </div>
          </motion.button>
        ))}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Feature icon={Zap} title="Rate-limit aware" text="Disk caching with stale fallback keeps you working through Figma's free-tier throttling." />
        <Feature icon={ShieldCheck} title="Prompt-injection safe" text="Untrusted design text is scanned and flagged, never executed as instructions." />
        <Feature icon={GitCompare} title="Diff & drift" text="Compare versions and catch design-vs-code color drift in your repo." />
      </div>

      <div className="mt-6 rounded-2xl border border-line bg-bg-card/40 px-5 py-4 text-sm text-zinc-400">
        Server status:{' '}
        {server.running ? (
          <span className="font-semibold text-emerald-400">running on {server.host}:{server.port}</span>
        ) : (
          <span className="font-semibold text-zinc-300">stopped</span>
        )}
      </div>
    </div>
  )
}

function Feature({ icon: Icon, title, text }: { icon: typeof Zap; title: string; text: string }) {
  return (
    <div className="card p-5">
      <Icon size={18} className="text-brand-400" />
      <div className="mt-3 font-semibold text-white">{title}</div>
      <div className="mt-1 text-sm text-zinc-500">{text}</div>
    </div>
  )
}
