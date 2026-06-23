import { create } from 'zustand'
import type { AppSettings } from './global'

export type Route = 'dashboard' | 'server' | 'explore' | 'tokens' | 'codegen' | 'settings'

interface LogLine {
  stream: 'out' | 'err'
  line: string
  ts: number
}

interface AppState {
  ready: boolean
  route: Route
  connected: boolean
  handle: string
  settings: AppSettings
  frameworks: string[]
  tokenFormats: string[]
  server: { running: boolean; port?: number; host?: string }
  logs: LogLine[]

  setRoute: (r: Route) => void
  init: () => Promise<void>
  setConnected: (connected: boolean, handle?: string) => void
  setSettings: (s: AppSettings) => void
  setServer: (s: { running: boolean; port?: number; host?: string }) => void
  pushLog: (l: LogLine) => void
  clearLogs: () => void
}

export const useApp = create<AppState>((set) => ({
  ready: false,
  route: 'dashboard',
  connected: false,
  handle: '',
  settings: { port: 3845, host: '127.0.0.1', format: 'yaml', imageDir: '', theme: 'dark', skipImageDownloads: false },
  frameworks: ['react-tailwind', 'react-inline', 'vue', 'svelte', 'angular', 'html', 'flutter', 'swiftui'],
  tokenFormats: ['css', 'scss', 'tailwind', 'tailwind4', 'js', 'ts', 'json', 'style-dictionary'],
  server: { running: false },
  logs: [],

  setRoute: (route) => set({ route }),
  init: async () => {
    const s = await window.api.getState()
    set({
      ready: true,
      connected: s.hasToken,
      handle: s.handle,
      settings: s.settings,
      frameworks: s.frameworks,
      tokenFormats: s.tokenFormats,
      server: s.server
    })
    window.api.onServerStatus((st) => set({ server: st }))
    window.api.onServerLog((l) => set((prev) => ({ logs: [...prev.logs.slice(-400), l] })))
  },
  setConnected: (connected, handle) => set((p) => ({ connected, handle: handle ?? p.handle })),
  setSettings: (settings) => set({ settings }),
  setServer: (server) => set({ server }),
  pushLog: (l) => set((p) => ({ logs: [...p.logs.slice(-400), l] })),
  clearLogs: () => set({ logs: [] })
}))
