import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import type { CNCSceneHandle } from '../scene/CNCScene'
import type {
  CncExperienceMode,
  CncProcessComparisonState,
} from '../types/cnc'

interface UseCncProcessComparisonOptions {
  sceneRef: RefObject<CNCSceneHandle | null>
  canEnter: boolean
  onExperienceModeChange: (mode: CncExperienceMode) => void
}

export function useCncProcessComparison({
  sceneRef,
  canEnter,
  onExperienceModeChange,
}: UseCncProcessComparisonOptions) {
  const [isActive, setIsActive] = useState(false)
  const [state, setState] = useState<CncProcessComparisonState>('inactive')
  const [progress, setProgressState] = useState(0)
  const activeRef = useRef(false)
  const inFlightRef = useRef(false)
  const generationRef = useRef(0)
  const returnFocusRef = useRef<HTMLElement | null>(null)

  const enter = useCallback(async () => {
    const scene = sceneRef.current
    if (!canEnter || !scene || activeRef.current || inFlightRef.current) return false
    returnFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    generationRef.current += 1
    const generation = generationRef.current
    activeRef.current = true
    inFlightRef.current = true
    onExperienceModeChange('process-comparison')
    setProgressState(0)
    setState('entering')
    setIsActive(true)
    const completed = await scene.enterProcessComparisonMode()
    if (generation !== generationRef.current || !activeRef.current) return false
    inFlightRef.current = false
    if (completed) {
      setState('ready')
      return true
    }
    activeRef.current = false
    setState('inactive')
    setIsActive(false)
    onExperienceModeChange('content')
    return false
  }, [canEnter, onExperienceModeChange, sceneRef])

  const setProgress = useCallback(
    (nextProgress: number) => {
      if (!activeRef.current || inFlightRef.current) return
      const clamped = Math.min(Math.max(nextProgress, 0), 1)
      setProgressState(clamped)
      sceneRef.current?.setProcessComparisonProgress(clamped)
    },
    [sceneRef],
  )

  const reset = useCallback(() => {
    if (!activeRef.current || inFlightRef.current) return
    setProgressState(0)
    sceneRef.current?.resetProcessComparison()
  }, [sceneRef])

  const exit = useCallback(async () => {
    if (!activeRef.current) return
    generationRef.current += 1
    const generation = generationRef.current
    inFlightRef.current = true
    setState('exiting')
    await sceneRef.current?.exitProcessComparisonMode()
    if (generation !== generationRef.current) return
    activeRef.current = false
    inFlightRef.current = false
    setProgressState(0)
    setState('inactive')
    setIsActive(false)
    onExperienceModeChange('content')
    const returnFocus = returnFocusRef.current
    requestAnimationFrame(() => returnFocus?.focus({ preventScroll: true }))
  }, [onExperienceModeChange, sceneRef])

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

  return { isActive, state, progress, enter, exit, reset, setProgress }
}
