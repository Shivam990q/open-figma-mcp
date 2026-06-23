import { useEffect, useRef, useState } from 'react'
import { Play, Square, Trash2, Terminal } from 'lucide-react'
import { useApp } from '../store'
import { PageHeader, CopyButton, Segmented } from '../components/ui'

export function ServerPage() {
  const { server, settings, logs, clearLogs, setServer } = useApp()
  const [port, setPort] = useState(String(settings.port))
  const [host, setHost] = useState(settings.host)
  const [client, setClient] = useState<'Cursor / VS Code' | 'Claude Desktop' | 'Lovable (HTTP)'>('Cursor / VS Code')
  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight })
  }, [logs])

  async function toggle() {
    if (server.running) {
      setServer(await window.api.stopServer())
    } else {
      setServer(await window.api.startServer({ port: Number(port), host }))
    }
  }

  const config = buildConfig(client, host, port)

  return (
    <div>
      <PageHeader
        title="MCP Server"
        desc="Run the local server and connect it to your AI coding assistant."
        action={
          <button className={server.running ? 'btn-ghost' : 'btn-primary'} onClick={toggle}>
            {server.running ? <Square size={16} /> : <Play size={16} />}
            {server.running ? 'Stop server' : 'Start server'}
          </button>
        }
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="card p-5">
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${server.running ? 'bg-emerald-400 shadow-glow' : 'bg-zinc-600'}`} />
            <span className="font-semibold text-white">{server.running ? 'Running' : 'Stopped'}</span>
            {server.running && <span className="text-sm text-zinc-500">{server.host}:{server.port}/mcp</span>}
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <div>
              <label className="label">Host</label>
              <input className="field" value={host} onChange={(e) => setHost(e.target.value)} disabled={server.running} />
            </div>
            <div>
              <label className="label">Port</label>
              <input className="field" value={port} onChange={(e) => setPort(e.target.value)} disabled={server.running} />
            </div>
          </div>
          <p className="mt-3 text-xs text-zinc-500">
            Port <span className="font-mono text-zinc-400">3845</span> is auto-detected by Lovable. Use{' '}
            <span className="font-mono text-zinc-400">3333</span> for figma-developer-mcp parity.
          </p>
        </div>

        <div className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="font-semibold text-white">Client config</span>
            <CopyButton text={config} label="Copy JSON" />
          </div>
          <Segmented
            options={['Cursor / VS Code', 'Claude Desktop', 'Lovable (HTTP)']}
            value={client}
            onChange={setClient}
          />
          <pre className="selectable mt-3 max-h-44 overflow-auto rounded-xl border border-line bg-black/40 p-3 text-xs font-mono text-zinc-300">
            <code>{config}</code>
          </pre>
        </div>
      </div>

      <div className="card mt-5 overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
          <span className="flex items-center gap-2 text-sm font-semibold text-zinc-300">
            <Terminal size={15} className="text-brand-400" /> Live logs
          </span>
          <button className="btn-icon" onClick={clearLogs} title="Clear logs">
            <Trash2 size={15} />
          </button>
        </div>
        <div ref={logRef} className="selectable h-64 overflow-auto bg-black/40 p-4 font-mono text-xs leading-relaxed">
          {logs.length === 0 ? (
            <div className="text-zinc-600">No output yet. Start the server to stream logs…</div>
          ) : (
            logs.map((l, i) => (
              <div key={i} className={l.stream === 'err' ? 'text-amber-300/90' : 'text-zinc-400'}>
                {l.line}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function buildConfig(client: string, host: string, port: string): string {
  if (client === 'Lovable (HTTP)') {
    return JSON.stringify(
      { mcpServers: { 'open-figma-mcp': { url: `http://${host}:${port}/mcp` } } },
      null,
      2
    )
  }
  return JSON.stringify(
    {
      mcpServers: {
        'open-figma-mcp': {
          command: 'npx',
          args: ['open-figma-mcp', '--stdio'],
          env: { FIGMA_API_KEY: 'figd_YOUR_TOKEN' }
        }
      }
    },
    null,
    2
  )
}
