import { useCallback, useEffect, useMemo, useRef } from 'react'
import {
  Box3,
  Matrix4,
  Plane,
  Quaternion,
  Vector3,
  type Material,
  type Mesh,
  type Object3D,
} from 'three'
import type { CncProcessComparisonSnapshot } from '../types/cnc'

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
  beginWorkpieceComparison: () => boolean
  setWorkpieceComparisonProgress: (progress: number) => void
  endWorkpieceComparison: (finalState?: 'raw' | 'finished') => void
  getWorkpieceComparisonSnapshot: () => CncProcessComparisonSnapshot
  getWorkpieceSnapshot: () => Record<string, unknown>
}

interface MaterialAssignment {
  mesh: Mesh
  original: Material | Material[]
  comparison: Material | Material[]
}

interface ComparisonSession {
  axis: 'x' | 'y' | 'z'
  axisWorld: Vector3
  parent: Object3D
  minimum: number
  maximum: number
  progress: number
  rawPlane: Plane
  finishedPlane: Plane
  assignments: MaterialAssignment[]
  clones: Material[]
}

const AXES = ['x', 'y', 'z'] as const

const collectMeshes = (root: Object3D) => {
  const meshes: Mesh[] = []
  root.traverse((object) => {
    if ('isMesh' in object && object.isMesh) meshes.push(object as Mesh)
  })
  return meshes
}

const createParentSpaceBounds = (root: Object3D, parent: Object3D) => {
  const bounds = new Box3()
  const inverseParent = parent.matrixWorld.clone().invert()
  root.traverse((object) => {
    if (!('isMesh' in object) || !object.isMesh) return
    const mesh = object as Mesh
    const geometry = mesh.geometry
    geometry.computeBoundingBox()
    if (!geometry.boundingBox) return
    const toParent = new Matrix4().multiplyMatrices(inverseParent, mesh.matrixWorld)
    bounds.union(geometry.boundingBox.clone().applyMatrix4(toParent))
  })
  return bounds
}

