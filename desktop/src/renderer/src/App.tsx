import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useApp } from './store'
import { TitleBar } from './components/TitleBar'
import { Sidebar } from './components/Sidebar'
import { Spinner } from './components/ui'
import { Onboarding } from './pages/Onboarding'
import { Dashboard } from './pages/Dashboard'
import { ServerPage } from './pages/Server'
import { Explore } from './pages/Explore'
import { TokensPage } from './pages/Tokens'
import { Codegen } from './pages/Codegen'
import { SettingsPage } from './pages/Settings'

const PAGES = {
  dashboard: Dashboard,
  server: ServerPage,
  explore: Explore,
  tokens: TokensPage,
  codegen: Codegen,
  settings: SettingsPage
}

export default function App() {
  const { ready, connected, route, init } = useApp()

  useEffect(() => {
    init()
  }, [])

  const Page = PAGES[route]

  return (
    <div className="flex h-full flex-col bg-radial-fade">
      <TitleBar />
      {!ready ? (
        <div className="grid flex-1 place-items-center text-zinc-500">
          <Spinner className="text-brand-400" />
        </div>
      ) : !connected ? (
        <Onboarding />
      ) : (
        <div className="flex min-h-0 flex-1">
          <Sidebar />
          <main className="min-w-0 flex-1 overflow-y-auto px-8 py-7">
            <AnimatePresence mode="wait">
              <motion.div
                key={route}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
              >
                <Page />
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      )}
    </div>
  )
}
