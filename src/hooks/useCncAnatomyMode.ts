import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import type { CNCSceneHandle } from '../scene/CNCScene'
import type { CncAnatomyComponentId, CncExperienceMode } from '../types/cnc'

interface UseCncAnatomyModeOptions {
  sceneRef: RefObject<CNCSceneHandle | null>
  canEnter: boolean
  onExperienceModeChange: (mode: CncExperienceMode) => void
}

export function useCncAnatomyMode({
  sceneRef,
  canEnter,
  onExperienceModeChange,
}: UseCncAnatomyModeOptions) {
  const [isActive, setIsActive] = useState(false)
  const [selectedId, setSelectedId] = useState<CncAnatomyComponentId | null>(null)
  const activeRef = useRef(false)
  const inFlightRef = useRef(false)
  const returnFocusRef = useRef<HTMLElement | null>(null)

  const enter = useCallback(async () => {
    const scene = sceneRef.current
    if (!canEnter || !scene || activeRef.current || inFlightRef.current) return
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    activeRef.current = true
    inFlightRef.current = true
    onExperienceModeChange('anatomy')
    setIsActive(true)
    setSelectedId(null)
    const completed = await scene.enterAnatomyMode()
    inFlightRef.current = false
    if (completed) return
    activeRef.current = false
    setIsActive(false)
    onExperienceModeChange('content')
  }, [canEnter, onExperienceModeChange, sceneRef])

  const select = useCallback(
    (id: CncAnatomyComponentId) => {
      if (!activeRef.current || inFlightRef.current) return
      sceneRef.current?.focusAnatomyComponent(id)
      setSelectedId(id)
    },
    [sceneRef],
  )

  const returnToOverview = useCallback(() => {
    if (!activeRef.current || inFlightRef.current) return
    sceneRef.current?.returnToAnatomyOverview()
    setSelectedId(null)
  }, [sceneRef])

  const exit = useCallback(async () => {
    if (!activeRef.current || inFlightRef.current) return
    inFlightRef.current = true
    await sceneRef.current?.exitAnatomyMode()
    activeRef.current = false
    inFlightRef.current = false
    setSelectedId(null)
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

  return { isActive, selectedId, enter, select, returnToOverview, exit }
}
