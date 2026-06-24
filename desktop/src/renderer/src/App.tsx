import { useEffect } from 'react'
import { useApp } from './store'
import { TitleBar } from './components/TitleBar'
import { Sidebar } from './components/Sidebar'
import { Spinner } from './components/ui'
import { Onboarding } from './pages/Onboarding'
import { Home } from './pages/Home'
import { Playground } from './pages/Playground'
import { SettingsPage } from './pages/Settings'

const PAGES = {
  home: Home,
  playground: Playground,
  settings: SettingsPage
}

export default function App() {
  const { ready, connected, route, init } = useApp()

  useEffect(() => {
    init()
  }, [])

  const Page = PAGES[route]

  return (
    <div className="flex h-full flex-col">
      <TitleBar />
      {!ready ? (
        <div className="grid flex-1 place-items-center text-faint">
          <Spinner className="text-accent" />
        </div>
      ) : !connected ? (
        <Onboarding />
      ) : (
        <div className="flex min-h-0 flex-1">
          <Sidebar />
          <main key={route} className="min-w-0 flex-1 animate-fade-in overflow-y-auto px-8 py-7">
            <Page />
          </main>
        </div>
      )}
    </div>
  )
}