const cloneAssignments = (root: Object3D, clippingPlane: Plane) => {
  const cloneCache = new Map<Material, Material>()
  const assignments = collectMeshes(root).map<MaterialAssignment>((mesh) => {
    const cloneMaterial = (material: Material) => {
      const cached = cloneCache.get(material)
      if (cached) return cached
      const clone = material.clone()
      clone.clippingPlanes = [clippingPlane]
      clone.clipIntersection = false
      clone.needsUpdate = true
      cloneCache.set(material, clone)
      return clone
    }
    const original = mesh.material
    const comparison = Array.isArray(original)
      ? original.map(cloneMaterial)
      : cloneMaterial(original)
    return { mesh, original, comparison }
  })
  return { assignments, clones: [...cloneCache.values()] }
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
  const comparisonRef = useRef<ComparisonSession | null>(null)
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

  const restoreComparisonMaterials = useCallback(() => {
    const session = comparisonRef.current
    if (!session) return
    for (const assignment of session.assignments) {
      assignment.mesh.material = assignment.original
    }
    for (const material of session.clones) material.dispose()
    comparisonRef.current = null
  }, [])

  const beginWorkpieceComparison = useCallback(() => {
    if (
      !raw ||
      !finished ||
      !homes.raw ||
      !homes.finished ||
      !raw.parent ||
      raw.parent !== finished.parent
    ) {
      return false
    }
    const parent = raw.parent
    restoreComparisonMaterials()
    restoreHome(raw, homes.raw)
    restoreHome(finished, homes.finished)
    parent.updateMatrixWorld(true)

    const rawBounds = createParentSpaceBounds(raw, parent)
    const finishedBounds = createParentSpaceBounds(finished, parent)
    const unionBounds = rawBounds.clone().union(finishedBounds)
    const size = unionBounds.getSize(new Vector3())
    const dimensions = [size.x, size.y, size.z]
    const axisIndex = dimensions.indexOf(Math.max(...dimensions))
    const axis = AXES[axisIndex]
    const axisLocal = new Vector3(
      axis === 'x' ? 1 : 0,
      axis === 'y' ? 1 : 0,
      axis === 'z' ? 1 : 0,
    )
    const axisWorld = axisLocal.clone().transformDirection(parent.matrixWorld)
    const rawPlane = new Plane(axisWorld.clone(), 0)
    const finishedPlane = new Plane(axisWorld.clone().negate(), 0)
    const rawResources = cloneAssignments(raw, rawPlane)
    const finishedResources = cloneAssignments(finished, finishedPlane)
    const minimum = unionBounds.min.getComponent(axisIndex)
    const maximum = unionBounds.max.getComponent(axisIndex)
    comparisonRef.current = {
      axis,
      axisWorld,
      parent,
      minimum,
      maximum,
      progress: 0,
      rawPlane,
      finishedPlane,
      assignments: [...rawResources.assignments, ...finishedResources.assignments],
      clones: [...rawResources.clones, ...finishedResources.clones],
    }
    raw.visible = true
    finished.visible = false
    invalidate()

    if (import.meta.env.DEV) {
      console.info(
        `[CNC] Workpiece comparison resources ${JSON.stringify({
          rawMeshes: rawResources.assignments.length,
          finishedMeshes: finishedResources.assignments.length,
          clonedMaterials: rawResources.clones.length + finishedResources.clones.length,
          clippingPlanes: 2,
          sharedParent: parent.name,
          longitudinalAxis: axis,
          parentSpaceRange: [Number(minimum.toFixed(6)), Number(maximum.toFixed(6))],
        })}`,
      )
    }
    return true
  }, [finished, homes, invalidate, raw, restoreComparisonMaterials])

  const setWorkpieceComparisonProgress = useCallback(
    (progress: number) => {
      const session = comparisonRef.current
      if (!session || !raw || !finished || !homes.raw || !homes.finished) return
      const clamped = Math.min(Math.max(progress, 0), 1)
      session.progress = clamped

      if (clamped <= 0) {
        for (const assignment of session.assignments) {
          assignment.mesh.material = assignment.original
        }
        setWorkpieceState('raw')
        return
      }
      if (clamped >= 1) {
        for (const assignment of session.assignments) {
          assignment.mesh.material = assignment.original
        }
        setWorkpieceState('finished')
        return
      }

      restoreHome(raw, homes.raw)
      restoreHome(finished, homes.finished)
      const localRotationDelta = homes.raw.quaternion
        .clone()
        .invert()
        .multiply(raw.quaternion)
      finished.quaternion.multiply(localRotationDelta).normalize()
      for (const assignment of session.assignments) {
        assignment.mesh.material = assignment.comparison
      }
      session.parent.updateMatrixWorld(true)
      session.axisWorld
        .copy(
          new Vector3(
            session.axis === 'x' ? 1 : 0,
            session.axis === 'y' ? 1 : 0,
            session.axis === 'z' ? 1 : 0,
          ),
        )
        .transformDirection(session.parent.matrixWorld)
      const axisIndex = AXES.indexOf(session.axis)
      const threshold = session.minimum + (session.maximum - session.minimum) * clamped
      const planePoint = new Vector3().setComponent(axisIndex, threshold)
      session.parent.localToWorld(planePoint)
      const worldThreshold = session.axisWorld.dot(planePoint)
      session.rawPlane.normal.copy(session.axisWorld)
      session.rawPlane.constant = -worldThreshold
      session.finishedPlane.normal.copy(session.axisWorld).negate()
      session.finishedPlane.constant = worldThreshold
      raw.visible = true
      finished.visible = true
      raw.updateMatrixWorld(true)
      finished.updateMatrixWorld(true)
      invalidate()
    },
    [finished, homes, invalidate, raw, setWorkpieceState],
  )

  const endWorkpieceComparison = useCallback(
    (finalState: 'raw' | 'finished' = 'raw') => {
      const session = comparisonRef.current
      if (session && import.meta.env.DEV) {
        console.info(
          `[CNC] Workpiece comparison cleanup ${JSON.stringify({
            restoredAssignments: session.assignments.length,
            disposedMaterials: session.clones.length,
            clippingPlanesRemoved: 2,
          })}`,
        )
      }
      restoreComparisonMaterials()
      setWorkpieceState(finalState)
    },
    [restoreComparisonMaterials, setWorkpieceState],
  )

  const getWorkpieceComparisonSnapshot = useCallback((): CncProcessComparisonSnapshot => {
    const session = comparisonRef.current
    return {
      active: Boolean(session),
      progress: session?.progress ?? 0,
      longitudinalAxis: session?.axis ?? null,
      rawVisible: raw?.visible ?? null,
      finishedVisible: finished?.visible ?? null,
      clonedMaterialCount: session?.clones.length ?? 0,
      clippingPlaneCount: session ? 2 : 0,
    }
  }, [finished, raw])

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
    return () => {
      restoreComparisonMaterials()
      resetWorkpieceImmediate()
    }
  }, [resetWorkpieceImmediate, restoreComparisonMaterials])

  return useMemo(
    () => ({
      setWorkpieceState,
      revealFinishedImmediate,
      resetWorkpieceImmediate,
      beginWorkpieceComparison,
      setWorkpieceComparisonProgress,
      endWorkpieceComparison,
      getWorkpieceComparisonSnapshot,
      getWorkpieceSnapshot,
    }),
    [
      beginWorkpieceComparison,
      endWorkpieceComparison,
      getWorkpieceComparisonSnapshot,
      getWorkpieceSnapshot,
      resetWorkpieceImmediate,
      revealFinishedImmediate,
      setWorkpieceComparisonProgress,
      setWorkpieceState,
    ],
  )
}
