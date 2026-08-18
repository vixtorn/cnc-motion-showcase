import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import type { CNCSceneHandle } from '../scene/CNCScene'
import type {
  CncOperatorState,
  CncOperatorTelemetry,
} from '../types/cnc'

interface UseCncOperatorModeOptions {
  sceneRef: RefObject<CNCSceneHandle | null>
}

const TAILSTOCK_ENGAGED_STATES = new Set<CncOperatorState>([
  'tailstock-engaged',
  'indexing-tool',
  'tool-indexed',
  'approaching-cut',
  'cut-position',
  'starting-coolant',
  'coolant-active',
  'completing-pass',
  'cycle-complete',
])

const CUT_POSITION_STATES = new Set<CncOperatorState>([
  'cut-position',
  'starting-coolant',
  'coolant-active',
])

export function useCncOperatorMode({ sceneRef }: UseCncOperatorModeOptions) {
  const [isActive, setIsActive] = useState(false)
  const [state, setState] = useState<CncOperatorState>('inactive')
  const [spindleVisualRpm, setSpindleVisualRpm] = useState(0)
  const activeRef = useRef(false)
  const stateRef = useRef<CncOperatorState>('inactive')
  const inFlightRef = useRef(false)
  const generationRef = useRef(0)
  const returnFocusRef = useRef<HTMLElement | null>(null)

  const publishState = useCallback((nextState: CncOperatorState) => {
    stateRef.current = nextState
    setState(nextState)
  }, [])

  const enter = useCallback(async () => {
    if (activeRef.current || inFlightRef.current || !sceneRef.current) return
    returnFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    generationRef.current += 1
    const generation = generationRef.current
    activeRef.current = true
    inFlightRef.current = true
    setIsActive(true)
    publishState('preparing')
    const completed = await sceneRef.current.enterOperatorMode()
    if (generation !== generationRef.current || !activeRef.current) return
    inFlightRef.current = false
    if (completed) {
      publishState('ready')
      return
    }
    activeRef.current = false
    setIsActive(false)
    publishState('inactive')
  }, [publishState, sceneRef])

  const exit = useCallback(async () => {
    if (!activeRef.current) return
    generationRef.current += 1
    const generation = generationRef.current
    inFlightRef.current = true
    publishState('exiting')
    await sceneRef.current?.exitOperatorMode()
    if (generation !== generationRef.current) return
    activeRef.current = false
    inFlightRef.current = false
    setSpindleVisualRpm(0)
    publishState('inactive')
    setIsActive(false)
    const returnFocus = returnFocusRef.current
    requestAnimationFrame(() => returnFocus?.focus({ preventScroll: true }))
  }, [publishState, sceneRef])

  const reset = useCallback(async () => {
    if (!activeRef.current) return
    generationRef.current += 1
    const generation = generationRef.current
    inFlightRef.current = true
    publishState('resetting')
    const completed = await sceneRef.current?.operatorReset()
    if (generation !== generationRef.current || !activeRef.current) return
    inFlightRef.current = false
    setSpindleVisualRpm(0)
    if (completed) publishState('ready')
  }, [publishState, sceneRef])

  const runStep = useCallback(
    async (
      expected: CncOperatorState,
      pending: CncOperatorState,
      completedState: CncOperatorState,
      command: (scene: CNCSceneHandle) => Promise<boolean>,
    ) => {
      const scene = sceneRef.current
      if (
        !scene ||
        !activeRef.current ||
        inFlightRef.current ||
        stateRef.current !== expected
      ) {
        return
      }
      const generation = generationRef.current
      inFlightRef.current = true
      publishState(pending)
      const completed = await command(scene)
      if (generation !== generationRef.current || !activeRef.current) return
      inFlightRef.current = false
      if (completed) publishState(completedState)
    },
    [publishState, sceneRef],
  )

  const startSpindle = useCallback(
    () =>
      runStep(
        'ready',
        'starting-spindle',
        'spindle-running',
        (scene) => scene.operatorStartSpindle(),
      ),
    [runStep],
  )

  const engageTailstock = useCallback(
    () =>
      runStep(
        'spindle-running',
        'engaging-tailstock',
        'tailstock-engaged',
        (scene) => scene.operatorEngageTailstock(),
      ),
    [runStep],
  )

  const indexTool = useCallback(
    () =>
      runStep(
        'tailstock-engaged',
        'indexing-tool',
        'tool-indexed',
        (scene) => scene.operatorIndexTool(),
      ),
    [runStep],
  )

  const approachCut = useCallback(
    () =>
      runStep(
        'tool-indexed',
        'approaching-cut',
        'cut-position',
        (scene) => scene.operatorApproachCut(),
      ),
    [runStep],
  )

  const startCoolant = useCallback(
    () =>
      runStep(
        'cut-position',
        'starting-coolant',
        'coolant-active',
        (scene) => scene.operatorStartCoolant(),
      ),
    [runStep],
  )

  const completePass = useCallback(
    () =>
      runStep(
        'coolant-active',
        'completing-pass',
        'cycle-complete',
        (scene) => scene.operatorCompletePass(),
      ),
    [runStep],
  )

  useEffect(() => {
    if (!isActive) return
    const publishSpindle = () => {
      const nextRpm = Number(
        (sceneRef.current?.getOperatorSpindleVisualRpm() ?? 0).toFixed(1),
      )
      setSpindleVisualRpm((current) => (current === nextRpm ? current : nextRpm))
    }
    publishSpindle()
    const interval = window.setInterval(publishSpindle, 100)
    return () => window.clearInterval(interval)
  }, [isActive, sceneRef])

  useEffect(() => {
    if (!isActive) return
    const body = document.body
    const previousOverflow = body.style.overflow
    const previousPaddingRight = body.style.paddingRight
    const scrollbarGap = window.innerWidth - document.documentElement.clientWidth
    body.style.overflow = 'hidden'
    if (scrollbarGap > 0) body.style.paddingRight = `${scrollbarGap}px`
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      void exit()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      body.style.overflow = previousOverflow
      body.style.paddingRight = previousPaddingRight
    }
  }, [exit, isActive])

  const telemetry = useMemo<CncOperatorTelemetry>(() => {
    const tailstock =
      state === 'engaging-tailstock'
        ? 'moving'
        : TAILSTOCK_ENGAGED_STATES.has(state)
          ? 'engaged'
          : 'home'
    const turret =
      state === 'indexing-tool'
        ? 'indexing'
        : state === 'tool-indexed'
          ? 'indexed'
          : state === 'approaching-cut'
            ? 'approaching'
            : CUT_POSITION_STATES.has(state)
              ? 'cut-position'
              : state === 'completing-pass'
                ? 'returning'
                : state === 'cycle-complete'
                  ? 'carriage-home'
                : 'home'
    return {
      spindleVisualRpm,
      tailstock,
      turret,
      coolantActive: state === 'coolant-active',
      workpieceState:
        state === 'completing-pass' || state === 'cycle-complete'
          ? 'finished'
          : 'raw',
    }
  }, [spindleVisualRpm, state])

  return {
    isActive,
    state,
    telemetry,
    enter,
    exit,
    reset,
    startSpindle,
    engageTailstock,
    indexTool,
    approachCut,
    startCoolant,
    completePass,
  }
}
