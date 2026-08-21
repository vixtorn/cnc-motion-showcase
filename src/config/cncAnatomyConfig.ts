import type { CncAnatomyComponentId, CncNodes } from '../types/cnc'
import { Mesh, type Object3D } from 'three'

export interface AnatomyCameraPreset {
  position: readonly [number, number, number]
  target: readonly [number, number, number]
  fov: number
}

export interface AnatomyComponentDefinition {
  id: CncAnatomyComponentId
  number: string
  label: string
  description: string
  facts: readonly { label: string; value: string }[]
  camera: AnatomyCameraPreset
  getNode: (nodes: CncNodes) => Object3D | null
  getInteractionExclusions?: (nodes: CncNodes) => readonly (Object3D | null)[]
}

export const ANATOMY_INTERACTION_COLORS = {
  idle: '#D9953F',
  hovered: '#FFC266',
  selected: '#F0A64A',
} as const

export const ANATOMY_OUTLINE_THICKNESS = {
  idle: 1.1,
  hovered: 1.65,
  selected: 2,
} as const

export const CNC_ANATOMY_COMPONENTS: readonly AnatomyComponentDefinition[] = [
  {
    id: 'chuck',
    number: '01',
    label: 'Chuck',
    description: 'Rotates and holds the workpiece during the simulated machining cycle.',
    facts: [{ label: 'ROLE', value: 'WORKHOLDING / ROTATION' }],
    camera: {
      position: [68, 136, 38],
      target: [0, 112, 68],
      fov: 48,
    },
    getNode: (nodes) => nodes.mainChuck,
    getInteractionExclusions: (nodes) => [nodes.workpiece, nodes.finishedWorkpiece],
  },
  {
    id: 'turret',
    number: '02',
    label: 'Turret system',
    description:
      'The carriage positions the tooling assembly while the index assembly rotates the active toolset.',
    facts: [
      { label: 'MOTION', value: 'CARRIAGE POSITIONING' },
      { label: 'INDEX', value: 'TOOLING ASSEMBLY' },
    ],
    camera: {
      position: [12, 139, 88],
      target: [-39.4192, 129.1573, 57.767],
      fov: 50,
    },
    getNode: (nodes) => nodes.turretCarriage,
  },
  {
    id: 'tailstock',
    number: '03',
    label: 'Tailstock',
    description: 'Moves into contact to support the workpiece opposite the chuck.',
    facts: [{ label: 'MOTION', value: 'LONGITUDINAL SUPPORT' }],
    camera: {
      position: [43, 116, 68],
      target: [-7.7141, 98.8221, 44.6632],
      fov: 50,
    },
    getNode: (nodes) => nodes.tailstock,
  },
  {
    id: 'workpiece',
    number: '04',
    label: 'Finished workpiece',
    description:
      'The inspection view presents the finished camshaft geometry used by the project’s raw-to-finished transition.',
    facts: [{ label: 'STATE', value: 'FINISHED CAMSHAFT' }],
    camera: {
      position: [31.7306, 121.3334, 51.425],
      target: [-7.7141, 100.8221, 74.303],
      fov: 45,
    },
    getNode: (nodes) => nodes.finishedWorkpiece,
  },
  {
    id: 'door',
    number: '05',
    label: 'Front door',
    description: 'Opens to reveal the work envelope for inspection and the simulated machining sequence.',
    facts: [{ label: 'STATE', value: 'OPEN FOR INSPECTION' }],
    camera: {
      position: [54, 132, 60],
      target: [-12, 113, 78],
      fov: 54,
    },
    getNode: (nodes) => nodes.door,
  },
]

export const getAnatomyComponent = (id: CncAnatomyComponentId) =>
  CNC_ANATOMY_COMPONENTS.find((component) => component.id === id) ?? null

const isDescendantOf = (child: Object3D, parent: Object3D) => {
  let current: Object3D | null = child
  while (current) {
    if (current === parent) return true
    current = current.parent
  }
  return false
}

export const getAnatomyComponentMeshes = (
  component: AnatomyComponentDefinition,
  nodes: CncNodes,
) => {
  const root = component.getNode(nodes)
  if (!root) return []

  const exclusions = component
    .getInteractionExclusions?.(nodes)
    .filter((node): node is Object3D => node !== null) ?? []
  const meshes: Mesh[] = []
  root.traverse((object) => {
    if (
      object instanceof Mesh &&
      !exclusions.some((excluded) => isDescendantOf(object, excluded))
    ) {
      meshes.push(object)
    }
  })
  return meshes
}
