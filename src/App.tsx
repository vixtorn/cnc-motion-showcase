import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import './App.css'
import type { CncAxis } from './animation/cncAnimationConfig'
import { CNC_CHOREOGRAPHY } from './animation/cncChoreographyConfig'
import {
  SITE_NAVIGATION_HEIGHT_PX,
  type SiteSectionId,
} from './config/siteSections'
import { CinematicHero } from './components/CinematicHero'
import { CinematicNarrative } from './components/CinematicNarrative'
import { DevPanel } from './components/DevPanel'
import { EngineeringExperience } from './components/EngineeringExperience'
import { LoadingScreen } from './components/LoadingScreen'
import { MachineAnatomy } from './components/MachineAnatomy'
import { ModelErrorBoundary } from './components/ModelErrorBoundary'
import { AnatomyPanel } from './components/AnatomyPanel'
import { OperatorPanel } from './components/OperatorPanel'
import { PostCinematicIntro } from './components/PostCinematicIntro'
import { ProcessComparisonPanel } from './components/ProcessComparisonPanel'
import { RunTheMachine } from './components/RunTheMachine'
import { SiteFooter } from './components/SiteFooter'
import { SiteNavigation } from './components/SiteNavigation'
import { ProcessPlayground } from './components/ProcessPlayground'
import {
  CNC_SCROLL,
  getCinematicViewportHeights,
  useCncScrollDriver,
  type CncScrollDiagnostics,
} from './hooks/useCncScrollDriver'
import { useCncOperatorMode } from './hooks/useCncOperatorMode'
import { useCncAnatomyMode } from './hooks/useCncAnatomyMode'
import { useCncProcessComparison } from './hooks/useCncProcessComparison'
import { useCncProcessPlayground } from './hooks/useCncProcessPlayground'
import { usePlaygroundReveal } from './hooks/usePlaygroundReveal'
import { useSmoothScroll } from './hooks/useSmoothScroll'
import { useActiveSiteSection } from './hooks/useActiveSiteSection'
import { CNCScene, type CNCSceneHandle } from './scene/CNCScene'
import type {
  CalibrationDirection,
  CncExperienceMode,
  CncInspection,
  CncSequenceState,
} from './types/cnc'
import { INITIAL_CNC_SEQUENCE_TELEMETRY } from './types/cnc'

