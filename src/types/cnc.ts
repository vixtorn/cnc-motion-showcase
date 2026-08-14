import type { Box3, Object3D } from 'three'

export type NodeCheckKey =
  | 'mainChuck'
  | 'workpiece'
  | 'tailstock'
  | 'turret'
  | 'door'
  | 'doorGlass'

export type CncNodeChecks = Record<NodeCheckKey, boolean>

export interface CncNodes {
  staticBody: Object3D | null
  mainChuck: Object3D | null
  mainChuckBody: Object3D | null
  workpiece: Object3D | null
  tailstock: Object3D | null
  tailstockQuill: Object3D | null
  tailstockTip: Object3D | null
  turret: Object3D | null
  turretBody: Object3D | null
  turretToolBlocks: Object3D | null
  door: Object3D | null
  doorGlass: Object3D | null
}

export interface SceneAuditRow {
  name: string
  type: string
  parent: string
  position: string
  rotation: string
  scale: string
  visible: boolean
  material: string
  triangles: number | string
}

export interface MaterialDiagnostic {
  objectName: string
  materialName: string
  transparent: boolean
  opacity: number
  transmission: number | 'n/a'
  depthWrite: boolean
  side: string
}

export interface CncInspection {
  nodes: CncNodes
  checks: CncNodeChecks
  bounds: Box3
  auditRows: SceneAuditRow[]
  glassDiagnostics: MaterialDiagnostic[]
  warnings: string[]
  printAudit: () => void
}
