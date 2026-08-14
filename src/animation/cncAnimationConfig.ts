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
  turret: 'Turret_Assembly',
  turretBody: 'Turret_Body',
  turretToolBlocks: 'Turret_ToolBlocks',
  door: 'FrontDoor_Assembly',
  doorGlass: 'FrontDoor_Window',
} as const

export const CHUCK_ROTATION_DURATION = 5

export const CHUCK_ROTATION_AXIS = 'z' as const

export const CNC_AXIS_OPTIONS = ['x', 'y', 'z'] as const

export type CncAxis = (typeof CNC_AXIS_OPTIONS)[number]
