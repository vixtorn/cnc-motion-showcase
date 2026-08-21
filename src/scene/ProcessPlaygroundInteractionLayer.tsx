import { useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { Mesh, Raycaster, Vector2, type Object3D } from 'three'
import {
  ANATOMY_INTERACTION_COLORS,
  ANATOMY_OUTLINE_THICKNESS,
} from '../config/cncAnatomyConfig'
import type { CncInspection } from '../types/cnc'
import { InteractiveMeshOutline } from './InteractiveMeshOutline'

export type CncProcessPlaygroundId = 'tailstock' | 'turret'

interface ProcessPlaygroundInteractionLayerProps {
  inspection: CncInspection
  enabled: boolean
  selectedIds: ReadonlySet<CncProcessPlaygroundId>
  hoveredId: CncProcessPlaygroundId | null
  onHoverChange: (id: CncProcessPlaygroundId | null) => void
  onSelect: (id: CncProcessPlaygroundId) => void
}

const CLICK_DRAG_THRESHOLD = 6

const getMeshes = (root: Object3D | null) => {
  if (!root) return []
  const meshes: Mesh[] = []
  root.traverse((object) => {
    if (object instanceof Mesh) meshes.push(object)
  })
  return meshes
}

const getOutlineState = (
  id: CncProcessPlaygroundId,
  selectedIds: ReadonlySet<CncProcessPlaygroundId>,
  hoveredId: CncProcessPlaygroundId | null,
) => (selectedIds.has(id) ? 'selected' : hoveredId === id ? 'hovered' : 'idle')

export function ProcessPlaygroundInteractionLayer({
  inspection,
  enabled,
  selectedIds,
  hoveredId,
  onHoverChange,
  onSelect,
}: ProcessPlaygroundInteractionLayerProps) {
  const { camera, gl, invalidate } = useThree()
  const pointerDown = useRef<{ x: number; y: number } | null>(null)
  const hoveredRef = useRef<CncProcessPlaygroundId | null>(hoveredId)
  const raycaster = useMemo(() => new Raycaster(), [])
  const pointer = useMemo(() => new Vector2(), [])
  const components = useMemo(
    () => [
      { id: 'tailstock' as const, meshes: getMeshes(inspection.nodes.tailstock) },
      { id: 'turret' as const, meshes: getMeshes(inspection.nodes.turretCarriage) },
    ],
    [inspection],
  )
  const meshToComponent = useMemo(() => {
    const map = new Map<Mesh, CncProcessPlaygroundId>()
    components.forEach(({ id, meshes }) => meshes.forEach((mesh) => map.set(mesh, id)))
    return map
  }, [components])
  const pickableMeshes = useMemo(() => [...meshToComponent.keys()], [meshToComponent])

  useEffect(() => {
    hoveredRef.current = hoveredId
  }, [hoveredId])

  useEffect(() => {
    if (!enabled) return
    const canvas = gl.domElement
    const previousCursor = canvas.style.cursor
    const getComponentAtEvent = (event: PointerEvent) => {
      const bounds = canvas.getBoundingClientRect()
      pointer.set(
        ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
        -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
      )
      raycaster.setFromCamera(pointer, camera)
      const hit = raycaster.intersectObjects(pickableMeshes, false)[0]
      return hit ? meshToComponent.get(hit.object as Mesh) ?? null : null
    }
    const setHovered = (id: CncProcessPlaygroundId | null) => {
      if (hoveredRef.current === id) return
      hoveredRef.current = id
      canvas.style.cursor = id ? 'pointer' : previousCursor
      onHoverChange(id)
      invalidate()
    }
    const handlePointerMove = (event: PointerEvent) => setHovered(getComponentAtEvent(event))
    const handlePointerLeave = () => setHovered(null)
    const handlePointerDown = (event: PointerEvent) => {
      pointerDown.current = { x: event.clientX, y: event.clientY }
    }
    const handlePointerUp = (event: PointerEvent) => {
      const start = pointerDown.current
      pointerDown.current = null
      if (!start || Math.hypot(event.clientX - start.x, event.clientY - start.y) > CLICK_DRAG_THRESHOLD) {
        return
      }
      const id = getComponentAtEvent(event)
      if (id) onSelect(id)
    }

    canvas.addEventListener('pointermove', handlePointerMove)
    canvas.addEventListener('pointerleave', handlePointerLeave)
    canvas.addEventListener('pointerdown', handlePointerDown)
    canvas.addEventListener('pointerup', handlePointerUp)
    return () => {
      canvas.removeEventListener('pointermove', handlePointerMove)
      canvas.removeEventListener('pointerleave', handlePointerLeave)
      canvas.removeEventListener('pointerdown', handlePointerDown)
      canvas.removeEventListener('pointerup', handlePointerUp)
      canvas.style.cursor = previousCursor
      pointerDown.current = null
      if (hoveredRef.current !== null) onHoverChange(null)
    }
  }, [camera, enabled, gl, invalidate, meshToComponent, onHoverChange, onSelect, pickableMeshes, pointer, raycaster])

  return components.flatMap(({ id, meshes }) => {
    const state = getOutlineState(id, selectedIds, hoveredId)
    return meshes.map((mesh) => (
      <InteractiveMeshOutline
        key={mesh.uuid}
        mesh={mesh}
        color={ANATOMY_INTERACTION_COLORS[state]}
        thickness={ANATOMY_OUTLINE_THICKNESS[state]}
      />
    ))
  })
}
