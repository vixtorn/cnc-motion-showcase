import { useCallback, useRef, useState, type CSSProperties } from 'react'
import './App.css'
import type { CncAxis } from './animation/cncAnimationConfig'
import { CNC_CHOREOGRAPHY } from './animation/cncChoreographyConfig'
import { CinematicHero } from './components/CinematicHero'
import { CinematicNarrative } from './components/CinematicNarrative'
import { DevPanel } from './components/DevPanel'
import { LoadingScreen } from './components/LoadingScreen'
import { ModelErrorBoundary } from './components/ModelErrorBoundary'
import { PostCinematicIntro } from './components/PostCinematicIntro'
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
import { INITIAL_CNC_SEQUENCE_TELEMETRY } from './types/cnc'

function App() {
  const sceneRef = useRef<CNCSceneHandle>(null)
  const cinematicScrollRef = useRef<HTMLElement>(null)
  const [inspection, setInspection] = useState<CncInspection | null>(null)
  const [isChuckTesting, setIsChuckTesting] = useState(false)
  const [sequenceState, setSequenceState] = useState<CncSequenceState>('idle')
  const [sequenceProgress, setSequenceProgress] = useState(0)
  const [sequenceTelemetry, setSequenceTelemetry] = useState(
    INITIAL_CNC_SEQUENCE_TELEMETRY,
  )
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
          <section className="viewport" aria-label="Interactive CNC model">
            <ModelErrorBoundary>
              <CNCScene
                ref={sceneRef}
                onInspection={handleInspection}
                onSequenceStateChange={handleSequenceStateChange}
                onSequenceProgressChange={setSequenceProgress}
                onSequenceTelemetryChange={setSequenceTelemetry}
                cameraSpeedMultiplier={cameraSpeedMultiplier}
                scrollModeActive={scrollDriverEnabled}
              />
            </ModelErrorBoundary>
            <LoadingScreen />
          </section>

          <CinematicHero progress={sequenceProgress} />
          <CinematicNarrative
            progress={sequenceProgress}
            telemetry={sequenceTelemetry}
          />

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

      <PostCinematicIntro />
    </main>
  )
}

export default App
