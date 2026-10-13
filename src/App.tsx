import { IconContext } from '@phosphor-icons/react'
import { DocumentSync } from '@/app/document-sync'
import { EngineProvider } from '@/app/EngineProvider'
import { MainScreen } from '@/ui/MainScreen'

export default function App() {
  return (
    // Icons sit beside a label or inside a labelled button: screen readers skip them.
    <IconContext.Provider value={{ 'aria-hidden': true }}>
      <EngineProvider>
        <DocumentSync />
        <MainScreen />
      </EngineProvider>
    </IconContext.Provider>
  )
}
