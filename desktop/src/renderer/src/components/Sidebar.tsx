import { Home, FlaskConical, Settings, Github, BookOpen } from 'lucide-react'
import { useApp, type Route } from '../store'
import { Logo } from './ui'

const NAV: { id: Route; label: string; icon: typeof Home }[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'playground', label: 'Playground', icon: FlaskConical },
  { id: 'settings', label: 'Settings', icon: Settings }
]

export function Sidebar() {
  const { route, setRoute, server } = useApp()
  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-bg px-3 py-3">
      <div className="flex items-center gap-2.5 px-2 py-2">
        <Logo size={28} />
        <div className="text-sm font-semibold text-ink">OpenFigma</div>
      </div>

      <nav className="mt-5 flex flex-col gap-0.5">
        {NAV.map(({ id, label, icon: Icon }) => {
          const active = route === id
          return (
            <button
              key={id}
              onClick={() => setRoute(id)}
              className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors ${
                active ? 'bg-elevated text-ink' : 'text-muted hover:text-ink hover:bg-white/[0.03]'
              }`}
            >
              <Icon size={17} className={active ? 'text-accent' : 'text-faint'} />
              {label}
              {id === 'home' && server.running && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-ok" />
              )}
            </button>
          )
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-0.5 border-t border-border pt-2">
        <button
          className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-muted hover:text-ink hover:bg-white/[0.03]"
          onClick={() => window.api.openExternal('https://github.com/Shivam990q/open-figma-mcp#readme')}
        >
          <BookOpen size={17} className="text-faint" /> Docs
        </button>
        <button
          className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-muted hover:text-ink hover:bg-white/[0.03]"
          onClick={() => window.api.openExternal('https://github.com/Shivam990q/open-figma-mcp')}
        >
          <Github size={17} className="text-faint" /> GitHub
        </button>
      </div>
    </aside>
  )
}
