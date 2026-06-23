import { motion } from 'framer-motion'
import { LayoutDashboard, Radio, Compass, Palette, Code2, Settings, Github, BookOpen } from 'lucide-react'
import { useApp, type Route } from '../store'
import { Logo } from './ui'

const NAV: { id: Route; label: string; icon: typeof Radio }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'server', label: 'MCP Server', icon: Radio },
  { id: 'explore', label: 'Explore', icon: Compass },
  { id: 'tokens', label: 'Design Tokens', icon: Palette },
  { id: 'codegen', label: 'Code Gen', icon: Code2 },
  { id: 'settings', label: 'Settings', icon: Settings }
]

export function Sidebar() {
  const { route, setRoute } = useApp()
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-line bg-bg-soft/50 p-3">
      <div className="flex items-center gap-3 px-2 py-3">
        <Logo size={32} />
        <div>
          <div className="text-sm font-extrabold leading-tight text-white">OpenFigma</div>
          <div className="text-[11px] font-medium text-zinc-500">MCP Studio</div>
        </div>
      </div>

      <nav className="mt-4 flex flex-col gap-1">
        {NAV.map(({ id, label, icon: Icon }) => {
          const active = route === id
          return (
            <button
              key={id}
              onClick={() => setRoute(id)}
              className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                active ? 'text-white' : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'
              }`}
            >
              {active && (
                <motion.span
                  layoutId="nav-active"
                  className="absolute inset-0 rounded-xl border border-brand-500/30 bg-brand-500/10"
                  transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                />
              )}
              <Icon size={18} className={`relative ${active ? 'text-brand-400' : ''}`} />
              <span className="relative">{label}</span>
            </button>
          )
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-1 border-t border-line pt-3">
        <button
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
          onClick={() => window.api.openExternal('https://github.com/Shivam990q/open-figma-mcp#readme')}
        >
          <BookOpen size={18} /> Docs
        </button>
        <button
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
          onClick={() => window.api.openExternal('https://github.com/Shivam990q/open-figma-mcp')}
        >
          <Github size={18} /> Star on GitHub
        </button>
      </div>
    </aside>
  )
}
