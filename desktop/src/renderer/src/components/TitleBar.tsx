import { Minus, Square, X } from 'lucide-react'
import { useApp } from '../store'

export function TitleBar() {
  const { connected, handle } = useApp()
  return (
    <div className="app-drag flex h-11 items-center justify-between border-b border-border bg-bg px-3">
      <div className="pl-16 text-xs font-medium text-faint">OpenFigma MCP</div>

      <div className="flex items-center gap-3">
        {connected && <span className="hidden text-xs text-faint sm:block no-drag">@{handle}</span>}
        <div className="flex items-center gap-0.5">
          <button className="btn-icon" onClick={() => window.api.minimize()} title="Minimize">
            <Minus size={14} />
          </button>
          <button className="btn-icon" onClick={() => window.api.maximize()} title="Maximize">
            <Square size={12} />
          </button>
          <button className="btn-icon hover:!bg-danger hover:!text-white" onClick={() => window.api.close()} title="Close">
            <X size={15} />
          </button>
        </div>
      </div>
    </div>
  )
}
