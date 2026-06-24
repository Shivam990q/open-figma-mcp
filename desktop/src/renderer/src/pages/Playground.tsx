import { useState } from 'react'
import { Compass, Palette, Code2, ShieldCheck, ImageDown } from 'lucide-react'
import { Explore } from './Explore'
import { TokensPage } from './Tokens'
import { Codegen } from './Codegen'
import { Audit } from './Audit'
import { Assets } from './Assets'

type Tool = 'Explore' | 'Tokens' | 'Code' | 'Accessibility' | 'Assets'

const TOOLS: { id: Tool; icon: typeof Compass; desc: string }[] = [
  { id: 'Explore', icon: Compass, desc: 'Simplified design data + token savings' },
  { id: 'Tokens', icon: Palette, desc: 'Extract & export design tokens' },
  { id: 'Code', icon: Code2, desc: 'Generate component code (8 frameworks)' },
  { id: 'Accessibility', icon: ShieldCheck, desc: 'WCAG contrast & target audit' },
  { id: 'Assets', icon: ImageDown, desc: 'Export images & SVGs' }
]

export function Playground() {
  const [tool, setTool] = useState<Tool>('Explore')
  const active = TOOLS.find((t) => t.id === tool)!

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5">
        <h1 className="text-xl font-semibold tracking-tight text-ink">Playground</h1>
        <p className="mt-1 text-sm text-muted">Try the tools directly — no editor needed. {active.desc}.</p>
      </div>

      <div className="mb-6 flex flex-wrap gap-1 rounded-xl border border-border bg-bg p-1">
        {TOOLS.map(({ id, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTool(id)}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors ${
              tool === id ? 'bg-elevated text-ink shadow-soft' : 'text-faint hover:text-muted'
            }`}
          >
            <Icon size={15} className={tool === id ? 'text-accent' : ''} />
            {id}
          </button>
        ))}
      </div>

      <div className="animate-fade-in">
        {tool === 'Explore' && <Explore embedded />}
        {tool === 'Tokens' && <TokensPage embedded />}
        {tool === 'Code' && <Codegen embedded />}
        {tool === 'Accessibility' && <Audit embedded />}
        {tool === 'Assets' && <Assets embedded />}
      </div>
    </div>
  )
}
