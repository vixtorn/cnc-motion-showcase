import { Html } from '@react-three/drei'
import { useMemo } from 'react'
import { Box3, Vector3 } from 'three'
import { CNC_ANATOMY_COMPONENTS } from '../config/cncAnatomyConfig'
import type { CncAnatomyComponentId, CncInspection } from '../types/cnc'

interface AnatomyHotspotsProps {
  inspection: CncInspection
  selectedId: CncAnatomyComponentId | null
  onSelect: (id: CncAnatomyComponentId) => void
}

export function AnatomyHotspots({ inspection, selectedId, onSelect }: AnatomyHotspotsProps) {
  const hotspots = useMemo(
    () =>
      CNC_ANATOMY_COMPONENTS.flatMap((component) => {
        const node = component.getNode(inspection.nodes)
        if (!node) return []
        node.updateWorldMatrix(true, true)
        const bounds = new Box3().setFromObject(node)
        if (bounds.isEmpty()) return []
        const size = bounds.getSize(new Vector3())
        const position = bounds.getCenter(new Vector3())
        position.y += Math.max(size.y * 0.18, 1.5)
        return [{ component, position }]
      }),
    [inspection],
  )

  return hotspots.map(({ component, position }) => (
    <Html key={component.id} position={position} occlude>
      <button
        type="button"
        className={`anatomy-hotspot${selectedId === component.id ? ' is-selected' : ''}`}
        aria-label={`Inspect ${component.label}`}
        aria-pressed={selectedId === component.id}
        onClick={() => onSelect(component.id)}
      >
        <i />
        <span>{component.number}</span>
      </button>
    </Html>
  ))
}
