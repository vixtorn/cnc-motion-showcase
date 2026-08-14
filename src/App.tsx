import { useCallback, useRef, useState } from 'react'
import './App.css'
import type { CncAxis } from './animation/cncAnimationConfig'
import { DevPanel } from './components/DevPanel'
import { LoadingScreen } from './components/LoadingScreen'
import { ModelErrorBoundary } from './components/ModelErrorBoundary'
import { CNCScene, type CNCSceneHandle } from './scene/CNCScene'
import type {
  CalibrationAssembly,
  CalibrationDirection,
  CncInspection,
} from './types/cnc'

function App() {
  const sceneRef = useRef<CNCSceneHandle>(null)
  const [inspection, setInspection] = useState<CncInspection | null>(null)
  const [isChuckTesting, setIsChuckTesting] = useState(false)

  const handleInspection = useCallback((nextInspection: CncInspection) => {
    setInspection(nextInspection)
  }, [])

  const handleResetCamera = useCallback(() => {
    setIsChuckTesting(false)
    sceneRef.current?.resetAllAssemblies()
    sceneRef.current?.resetCamera()
  }, [])

  const handleTranslationTest = useCallback(
    (assembly: CalibrationAssembly, axis: CncAxis, direction: CalibrationDirection) => {
      setIsChuckTesting(false)
      sceneRef.current?.testTranslation(assembly, axis, direction)
    },
    [],
  )

  return (
    <main className="app-shell">
      <header className="site-header" aria-label="Project identity">
        <div className="brand-mark" aria-hidden="true">
          CM
        </div>
        <div>
          <p className="eyebrow">Interactive engineering study · Phase 02A</p>
          <h1>CNC Motion Showcase</h1>
        </div>
      </header>

      <section className="viewport" aria-label="Interactive CNC model">
        <ModelErrorBoundary>
          <CNCScene
            ref={sceneRef}
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
          isChuckTesting={isChuckTesting}
          onPrintAudit={() => inspection?.printAudit()}
          onResetCamera={handleResetCamera}
          onToggleChuck={() => setIsChuckTesting((active) => !active)}
          onTestTranslation={handleTranslationTest}
          onResetAssembly={(assembly) => sceneRef.current?.resetAssembly(assembly)}
        />
      ) : null}
    </main>
  )
}

export default App
