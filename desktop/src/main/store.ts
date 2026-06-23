import Store from 'electron-store'

export interface Settings {
  port: number
  host: string
  format: 'yaml' | 'json' | 'tree'
  imageDir: string
  theme: 'dark'
  skipImageDownloads: boolean
}

interface Schema {
  token: string
  handle: string
  settings: Settings
}

const defaults: { settings: Settings } = {
  settings: {
    port: 3845,
    host: '127.0.0.1',
    format: 'yaml',
    imageDir: '',
    theme: 'dark',
    skipImageDownloads: false
  }
}

// Note: this persists the token in the app's userData dir. For a hardened build,
// swap to Electron's safeStorage (OS keychain). Kept simple + documented here.
const store = new Store<Schema>({ name: 'openfigma', defaults: defaults as any })

export const getToken = (): string => (store.get('token') as string) || ''
export const getHandle = (): string => (store.get('handle') as string) || ''
export const setToken = (token: string, handle: string) => {
  store.set('token', token)
  store.set('handle', handle)
}
export const clearToken = () => {
  store.delete('token')
  store.delete('handle')
}
export const getSettings = (): Settings => store.get('settings') as Settings
export const setSettings = (patch: Partial<Settings>) =>
  store.set('settings', { ...getSettings(), ...patch })
