import { useCallback, useEffect, useMemo } from 'react'
import { Quaternion, type Object3D } from 'three'

interface WorkpieceHomeTransform {
  position: Object3D['position']
  quaternion: Quaternion
  scale: Object3D['scale']
}

interface UseWorkpieceTransitionOptions {
  raw: Object3D | null
  finished: Object3D | null
  invalidate: () => void
}

export interface WorkpieceTransitionController {
  setWorkpieceState: (state: 'raw' | 'finished') => void
  revealFinishedImmediate: () => void
  resetWorkpieceImmediate: () => void
  getWorkpieceSnapshot: () => Record<string, unknown>
}

const captureHome = (object: Object3D | null): WorkpieceHomeTransform | null =>
  object
    ? {
        position: object.position.clone(),
        quaternion: object.quaternion.clone(),
        scale: object.scale.clone(),
      }
    : null

const restoreHome = (object: Object3D, home: WorkpieceHomeTransform) => {
  object.position.copy(home.position)
  object.quaternion.copy(home.quaternion)
  object.scale.copy(home.scale)
}

export function useWorkpieceTransition({
  raw,
  finished,
  invalidate,
}: UseWorkpieceTransitionOptions): WorkpieceTransitionController {
  const homes = useMemo(
    () => ({ raw: captureHome(raw), finished: captureHome(finished) }),
    [finished, raw],
  )

  const setWorkpieceState = useCallback((state: 'raw' | 'finished') => {
    if (state === 'raw') {
      if (raw?.visible && !finished?.visible) return
      if (raw && homes.raw) restoreHome(raw, homes.raw)
      if (finished && homes.finished) restoreHome(finished, homes.finished)
      if (raw) raw.visible = true
      if (finished) finished.visible = false
      invalidate()
      return
    }

    if (!raw || !finished || !homes.raw || !homes.finished) return
    if (!raw.visible && finished.visible) return
    const localRotationDelta = homes.raw.quaternion
      .clone()
      .invert()
      .multiply(raw.quaternion)
    restoreHome(finished, homes.finished)
    finished.quaternion.multiply(localRotationDelta).normalize()
    finished.visible = true
    raw.visible = false
    finished.updateMatrixWorld(true)
    invalidate()
  }, [finished, homes, invalidate, raw])

  const resetWorkpieceImmediate = useCallback(() => {
    setWorkpieceState('raw')
  }, [setWorkpieceState])

  const revealFinishedImmediate = useCallback(() => {
    const wasFinished = !raw?.visible && Boolean(finished?.visible)
    setWorkpieceState('finished')

    if (import.meta.env.DEV && !wasFinished && raw && finished) {
      console.info(
        `[CNC] Workpiece reveal ${JSON.stringify({
          sharedParent: raw.parent === finished.parent,
          parent: raw.parent?.name ?? null,
          rawVisible: raw.visible,
          finishedVisible: finished.visible,
          rawLocalQuaternion: raw.quaternion
            .toArray()
            .map((value) => Number(value.toFixed(6))),
          finishedLocalQuaternion: finished.quaternion
            .toArray()
            .map((value) => Number(value.toFixed(6))),
          parentWorldQuaternion: raw.parent
            ?.getWorldQuaternion(new Quaternion())
            .toArray()
            .map((value) => Number(value.toFixed(6))),
        })}`,
      )
    }
  }, [finished, raw, setWorkpieceState])

  const getWorkpieceSnapshot = useCallback(
    () => ({
      rawVisible: raw?.visible ?? null,
      finishedVisible: finished?.visible ?? null,
      sharedParent: raw && finished ? raw.parent === finished.parent : null,
      rawLocalQuaternion:
        raw?.quaternion.toArray().map((value) => Number(value.toFixed(6))) ?? null,
      finishedLocalQuaternion:
        finished?.quaternion.toArray().map((value) => Number(value.toFixed(6))) ?? null,
    }),
    [finished, raw],
  )

  useEffect(() => {
    resetWorkpieceImmediate()
    return resetWorkpieceImmediate
  }, [resetWorkpieceImmediate])

  return useMemo(
    () => ({ setWorkpieceState, revealFinishedImmediate, resetWorkpieceImmediate, getWorkpieceSnapshot }),
    [getWorkpieceSnapshot, resetWorkpieceImmediate, revealFinishedImmediate, setWorkpieceState],
  )
}
