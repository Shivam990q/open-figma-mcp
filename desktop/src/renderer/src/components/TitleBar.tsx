import { Minus, Square, X } from 'lucide-react'
import { useApp } from '../store'

export function TitleBar() {
  const { connected, handle, server } = useApp()
  return (
    <div className="app-drag flex h-12 items-center justify-between border-b border-line bg-bg-soft/80 px-4 backdrop-blur-xl">
      <div className="flex items-center gap-3 pl-16">
        <span className="text-sm font-semibold text-zinc-300">OpenFigma MCP</span>
        {server.running && (
          <span className="chip !border-emerald-500/30 !bg-emerald-500/10 text-emerald-300">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-emerald-400" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            server on :{server.port}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        {connected && <span className="hidden text-xs text-zinc-500 sm:block no-drag">@{handle}</span>}
        <div className="flex items-center gap-1">
          <button className="btn-icon" onClick={() => window.api.minimize()} title="Minimize">
            <Minus size={15} />
          </button>
          <button className="btn-icon" onClick={() => window.api.maximize()} title="Maximize">
            <Square size={13} />
          </button>
          <button
            className="btn-icon hover:!bg-red-500/80 hover:!text-white"
            onClick={() => window.api.close()}
            title="Close"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
