import { Outlines } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { Mesh, Raycaster, Vector2 } from 'three'
import {
  ANATOMY_INTERACTION_COLORS,
  ANATOMY_OUTLINE_THICKNESS,
  CNC_ANATOMY_COMPONENTS,
  getAnatomyComponentMeshes,
} from '../config/cncAnatomyConfig'
import type { CncAnatomyComponentId, CncInspection } from '../types/cnc'

interface AnatomyInteractionLayerProps {
  inspection: CncInspection
  selectedId: CncAnatomyComponentId | null
  hoveredId: CncAnatomyComponentId | null
  onHoverChange: (id: CncAnatomyComponentId | null) => void
  onSelect: (id: CncAnatomyComponentId) => void
}

const CLICK_DRAG_THRESHOLD = 6

const getOutlineState = (
  id: CncAnatomyComponentId,
  selectedId: CncAnatomyComponentId | null,
  hoveredId: CncAnatomyComponentId | null,
) => {
  if (selectedId === id) return 'selected'
  if (hoveredId === id) return 'hovered'
  return 'idle'
}

function AnatomyMeshOutline({
  mesh,
  color,
  thickness,
}: {
  mesh: Mesh
  color: string
  thickness: number
}) {
  mesh.updateWorldMatrix(true, false)

  return (
    <mesh
      geometry={mesh.geometry}
      matrix={mesh.matrixWorld}
      matrixAutoUpdate={false}
      frustumCulled={false}
    >
      <meshBasicMaterial colorWrite={false} depthWrite={false} />
      <Outlines
        angle={0}
        color={color}
        thickness={thickness}
        renderOrder={2}
        toneMapped={false}
      />
    </mesh>
  )
}

export function AnatomyInteractionLayer({
  inspection,
  selectedId,
  hoveredId,
  onHoverChange,
  onSelect,
}: AnatomyInteractionLayerProps) {
  const { camera, gl, invalidate } = useThree()
  const pointerDown = useRef<{ x: number; y: number } | null>(null)
  const hoveredRef = useRef<CncAnatomyComponentId | null>(hoveredId)
  const raycaster = useMemo(() => new Raycaster(), [])
  const pointer = useMemo(() => new Vector2(), [])
  const componentMeshes = useMemo(
    () =>
      CNC_ANATOMY_COMPONENTS.map((component) => ({
        id: component.id,
        meshes: getAnatomyComponentMeshes(component, inspection.nodes),
      })),
    [inspection],
  )
  const meshToComponent = useMemo(() => {
    const map = new Map<Mesh, CncAnatomyComponentId>()
    componentMeshes.forEach(({ id, meshes }) => meshes.forEach((mesh) => map.set(mesh, id)))
    return map
  }, [componentMeshes])
  const pickableMeshes = useMemo(() => [...meshToComponent.keys()], [meshToComponent])

  useEffect(() => {
    if (!import.meta.env.DEV) return
    console.info(
      `[CNC] Anatomy interaction meshes ${JSON.stringify(
        Object.fromEntries(componentMeshes.map(({ id, meshes }) => [id, meshes.length])),
      )}`,
    )
  }, [componentMeshes])

  useEffect(() => {
    hoveredRef.current = hoveredId
  }, [hoveredId])

  useEffect(() => {
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
    const setHovered = (id: CncAnatomyComponentId | null) => {
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
      if (!start) return
      if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > CLICK_DRAG_THRESHOLD) return
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
  }, [camera, gl, invalidate, meshToComponent, onHoverChange, onSelect, pickableMeshes, pointer, raycaster])

  return componentMeshes.flatMap(({ id, meshes }) => {
    const state = getOutlineState(id, selectedId, hoveredId)
    return meshes.map((mesh) => (
      <AnatomyMeshOutline
        key={mesh.uuid}
        mesh={mesh}
        color={ANATOMY_INTERACTION_COLORS[state]}
        thickness={ANATOMY_OUTLINE_THICKNESS[state]}
      />
    ))
  })
}
