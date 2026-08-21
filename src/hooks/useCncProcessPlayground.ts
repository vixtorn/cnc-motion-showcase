import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import type { CNCSceneHandle } from '../scene/CNCScene'
import type { CncProcessPlaygroundId } from '../scene/ProcessPlaygroundInteractionLayer'
import type { CncWorkpieceState } from '../types/cnc'

type TransformationState = 'idle' | 'running'

interface PlaygroundState {
  tailstockEngaged: boolean
  turretActivated: boolean
  coolantActive: boolean
  contactAchieved: boolean
  workpieceState: CncWorkpieceState
  transformation: TransformationState
  processComplete: boolean
}

interface UseCncProcessPlaygroundOptions {
  sceneRef: RefObject<CNCSceneHandle | null>
  active: boolean
  interactionEnabled: boolean
}

const INITIAL_STATE: PlaygroundState = {
  tailstockEngaged: false,
  turretActivated: false,
  coolantActive: false,
  contactAchieved: false,
  workpieceState: 'raw',
  transformation: 'idle',
  processComplete: false,
}

export function useCncProcessPlayground({
  sceneRef,
  active,
  interactionEnabled,
}: UseCncProcessPlaygroundOptions) {
  const [state, setState] = useState<PlaygroundState>(INITIAL_STATE)
  const [hoveredId, setHoveredId] = useState<CncProcessPlaygroundId | null>(null)
  const stateRef = useRef(state)
  const tailstockInFlightRef = useRef(false)
  const turretInFlightRef = useRef(false)
  const transformationInFlightRef = useRef(false)

  useEffect(() => {
    stateRef.current = state
  }, [state])

  const reset = useCallback(() => {
    tailstockInFlightRef.current = false
    turretInFlightRef.current = false
    transformationInFlightRef.current = false
    setHoveredId(null)
    setState(INITIAL_STATE)
    sceneRef.current?.resetProcessPlayground()
  }, [sceneRef])

  const select = useCallback(
    async (id: CncProcessPlaygroundId) => {
      if (!active || !interactionEnabled) return
      const scene = sceneRef.current
      if (!scene) return

      if (id === 'tailstock') {
        if (
          stateRef.current.processComplete ||
          tailstockInFlightRef.current ||
          stateRef.current.tailstockEngaged
        ) {
          return
        }
        tailstockInFlightRef.current = true
        const coolantWasActive = stateRef.current.coolantActive
        const completed = await scene.processPlaygroundEngageTailstock()
        tailstockInFlightRef.current = false
        if (!completed) return
        if (!coolantWasActive) scene.startProcessPlaygroundSparks()
        setState((current) => ({
          ...current,
          tailstockEngaged: true,
          contactAchieved: true,
        }))
        return
      }

      if (
        stateRef.current.processComplete ||
        turretInFlightRef.current ||
        stateRef.current.turretActivated
      ) {
        return
      }
      turretInFlightRef.current = true
      const completed = await scene.processPlaygroundActivateTurret()
      turretInFlightRef.current = false
      if (!completed) return
      setState((current) => ({
        ...current,
        turretActivated: true,
        coolantActive: true,
      }))
    },
    [active, interactionEnabled, sceneRef],
  )

  useEffect(() => {
    const canTransform =
      active &&
      interactionEnabled &&
      state.contactAchieved &&
      state.tailstockEngaged &&
      state.turretActivated &&
      state.coolantActive &&
      state.workpieceState === 'raw' &&
      state.transformation === 'idle' &&
      !state.processComplete
    if (!canTransform || transformationInFlightRef.current) return

    const scene = sceneRef.current
    if (!scene) return
    transformationInFlightRef.current = true
    setState((current) => ({ ...current, transformation: 'running' }))

    void scene.completeProcessPlaygroundTransformation().then((completed) => {
      transformationInFlightRef.current = false
      if (!completed) {
        setState((current) => ({ ...current, transformation: 'idle' }))
        return
      }
      setState((current) => ({
        ...current,
        workpieceState: 'finished',
        transformation: 'idle',
        processComplete: true,
      }))
    })
  }, [active, interactionEnabled, sceneRef, state])

  const selectedIds = useMemo<ReadonlySet<CncProcessPlaygroundId>>(() => {
    const ids = new Set<CncProcessPlaygroundId>()
    if (state.processComplete) return ids
    if (state.tailstockEngaged) ids.add('tailstock')
    if (state.turretActivated) ids.add('turret')
    return ids
  }, [state.processComplete, state.tailstockEngaged, state.turretActivated])

  const status =
    state.processComplete
      ? 'Process complete'
      : state.transformation === 'running'
        ? 'Forming component'
        : state.coolantActive
          ? 'Machining active'
          : state.contactAchieved
            ? 'Contact achieved'
            : 'Cell ready'

  return {
    isComplete: state.processComplete,
    hoveredId,
    selectedIds,
    status,
    reset,
    select,
    setHoveredId,
  }
}
