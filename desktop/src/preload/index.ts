import { contextBridge, ipcRenderer } from 'electron'

const api = {
  getState: () => ipcRenderer.invoke('app:getState'),

  saveToken: (token: string) => ipcRenderer.invoke('token:save', token),
  clearToken: () => ipcRenderer.invoke('token:clear'),
  testToken: () => ipcRenderer.invoke('token:test'),

  fetchDesign: (input: any, format?: string) => ipcRenderer.invoke('figma:fetch', input, format),
  getTokens: (input: any, format?: string) => ipcRenderer.invoke('figma:tokens', input, format),
  generateCode: (input: any, framework?: string) => ipcRenderer.invoke('figma:codegen', input, framework),
  audit: (input: any, pageBackground?: string) => ipcRenderer.invoke('figma:audit', input, pageBackground),

  saveSettings: (patch: any) => ipcRenderer.invoke('settings:save', patch),

  startServer: (opts: { port: number; host: string }) => ipcRenderer.invoke('server:start', opts),
  stopServer: () => ipcRenderer.invoke('server:stop'),
  serverStatus: () => ipcRenderer.invoke('server:status'),

  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),

  openExternal: (url: string) => ipcRenderer.invoke('shell:open', url),
  copy: (text: string) => ipcRenderer.invoke('clipboard:write', text),

  onServerLog: (cb: (e: any) => void) => {
    const h = (_: unknown, payload: any) => cb(payload)
    ipcRenderer.on('server:log', h)
    return () => ipcRenderer.removeListener('server:log', h)
  },
  onServerStatus: (cb: (e: any) => void) => {
    const h = (_: unknown, payload: any) => cb(payload)
    ipcRenderer.on('server:status', h)
    return () => ipcRenderer.removeListener('server:status', h)
  }
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
