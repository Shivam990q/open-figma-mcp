import { useEffect, useRef, useState } from 'react'
import { Play, Square, ChevronDown, Trash2, Circle, Check } from 'lucide-react'
import { useApp } from '../store'
import { CopyButton, Segmented } from '../components/ui'

type Editor = 'Cursor' | 'VS Code' | 'Claude' | 'Windsurf' | 'Lovable'
const EDITORS: readonly Editor[] = ['Cursor', 'VS Code', 'Claude', 'Windsurf', 'Lovable']

export function Home() {
  const { server, settings, handle, logs, clearLogs, setServer } = useApp()
  const [host, setHost] = useState(settings.host)
  const [port, setPort] = useState(String(settings.port))
  const [editor, setEditor] = useState<Editor>('Cursor')
  const [transport, setTransport] = useState<'HTTP (recommended)' | 'Command (stdio)'>('HTTP (recommended)')
  const [showLogs, setShowLogs] = useState(false)
  const [busy, setBusy] = useState(false)
  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (showLogs) logRef.current?.scrollTo({ top: logRef.current.scrollHeight })
  }, [logs, showLogs])

  async function toggle() {
    setBusy(true)
    try {
      if (server.running) setServer(await window.api.stopServer())
      else setServer(await window.api.startServer({ port: Number(port), host }))
    } finally {
      setBusy(false)
    }
  }

  const running = server.running
  const endpoint = `http://${running ? server.host : host}:${running ? server.port : port}/mcp`

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight text-ink">Connect Figma to your editor</h1>
        <p className="mt-1 text-sm text-muted">
          Run the local server, then paste the config into your AI coding tool. Connected as <span className="text-ink">@{handle}</span>.
        </p>
      </div>

      {/* Server control */}
      <div className="card p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className={`relative flex h-2.5 w-2.5`}>
              {running && <span className="absolute inline-flex h-full w-full rounded-full bg-ok/60 animate-breathe" />}
              <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${running ? 'bg-ok' : 'bg-faint'}`} />
            </span>
            <div>
              <div className="text-sm font-semibold text-ink">{running ? 'Server running' : 'Server stopped'}</div>
              <div className="font-mono text-xs text-faint">{running ? `${server.host}:${server.port}` : 'not started'}</div>
            </div>
          </div>
          <button className={running ? 'btn-secondary' : 'btn-primary'} onClick={toggle} disabled={busy}>
            {running ? <Square size={15} /> : <Play size={15} />}
            {running ? 'Stop' : 'Start server'}
          </button>
        </div>

        {!running && (
          <div className="mt-5 grid grid-cols-2 gap-3 border-t border-border pt-4">
            <div>
              <label className="label">Host</label>
              <input className="field" value={host} onChange={(e) => setHost(e.target.value)} />
            </div>
            <div>
              <label className="label">Port</label>
              <input className="field" value={port} onChange={(e) => setPort(e.target.value)} />
            </div>
          </div>
        )}
      </div>

      {/* Editor setup */}
      <div className="card mt-4 p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-ink">Add to your editor</div>
            <div className="text-xs text-faint">Paste this into the tool's MCP config.</div>
          </div>
          <Segmented options={EDITORS} value={editor} onChange={setEditor} size="sm" />
        </div>

        {editor !== 'Lovable' && (
          <div className="mb-3">
            <Segmented
              options={['HTTP (recommended)', 'Command (stdio)']}
              value={transport}
              onChange={setTransport}
              size="sm"
            />
          </div>
        )}

        <ConfigBlock editor={editor} transport={transport} endpoint={endpoint} />

        <div className="mt-3 flex items-start gap-2 text-xs text-faint">
          <Check size={13} className="mt-0.5 shrink-0 text-ok" />
          {hintFor(editor, transport, running)}
        </div>
      </div>

      {/* Live logs (collapsible, off by default — keeps the screen calm) */}
      <div className="card mt-4 overflow-hidden">
        <button
          className="flex w-full items-center justify-between px-4 py-3 text-sm"
          onClick={() => setShowLogs((s) => !s)}
        >
          <span className="flex items-center gap-2 font-medium text-muted">
            <Circle size={8} className={running ? 'fill-ok text-ok' : 'fill-faint text-faint'} />
            Live logs
            {logs.length > 0 && <span className="chip">{logs.length}</span>}
          </span>
          <ChevronDown size={16} className={`text-faint transition-transform ${showLogs ? 'rotate-180' : ''}`} />
        </button>
        {showLogs && (
          <div className="border-t border-border">
            <div className="flex justify-end px-3 py-1.5">
              <button className="btn-icon" onClick={clearLogs} title="Clear">
                <Trash2 size={14} />
              </button>
            </div>
            <div ref={logRef} className="selectable max-h-56 overflow-auto px-4 pb-4 font-mono text-xs leading-relaxed">
              {logs.length === 0 ? (
                <div className="text-faint">No output yet — start the server to stream logs.</div>
              ) : (
                logs.map((l, i) => (
                  <div key={i} className={l.stream === 'err' ? 'text-warn/90' : 'text-muted'}>
                    {l.line}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function hintFor(editor: Editor, transport: string, running: boolean): string {
  if (editor === 'Lovable') {
    return running
      ? 'In Lovable: Connectors → Custom MCP → HTTP, then paste the URL above.'
      : 'Start the server above first, then in Lovable: Connectors → Custom MCP → HTTP and paste the URL.'
  }
  if (transport === 'HTTP (recommended)') {
    return running
      ? `Works right now — this app is serving the endpoint above. Add it as an MCP server URL in ${editor}.`
      : `Start the server above, then add this URL as an MCP server in ${editor}. No npm install needed.`
  }
  // stdio
  switch (editor) {
    case 'Cursor':
      return 'stdio: add to .cursor/mcp.json. Requires the npm package (npm i -g open-figma-mcp).'
    case 'VS Code':
      return 'stdio: add to .vscode/mcp.json. Requires the npm package (npm i -g open-figma-mcp).'
    case 'Claude':
      return 'stdio: edit claude_desktop_config.json, then restart Claude. Requires the npm package.'
    case 'Windsurf':
      return 'stdio: Settings → Cascade → MCP servers. Requires the npm package (npm i -g open-figma-mcp).'
    default:
      return ''
  }
}

function ConfigBlock({ editor, transport, endpoint }: { editor: Editor; transport: string; endpoint: string }) {
  const useHttp = editor === 'Lovable' || transport === 'HTTP (recommended)'
  const config = useHttp
    ? JSON.stringify({ mcpServers: { 'open-figma-mcp': { url: endpoint } } }, null, 2)
    : JSON.stringify(
        {
          mcpServers: {
            'open-figma-mcp': {
              command: 'npx',
              args: ['-y', 'open-figma-mcp', '--stdio'],
              env: { FIGMA_API_KEY: 'figd_YOUR_TOKEN' }
            }
          }
        },
        null,
        2
      )
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-bg">
      <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
        <span className="font-mono text-xs text-faint">{useHttp ? endpoint : 'stdio · npx'}</span>
        <CopyButton text={config} label="Copy" />
      </div>
      <pre className="selectable overflow-auto p-3.5 font-mono text-[12.5px] leading-relaxed text-muted">
        <code>{config}</code>
      </pre>
    </div>
  )
}