function App() {
  const sceneRef = useRef<CNCSceneHandle>(null)
  const cinematicScrollRef = useRef<HTMLElement>(null)
  const cinematicStageRef = useRef<HTMLDivElement>(null)
  const playgroundSectionRef = useRef<HTMLElement>(null)
  const playgroundWasActiveRef = useRef(false)
  const pacingReconciliationFrame = useRef<number | null>(null)
  const [inspection, setInspection] = useState<CncInspection | null>(null)
  const [isChuckTesting, setIsChuckTesting] = useState(false)
  const [sequenceState, setSequenceState] = useState<CncSequenceState>('idle')
  const [sequenceProgress, setSequenceProgress] = useState(0)
  const [sequenceTelemetry, setSequenceTelemetry] = useState(
    INITIAL_CNC_SEQUENCE_TELEMETRY,
  )
  const [scrollDriverEnabled, setScrollDriverEnabled] = useState(true)
  const [scrollPacing, setScrollPacing] = useState(() => {
    if (!import.meta.env.DEV) return CNC_SCROLL.defaultPacing

    const stored = Number(window.localStorage.getItem('cnc-dev-scroll-pacing'))
    return Number.isFinite(stored) &&
      stored >= CNC_SCROLL.minimumPacing &&
      stored <= CNC_SCROLL.maximumPacing
      ? stored
      : CNC_SCROLL.defaultPacing
  })
  const [smoothScrollEnabled, setSmoothScrollEnabled] = useState(true)
  const [scrollDiagnostics, setScrollDiagnostics] = useState<CncScrollDiagnostics>({
    raw: 0,
    target: 0,
    sequence: 0,
  })
  const [cameraSpeedMultiplier, setCameraSpeedMultiplier] = useState<number>(
    CNC_CHOREOGRAPHY.cameraSpeed.defaultMultiplier,
  )
  const [experienceMode, setExperienceMode] = useState<CncExperienceMode>('content')
  const [isDevPanelVisible, setIsDevPanelVisible] = useState(false)
  const [playgroundNavigationReleased, setPlaygroundNavigationReleased] = useState(false)
  const operator = useCncOperatorMode({
    sceneRef,
    canEnter: experienceMode === 'content',
    onExperienceModeChange: setExperienceMode,
  })
  const comparison = useCncProcessComparison({
    sceneRef,
    canEnter: experienceMode === 'content',
    onExperienceModeChange: setExperienceMode,
  })
  const anatomy = useCncAnatomyMode({
    sceneRef,
    canEnter: experienceMode === 'content',
    onExperienceModeChange: setExperienceMode,
  })
  const smoothScroll = useSmoothScroll({
    enabled: smoothScrollEnabled,
    suspended: experienceMode !== 'content',
  })
  const scrollToSiteElement = smoothScroll.scrollToElement
  const activeSiteSection = useActiveSiteSection()
  const isContentExperience = experienceMode === 'content'
  const isCycleSection = activeSiteSection === 'cycle'
  const playgroundReveal = usePlaygroundReveal({
    sectionRef: playgroundSectionRef,
    presentationRef: cinematicStageRef,
  })
  const playgroundModeActive =
    playgroundReveal.isPresenting && !playgroundNavigationReleased
  const playground = useCncProcessPlayground({
    sceneRef,
    active: playgroundModeActive,
    interactionEnabled: playgroundModeActive && playgroundReveal.interactionEnabled,
  })

  useEffect(() => {
    if (!import.meta.env.DEV) return

    const handleDevPanelToggle = (event: KeyboardEvent) => {
      if (!event.shiftKey || event.key.toLowerCase() !== 'd') return
      const target = event.target as HTMLElement | null
      if (target?.matches('input, textarea, select, [contenteditable="true"]')) return
      event.preventDefault()
      setIsDevPanelVisible((visible) => !visible)
    }

    window.addEventListener('keydown', handleDevPanelToggle)
    return () => window.removeEventListener('keydown', handleDevPanelToggle)
  }, [])

  const navigateToHashTarget = useCallback(
    (hash: string, immediate = false) => {
      const aliases: Record<string, string> = {
        'engineering-01': 'engineering-asset',
        'engineering-02': 'engineering-timeline',
        'engineering-03': 'engineering-scroll',
        'engineering-04': 'engineering-state',
        'engineering-05': 'engineering-effects',
        'engineering-06': 'engineering-interaction',
      }
      const targetId = aliases[hash] ?? hash
      const target = document.getElementById(targetId)
      if (!target) return
      scrollToSiteElement(target, {
        immediate,
        offset: -SITE_NAVIGATION_HEIGHT_PX,
      })
    },
    [scrollToSiteElement],
  )

  const handleSiteNavigation = useCallback(
    (id: SiteSectionId) => {
      if (playgroundModeActive && id !== 'process') {
        setPlaygroundNavigationReleased(true)
        sceneRef.current?.exitProcessPlayground()
      }
      if (window.location.hash !== `#${id}`) {
        window.history.pushState(null, '', `#${id}`)
      }
      navigateToHashTarget(id)
    },
    [navigateToHashTarget, playgroundModeActive],
  )

  useEffect(() => {
    const handleHistoryNavigation = () => {
      navigateToHashTarget(window.location.hash.slice(1), true)
    }
    const initialHash = window.location.hash.slice(1)
    let frame: number | null = null
    if (initialHash) {
      frame = window.requestAnimationFrame(handleHistoryNavigation)
    }
    window.addEventListener('popstate', handleHistoryNavigation)
    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame)
      window.removeEventListener('popstate', handleHistoryNavigation)
    }
  }, [navigateToHashTarget])

  useEffect(
    () => () => {
      if (pacingReconciliationFrame.current !== null) {
        window.cancelAnimationFrame(pacingReconciliationFrame.current)
      }
    },
    [],
  )

  useEffect(() => {
    if (!playgroundReveal.isPresenting) setPlaygroundNavigationReleased(false)
  }, [playgroundReveal.isPresenting])

  useEffect(() => {
    const canPresentPlayground =
      playgroundModeActive && experienceMode === 'content' && Boolean(inspection)

    if (canPresentPlayground && !playgroundWasActiveRef.current) {
      sceneRef.current?.enterProcessPlayground(playground.isComplete)
      playgroundWasActiveRef.current = true
    }

    if (!canPresentPlayground && playgroundWasActiveRef.current) {
      sceneRef.current?.exitProcessPlayground()
      playgroundWasActiveRef.current = false
    }
  }, [experienceMode, inspection, playground.isComplete, playgroundModeActive])

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

  const handleScrollPacingChange = useCallback(
    (nextPacing: number) => {
      const section = cinematicScrollRef.current
      const clampedPacing = Math.min(
        CNC_SCROLL.maximumPacing,
        Math.max(CNC_SCROLL.minimumPacing, nextPacing),
      )
      const roundedPacing = Number(clampedPacing.toFixed(2))

      if (!section || roundedPacing === scrollPacing) return

      const sectionStart = section.getBoundingClientRect().top + window.scrollY
      const previousDistance =
        (getCinematicViewportHeights(scrollPacing) - 1) * window.innerHeight
      const nextHeight = getCinematicViewportHeights(roundedPacing)
      const nextDistance = (nextHeight - 1) * window.innerHeight
      const currentScrollY = window.scrollY
      const canonicalProgress = Math.min(1, Math.max(0, sequenceProgress))
      const previousSectionEnd = sectionStart + previousDistance
      const nextScrollY =
        currentScrollY >= sectionStart && currentScrollY <= previousSectionEnd
          ? sectionStart + canonicalProgress * nextDistance
          : currentScrollY > previousSectionEnd
            ? currentScrollY + (nextDistance - previousDistance)
            : currentScrollY

      section.style.setProperty('--cinematic-scroll-height', `${nextHeight * 100}svh`)
      setScrollPacing(roundedPacing)
      if (import.meta.env.DEV) {
        window.localStorage.setItem('cnc-dev-scroll-pacing', String(roundedPacing))
      }

      if (pacingReconciliationFrame.current !== null) {
        window.cancelAnimationFrame(pacingReconciliationFrame.current)
      }
      pacingReconciliationFrame.current = window.requestAnimationFrame(() => {
        smoothScroll.scrollToImmediate(nextScrollY)
        pacingReconciliationFrame.current = null
      })
    },
    [scrollPacing, sequenceProgress, smoothScroll],
  )

  useCncScrollDriver({
    containerRef: cinematicScrollRef,
    enabled:
      Boolean(inspection) &&
      scrollDriverEnabled &&
      experienceMode === 'content' &&
      !playgroundModeActive,
    onProgress: handleScrollProgress,
    onDiagnostics: setScrollDiagnostics,
  })

  const cinematicScrollStyle = {
    '--cinematic-scroll-height': `${getCinematicViewportHeights(scrollPacing) * 100}svh`,
    '--site-nav-height': `${SITE_NAVIGATION_HEIGHT_PX}px`,
  } as CSSProperties & { '--site-nav-height': string }

  return (
    <main className="app-shell" style={cinematicScrollStyle}>
      <SiteNavigation
        activeSectionId={activeSiteSection}
        visible={isContentExperience && !isCycleSection}
        onNavigate={handleSiteNavigation}
      />
      <section
        ref={cinematicScrollRef}
        id="cycle"
        className="cinematic-scroll"
        aria-label="Scroll-driven CNC cinematic"
      >
        <div
          ref={cinematicStageRef}
          className={`cinematic-stage${
            operator.isActive ? ' is-operator-active' : ''
          }${comparison.isActive ? ' is-comparison-active' : ''}${
            anatomy.isActive ? ' is-anatomy-active' : ''
          }${playgroundModeActive ? ' is-playground-active' : ''
          }`}
        >
          <section className="viewport" aria-label="Interactive CNC model">
            <ModelErrorBoundary>
              <CNCScene
                ref={sceneRef}
                onInspection={handleInspection}
                onSequenceStateChange={handleSequenceStateChange}
                onSequenceProgressChange={setSequenceProgress}
                onSequenceTelemetryChange={setSequenceTelemetry}
                cameraSpeedMultiplier={cameraSpeedMultiplier}
                scrollModeActive={
                  scrollDriverEnabled && experienceMode === 'content'
                }
                operatorModeActive={operator.isActive}
                comparisonModeActive={comparison.isActive}
                playgroundModeActive={playgroundModeActive}
                playgroundInteractionEnabled={
                  playgroundModeActive &&
                  playgroundReveal.interactionEnabled &&
                  !playground.isComplete
                }
                playgroundSelectedIds={playground.selectedIds}
                playgroundHoveredId={playground.hoveredId}
                onPlaygroundHoverChange={playground.setHoveredId}
                onPlaygroundSelect={playground.select}
                anatomyModeActive={anatomy.isActive}
                anatomySelectedId={anatomy.selectedId}
                onAnatomyComponentSelect={anatomy.select}
              />
            </ModelErrorBoundary>
            <LoadingScreen />
          </section>

          <CinematicHero progress={sequenceProgress} active={isContentExperience && isCycleSection} />
          <CinematicNarrative
            progress={sequenceProgress}
            telemetry={sequenceTelemetry}
          />

          {operator.isActive ? (
            <OperatorPanel
              state={operator.state}
              telemetry={operator.telemetry}
              onStartSpindle={operator.startSpindle}
              onEngageTailstock={operator.engageTailstock}
              onIndexTool={operator.indexTool}
              onApproachCut={operator.approachCut}
              onStartCoolant={operator.startCoolant}
              onCompletePass={operator.completePass}
              onReset={operator.reset}
              onExit={operator.exit}
            />
          ) : null}

          {comparison.isActive ? (
            <ProcessComparisonPanel
              state={comparison.state}
              progress={comparison.progress}
              onProgressChange={comparison.setProgress}
              onReset={comparison.reset}
              onExit={comparison.exit}
            />
          ) : null}

          {anatomy.isActive ? (
            <AnatomyPanel
              selectedId={anatomy.selectedId}
              onSelect={anatomy.select}
              onOverview={anatomy.returnToOverview}
              onExit={anatomy.exit}
            />
          ) : null}

          {import.meta.env.DEV && isDevPanelVisible && experienceMode === 'content' ? (
            <DevPanel
              inspection={inspection}
              isChuckTesting={isChuckTesting}
              sequenceState={sequenceState}
              sequenceProgress={sequenceProgress}
              scrollDriverEnabled={scrollDriverEnabled}
              scrollDiagnostics={scrollDiagnostics}
              scrollPacing={scrollPacing}
              scrollLength={getCinematicViewportHeights(scrollPacing)}
              smoothScrollEnabled={smoothScrollEnabled}
              smoothScrollActive={smoothScroll.isActive}
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
              onScrollPacingChange={handleScrollPacingChange}
              onSmoothScrollEnabledChange={setSmoothScrollEnabled}
            />
          ) : null}
        </div>
      </section>

      <PostCinematicIntro />
      <RunTheMachine
        ready={Boolean(inspection) && experienceMode === 'content'}
        onEnter={operator.enter}
      />
      <ProcessPlayground
        sectionRef={playgroundSectionRef}
        isActive={playgroundModeActive}
        interactionEnabled={playgroundModeActive && playgroundReveal.interactionEnabled}
        status={playground.status}
        onReset={playground.reset}
      />
      <MachineAnatomy
        ready={Boolean(inspection) && experienceMode === 'content'}
        onEnter={anatomy.enter}
      />
      <EngineeringExperience />
      <SiteFooter onBackToTop={() => handleSiteNavigation('cycle')} />
    </main>
  )
}

export default App
