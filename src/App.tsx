import { useCallback, useRef, useState } from 'react'
import './App.css'
import type { CncAxis } from './animation/cncAnimationConfig'
import { DevPanel } from './components/DevPanel'
import { LoadingScreen } from './components/LoadingScreen'
import { ModelErrorBoundary } from './components/ModelErrorBoundary'
import { CNCScene, type CNCSceneHandle } from './scene/CNCScene'
import type {
  CalibrationDirection,
  CncInspection,
  CncSequenceState,
} from './types/cnc'

function App() {
  const sceneRef = useRef<CNCSceneHandle>(null)
  const [inspection, setInspection] = useState<CncInspection | null>(null)
  const [isChuckTesting, setIsChuckTesting] = useState(false)
  const [sequenceState, setSequenceState] = useState<CncSequenceState>('idle')

  const handleInspection = useCallback((nextInspection: CncInspection) => {
    setInspection(nextInspection)
  }, [])

  const handleResetCamera = useCallback(() => {
    sceneRef.current?.resetCamera()
  }, [])

  const stopChuckDiagnostic = useCallback(() => {
    sceneRef.current?.stopChuckTest()
    setIsChuckTesting(false)
  }, [])

  const handleTurretCarriageTest = useCallback(
    (axis: CncAxis, direction: CalibrationDirection) => {
      stopChuckDiagnostic()
      sceneRef.current?.testTurretCarriage(axis, direction)
    },
    [stopChuckDiagnostic],
  )

  const handleSequenceStateChange = useCallback((state: CncSequenceState) => {
    setSequenceState(state)
    if (state !== 'idle') setIsChuckTesting(false)
  }, [])

  return (
    <main className="app-shell">
      <header className="site-header" aria-label="Project identity">
        <div className="brand-mark" aria-hidden="true">
          CM
        </div>
        <div>
          <p className="eyebrow">Interactive engineering study · Phase 02C</p>
          <h1>CNC Motion Showcase</h1>
        </div>
      </header>

      <section className="viewport" aria-label="Interactive CNC model">
        <ModelErrorBoundary>
          <CNCScene
            ref={sceneRef}
            onInspection={handleInspection}
            onSequenceStateChange={handleSequenceStateChange}
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
          sequenceState={sequenceState}
          onPrintAudit={() => inspection?.printAudit()}
          onResetCamera={handleResetCamera}
          onTestCameraWaypoint={(name) => sceneRef.current?.goToCameraWaypoint(name)}
          onTestInteriorCamera={() => sceneRef.current?.goToInterior()}
          onTestDumanCamera={() => sceneRef.current?.testDumanCamera()}
          onTestInteriorToDumanPath={() => sceneRef.current?.testInteriorToDumanPath()}
          onToggleChuck={() => {
            if (isChuckTesting) {
              stopChuckDiagnostic()
            } else {
              sceneRef.current?.startChuckTest()
              setIsChuckTesting(true)
            }
          }}
          onSetTailstockContact={(contact) => {
            stopChuckDiagnostic()
            sceneRef.current?.setTailstockContact(contact)
          }}
          onResetTailstock={() => sceneRef.current?.resetTailstock()}
          onTestTurretCarriage={handleTurretCarriageTest}
          onResetTurretCarriage={() => sceneRef.current?.resetTurretCarriage()}
          onTestTurretIndex={(direction) => {
            stopChuckDiagnostic()
            sceneRef.current?.testTurretIndex(direction)
          }}
          onResetTurretIndex={() => sceneRef.current?.resetTurretIndex()}
          onSetDoorOpen={(open) => {
            stopChuckDiagnostic()
            sceneRef.current?.setDoorOpen(open)
          }}
          onResetDoor={() => sceneRef.current?.resetDoor()}
          onPlaySequence={() => {
            stopChuckDiagnostic()
            sceneRef.current?.playSequence()
          }}
          onPauseSequence={() => sceneRef.current?.pauseSequence()}
          onResumeSequence={() => sceneRef.current?.resumeSequence()}
          onResetSequence={() => {
            setIsChuckTesting(false)
            sceneRef.current?.resetSequence()
          }}
        />
      ) : null}
    </main>
  )
}

export default App
