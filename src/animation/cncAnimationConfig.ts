export const CNC_MODEL_URL = '/models/CNC_V1_ExportTest_01.glb'

export const CNC_NODE_NAMES = {
  staticBody: 'CNC_StaticBody',
  mainChuck: 'MainChuck_Assembly',
  mainChuckBody: 'MainChuck_Body',
  workpiece: 'Workpiece_Raw',
  finishedWorkpiece: 'Workpiece_Finished_Camshaft',
  tailstock: 'Tailstock_MovingAssembly',
  tailstockQuill: 'Tailstock_Quill',
  tailstockTip: 'Tailstock_Tip',
  turretCarriage: 'Turret_CarriageAssembly',
  turretIndex: 'Turret_IndexAssembly',
  turretLegacyAssembly: 'Turret_Assembly',
  turretBody: 'Turret_Body',
  turretToolBlocks: 'Turret_ToolBlocks',
  turretCenterHub: 'Turret_CenterHub',
  door: 'FrontDoor_Assembly',
  doorBody: 'FrontDoor_Body',
  doorGlass: 'FrontDoor_Window',
  doorLowerStrip: 'FrontDoor_LowerStrip',
  doorFixedFrame: 'FrontDoor_FixedFrame',
  dumanBadge: 'DUMAN_Badge',
} as const

export const CHUCK_ROTATION_DURATION = 5

export const CHUCK_ROTATION_AXIS = 'z' as const

export const TURRET_INDEX_AXIS = 'z' as const

export const CNC_AXIS_OPTIONS = ['x', 'y', 'z'] as const

export type CncAxis = (typeof CNC_AXIS_OPTIONS)[number]

export const CNC_MOTION_CALIBRATION = {
  translationTestDistance: 12,
  tailstockContactDistance: 10.6128,
  doorOpenDistance: 44,
  turretIndexStepRadians: Math.PI / 6,
  translationDuration: 0.55,
  rotationDuration: 0.55,
  resetDuration: 0.45,
} as const
