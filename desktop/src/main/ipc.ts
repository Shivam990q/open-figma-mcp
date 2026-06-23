import { ipcMain, shell, clipboard, BrowserWindow, app } from 'electron'
import { spawn, ChildProcess } from 'child_process'
import { join } from 'path'
import * as core from './core.js'
import * as store from './store.js'

let serverProc: ChildProcess | null = null
let serverInfo: { port: number; host: string } | null = null

function coreRoot(): string {
  if (app.isPackaged) return join(process.resourcesPath, 'core', 'src')
  return join(app.getAppPath(), '..', 'src')
}

function broadcast(channel: string, payload: unknown) {
  for (const w of BrowserWindow.getAllWindows()) w.webContents.send(channel, payload)
}

export function registerIpc(): void {
  // ---- App state ----
  ipcMain.handle('app:getState', () => ({
    hasToken: !!store.getToken(),
    handle: store.getHandle(),
    settings: store.getSettings(),
    frameworks: core.CODEGEN_FRAMEWORKS,
    tokenFormats: core.TOKEN_FORMATS,
    server: { running: !!serverProc, ...serverInfo }
  }))

  // ---- Token / auth ----
  ipcMain.handle('token:save', async (_e, token: string) => {
    const me: any = await core.whoami(token)
    const handle = me?.handle || me?.email || 'unknown'
    store.setToken(token, handle)
    return { ok: true, handle, me }
  })
  ipcMain.handle('token:clear', () => {
    store.clearToken()
    return { ok: true }
  })
  ipcMain.handle('token:test', async () => {
    const token = store.getToken()
    if (!token) throw new Error('No token saved.')
    return core.whoami(token)
  })

  // ---- Figma operations ----
  const tok = () => {
    const t = store.getToken()
    if (!t) throw new Error('Connect a Figma token first.')
    return t
  }
  ipcMain.handle('figma:fetch', (_e, input, format) => core.fetchDesign(tok(), input, format))
  ipcMain.handle('figma:tokens', (_e, input, format) => core.designTokens(tok(), input, format))
  ipcMain.handle('figma:codegen', (_e, input, framework) => core.codegen(tok(), input, framework))
  ipcMain.handle('figma:audit', (_e, input, bg) => core.audit(tok(), input, bg))
  ipcMain.handle('figma:download', (_e, input, format, imageDir) =>
    core.downloadImages(tok(), input, format, imageDir || app.getPath('downloads'))
  )

  // ---- Settings ----
  ipcMain.handle('settings:save', (_e, patch) => {
    store.setSettings(patch)
    return store.getSettings()
  })

  // ---- MCP server lifecycle ----
  ipcMain.handle('server:start', (_e, opts: { port: number; host: string }) => {
    if (serverProc) return { running: true, ...serverInfo }
    const entry = join(coreRoot(), 'server.js')
    const args = [entry, '--figma-api-key', tok(), '--port', String(opts.port), '--host', opts.host]
    serverProc = spawn(process.execPath, args, {
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', SKIP_IMAGE_DOWNLOADS: String(store.getSettings().skipImageDownloads) }
    })
    serverInfo = { port: opts.port, host: opts.host }
    broadcast('server:status', { running: true, ...serverInfo })

    const pipe = (stream: 'out' | 'err') => (buf: Buffer) =>
      buf.toString().split('\n').filter(Boolean).forEach((line) =>
        broadcast('server:log', { stream, line, ts: Date.now() }))
    serverProc.stdout?.on('data', pipe('out'))
    serverProc.stderr?.on('data', pipe('err'))
    serverProc.on('exit', (code) => {
      broadcast('server:log', { stream: 'err', line: `[server] exited with code ${code}`, ts: Date.now() })
      serverProc = null
      serverInfo = null
      broadcast('server:status', { running: false })
    })
    return { running: true, ...serverInfo }
  })
  ipcMain.handle('server:stop', () => {
    if (serverProc) {
      serverProc.kill()
      serverProc = null
      serverInfo = null
    }
    broadcast('server:status', { running: false })
    return { running: false }
  })
  ipcMain.handle('server:status', () => ({ running: !!serverProc, ...serverInfo }))

  // ---- Window controls (frameless titlebar) ----
  ipcMain.on('window:minimize', (e) => BrowserWindow.fromWebContents(e.sender)?.minimize())
  ipcMain.on('window:maximize', (e) => {
    const w = BrowserWindow.fromWebContents(e.sender)
    if (!w) return
    w.isMaximized() ? w.unmaximize() : w.maximize()
  })
  ipcMain.on('window:close', (e) => BrowserWindow.fromWebContents(e.sender)?.close())

  // ---- Misc ----
  ipcMain.handle('shell:open', (_e, url: string) => shell.openExternal(url))
  ipcMain.handle('shell:showFolder', (_e, p: string) => shell.openPath(p))
  ipcMain.handle('clipboard:write', (_e, text: string) => {
    clipboard.writeText(text)
    return true
  })
}

export function stopServerProc(): void {
  if (serverProc) serverProc.kill()
}
