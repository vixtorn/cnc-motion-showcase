import type { Box3, Euler, Object3D, Vector3 } from 'three'

export type CalibrationAssembly = 'tailstock' | 'turret' | 'door'

export type CalibrationDirection = -1 | 1

export interface HomeTransform {
  readonly position: Vector3
  readonly rotation: Euler
  readonly scale: Vector3
}

export type CncHomeTransforms = Record<
  'mainChuck' | CalibrationAssembly,
  HomeTransform | null
>

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
  finishedWorkpiece: Object3D | null
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

export interface PbrMaterialDiagnostic {
  objectName: string
  materialName: string
  materialType: string
  baseColor: string
  metalness: number
  roughness: number
  envMapIntensity: number
}

export interface CncInspection {
  nodes: CncNodes
  checks: CncNodeChecks
  bounds: Box3
  auditRows: SceneAuditRow[]
  glassDiagnostics: MaterialDiagnostic[]
  workpieceDiagnostics: PbrMaterialDiagnostic[]
  tailstockQuillDiagnostics: PbrMaterialDiagnostic[]
  warnings: string[]
  printAudit: () => void
}
