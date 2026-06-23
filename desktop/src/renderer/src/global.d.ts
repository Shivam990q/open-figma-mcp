export interface OpenFigmaApi {
  getState(): Promise<{
    hasToken: boolean
    handle: string
    settings: AppSettings
    frameworks: string[]
    tokenFormats: string[]
    server: { running: boolean; port?: number; host?: string }
  }>
  saveToken(token: string): Promise<{ ok: boolean; handle: string; me: any }>
  clearToken(): Promise<{ ok: boolean }>
  testToken(): Promise<any>
  fetchDesign(input: TargetInput, format?: string): Promise<FetchResult>
  getTokens(input: TargetInput, format?: string): Promise<{ tokens: any; text: string; format: string }>
  generateCode(input: TargetInput, framework?: string): Promise<{ code: string; framework: string }>
  audit(input: TargetInput, pageBackground?: string): Promise<any>
  saveSettings(patch: Partial<AppSettings>): Promise<AppSettings>
  startServer(opts: { port: number; host: string }): Promise<{ running: boolean; port?: number; host?: string }>
  stopServer(): Promise<{ running: boolean }>
  serverStatus(): Promise<{ running: boolean; port?: number; host?: string }>
  minimize(): void
  maximize(): void
  close(): void
  openExternal(url: string): Promise<void>
  copy(text: string): Promise<boolean>
  onServerLog(cb: (p: { stream: 'out' | 'err'; line: string; ts: number }) => void): () => void
  onServerStatus(cb: (p: { running: boolean; port?: number; host?: string }) => void): () => void
}

export interface AppSettings {
  port: number
  host: string
  format: 'yaml' | 'json' | 'tree'
  imageDir: string
  theme: 'dark'
  skipImageDownloads: boolean
}

export interface TargetInput {
  url?: string
  fileKey?: string
  nodeId?: string
  depth?: number
}

export interface FetchResult {
  fileKey: string
  nodeId?: string
  name?: string
  output: string
  nodeCount: number
  styleCount: number
  rawSize: number
  simplifiedSize: number
  ratio: number
  rawTokensEst: number
  simplifiedTokensEst: number
  securityWarnings: any
}

declare global {
  interface Window {
    api: OpenFigmaApi
  }
}
