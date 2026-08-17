import type { Box3, Euler, Object3D, Vector3 } from 'three'

export type CalibrationDirection = -1 | 1

export type CncSequenceState = 'idle' | 'playing' | 'paused' | 'complete'

export type CncWorkpieceState = 'raw' | 'finished'

export interface CncSequenceTelemetry {
  spindleVisualRpm: number
  turretOffsetX: number
  turretOffsetZ: number
  turretIndexDegrees: number
  coolantActive: boolean
  coolantIntensity: number
  workpieceState: CncWorkpieceState
}

export const INITIAL_CNC_SEQUENCE_TELEMETRY: CncSequenceTelemetry = {
  spindleVisualRpm: 0,
  turretOffsetX: 0,
  turretOffsetZ: 0,
  turretIndexDegrees: 0,
  coolantActive: false,
  coolantIntensity: 0,
  workpieceState: 'raw',
}

export interface HomeTransform {
  readonly position: Vector3
  readonly rotation: Euler
  readonly scale: Vector3
}

export type CncHomeTransforms = Record<
  'mainChuck' | 'tailstock' | 'turretCarriage' | 'turretIndex' | 'door',
  HomeTransform | null
>

export type NodeCheckKey =
  | 'mainChuck'
  | 'workpiece'
  | 'finishedWorkpiece'
  | 'tailstock'
  | 'turretCarriage'
  | 'turretIndex'
  | 'turretRearSleeve'
  | 'turretCenterHub'
  | 'door'
  | 'doorGlass'
  | 'doorLowerStrip'

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
  turretCarriage: Object3D | null
  turretIndex: Object3D | null
  turretLegacyAssembly: Object3D | null
  turretBody: Object3D | null
  turretToolBlocks: Object3D | null
  turretRearSleeve: Object3D | null
  turretCenterHub: Object3D | null
  door: Object3D | null
  doorBody: Object3D | null
  doorGlass: Object3D | null
  doorLowerStrip: Object3D | null
  doorFixedFrame: Object3D | null
  dumanBadge: Object3D | null
}

export interface DumanBadgeDiagnostic {
  actualName: string
  parent: string
  material: string
  boundsMin: string
  boundsMax: string
  boundsSize: string
  worldPosition: string
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
  envMapPresent: boolean
  envMapIntensity: number
  mapPresent: boolean
  normalMapPresent: boolean
  roughnessMapPresent: boolean
  metalnessMapPresent: boolean
  vertexColors: boolean
  toneMapped: boolean
  transparent: boolean
  opacity: number
  side: string
}

export interface CncInspection {
  nodes: CncNodes
  checks: CncNodeChecks
  bounds: Box3
  interiorBounds: Box3 | null
  finishedWorkpieceBounds: Box3 | null
  dumanBadgeBounds: Box3 | null
  dumanBadgeDiagnostic: DumanBadgeDiagnostic | null
  auditRows: SceneAuditRow[]
  glassDiagnostics: MaterialDiagnostic[]
  workpieceDiagnostics: PbrMaterialDiagnostic[]
  tailstockQuillDiagnostics: PbrMaterialDiagnostic[]
  representativeMetalDiagnostics: PbrMaterialDiagnostic[]
  warnings: string[]
  printAudit: () => void
}
