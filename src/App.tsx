import { useCallback, useRef, useState, type CSSProperties } from 'react'
import './App.css'
import type { CncAxis } from './animation/cncAnimationConfig'
import { CNC_CHOREOGRAPHY } from './animation/cncChoreographyConfig'
import { DevPanel } from './components/DevPanel'
import { LoadingScreen } from './components/LoadingScreen'
import { ModelErrorBoundary } from './components/ModelErrorBoundary'
import {
  CNC_SCROLL,
  useCncScrollDriver,
  type CncScrollDiagnostics,
} from './hooks/useCncScrollDriver'
import { CNCScene, type CNCSceneHandle } from './scene/CNCScene'
import type {
  CalibrationDirection,
  CncInspection,
  CncSequenceState,
} from './types/cnc'

function App() {
  const sceneRef = useRef<CNCSceneHandle>(null)
  const cinematicScrollRef = useRef<HTMLElement>(null)
  const [inspection, setInspection] = useState<CncInspection | null>(null)
  const [isChuckTesting, setIsChuckTesting] = useState(false)
  const [sequenceState, setSequenceState] = useState<CncSequenceState>('idle')
  const [sequenceProgress, setSequenceProgress] = useState(0)
  const [scrollDriverEnabled, setScrollDriverEnabled] = useState(true)
  const [scrollDiagnostics, setScrollDiagnostics] = useState<CncScrollDiagnostics>({
    raw: 0,
    target: 0,
    sequence: 0,
  })
  const [cameraSpeedMultiplier, setCameraSpeedMultiplier] = useState<number>(
    CNC_CHOREOGRAPHY.cameraSpeed.defaultMultiplier,
  )

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

  const handleScrollProgress = useCallback((progress: number) => {
    sceneRef.current?.setSequenceProgress(progress)
  }, [])

  useCncScrollDriver({
    containerRef: cinematicScrollRef,
    enabled: Boolean(inspection) && scrollDriverEnabled,
    onProgress: handleScrollProgress,
    onDiagnostics: setScrollDiagnostics,
  })

  const cinematicScrollStyle = {
    '--cinematic-scroll-height': `${CNC_SCROLL.totalViewportHeights * 100}svh`,
  } as CSSProperties

  return (
    <main className="app-shell">
      <section
        ref={cinematicScrollRef}
        className="cinematic-scroll"
        style={cinematicScrollStyle}
        aria-label="Scroll-driven CNC cinematic"
      >
        <div className="cinematic-stage">
          <header className="site-header" aria-label="Project identity">
            <div className="brand-mark" aria-hidden="true">
              CM
            </div>
            <div>
              <p className="eyebrow">Interactive engineering study · Phase 02D</p>
              <h1>CNC Motion Showcase</h1>
            </div>
          </header>

          <section className="viewport" aria-label="Interactive CNC model">
            <ModelErrorBoundary>
              <CNCScene
                ref={sceneRef}
                onInspection={handleInspection}
                onSequenceStateChange={handleSequenceStateChange}
                onSequenceProgressChange={setSequenceProgress}
                cameraSpeedMultiplier={cameraSpeedMultiplier}
                scrollModeActive={scrollDriverEnabled}
              />
            </ModelErrorBoundary>
            <LoadingScreen />

            <div className="viewport-note" aria-hidden="true">
              <span>{scrollDriverEnabled ? 'Scroll to run' : 'Drag to orbit'}</span>
              <span>{scrollDriverEnabled ? 'Reverse to rewind' : 'Scroll to inspect'}</span>
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
              sequenceProgress={sequenceProgress}
              scrollDriverEnabled={scrollDriverEnabled}
              scrollDiagnostics={scrollDiagnostics}
              cameraSpeedMultiplier={cameraSpeedMultiplier}
              onCameraSpeedMultiplierChange={setCameraSpeedMultiplier}
              onPrintAudit={() => inspection?.printAudit()}
              onResetCamera={handleResetCamera}
              onTestCameraWaypoint={(name) => sceneRef.current?.goToCameraWaypoint(name)}
              onTestInteriorCamera={() => sceneRef.current?.goToInterior()}
              onTestDumanCamera={() => sceneRef.current?.testDumanCamera()}
              onTestInteriorToDumanPath={() => sceneRef.current?.testInteriorToDumanPath()}
              onTestFinishedPartCamera={() => sceneRef.current?.testFinishedPartCamera()}
              onStartCoolant={() => sceneRef.current?.startCoolant()}
              onStopCoolant={() => sceneRef.current?.stopCoolant()}
              onTestWorkpieceTransition={() => sceneRef.current?.testWorkpieceTransition()}
              onResetMachining={() => sceneRef.current?.resetMachining()}
              onStartSparks={() => sceneRef.current?.startSparks()}
              onStopSparks={() => sceneRef.current?.stopSparks()}
              onResetSparks={() => sceneRef.current?.resetSparks()}
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
              onSequenceProgressChange={(progress) => {
                setIsChuckTesting(false)
                sceneRef.current?.setSequenceProgress(progress)
              }}
              onScrollDriverEnabledChange={setScrollDriverEnabled}
            />
          ) : null}
        </div>
      </section>

      <section className="post-cinematic-test" aria-label="Phase 3B test marker">
        <span>DEV / PHASE 3B</span>
        <p>Cinematic complete</p>
      </section>
    </main>
  )
}

export default App
