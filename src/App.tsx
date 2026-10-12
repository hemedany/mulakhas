import { DocumentSync } from '@/app/document-sync'
import { EngineProvider } from '@/app/EngineProvider'
import { MainScreen } from '@/ui/MainScreen'

export default function App() {
  return (
    <EngineProvider>
      <DocumentSync />
      <MainScreen />
    </EngineProvider>
  )
}
