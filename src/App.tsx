import { useCallback, useRef, useState } from 'react'
import './App.css'
import { LoadingScreen } from './components/LoadingScreen'
import { ModelErrorBoundary } from './components/ModelErrorBoundary'
import { DevPanel } from './components/DevPanel'
import type { ChuckAxis } from './animation/cncAnimationConfig'
import { CNCScene, type CNCSceneHandle } from './scene/CNCScene'
import type { CncInspection } from './types/cnc'

function App() {
  const sceneRef = useRef<CNCSceneHandle>(null)
  const [inspection, setInspection] = useState<CncInspection | null>(null)
  const [chuckAxis, setChuckAxis] = useState<ChuckAxis>('z')
  const [isChuckTesting, setIsChuckTesting] = useState(false)

  const handleInspection = useCallback((nextInspection: CncInspection) => {
    setInspection(nextInspection)
  }, [])

  const handleResetCamera = useCallback(() => {
    setIsChuckTesting(false)
    sceneRef.current?.resetCamera()
  }, [])

  return (
    <main className="app-shell">
      <header className="site-header" aria-label="Project identity">
        <div className="brand-mark" aria-hidden="true">
          CM
        </div>
        <div>
          <p className="eyebrow">Interactive engineering study · Phase 01</p>
          <h1>CNC Motion Showcase</h1>
        </div>
      </header>

      <section className="viewport" aria-label="Interactive CNC model">
        <ModelErrorBoundary>
          <CNCScene
            ref={sceneRef}
            chuckAxis={chuckAxis}
            isChuckTesting={isChuckTesting}
            onInspection={handleInspection}
          />
        </ModelErrorBoundary>
        <LoadingScreen />

        <div className="viewport-note" aria-hidden="true">
          <span>Drag to orbit</span>
          <span>Scroll to inspect</span>
        </div>
      </section>

      <footer className="site-footer">
        <span>Universal turning center</span>
        <span className="system-status">
          <i aria-hidden="true" />
          {inspection ? 'Scene online' : 'Initializing scene'}
        </span>
      </footer>

      {import.meta.env.DEV ? (
        <DevPanel
          inspection={inspection}
          chuckAxis={chuckAxis}
          isChuckTesting={isChuckTesting}
          onAxisChange={(axis) => {
            setIsChuckTesting(false)
            setChuckAxis(axis)
          }}
          onPrintAudit={() => inspection?.printAudit()}
          onResetCamera={handleResetCamera}
          onToggleChuck={() => setIsChuckTesting((active) => !active)}
        />
      ) : null}
    </main>
  )
}

export default App
