import type { CncAxis } from './cncAnimationConfig'

export const CNC_MACHINING = {
  timings: {
    cuttingContactDuration: 0.7,
    postContactCoolantDelay: 0.25,
    coolantRampInDuration: 0.45,
    workpieceSwapAfterCoolantStart: 1.3,
    coolantRampOutAfterSwap: 1,
    coolantRampOutDuration: 0.7,
    turretRetractAfterSwap: 1.25,
    turretRetractDuration: 0.8,
    spindleDecelerationAfterSwap: 1.15,
    spindleDecelerationDuration: 1.1,
    inspectionCameraAfterSwap: 1.8,
    inspectionCameraDuration: 1.25,
    inspectionHold: 2,
  },
  turret: {
    contactAdditionalOffsets: {
      x: 2.25,
      z: 0.5,
    } as Partial<Record<CncAxis, number>>,
    inspectionOffsets: {
      x: 3,
      z: 5.5,
    } as Partial<Record<CncAxis, number>>,
  },
  chuck: {
    machiningRpmVisualSpeed: 60 / 4.2,
    inspectionRpmVisualSpeed: 4.5,
  },
  coolant: {
    particleCount: 220,
    emitterPosition: [-7.5, 105, 70] as [number, number, number],
    sprayDirection: [0.25, -0.78, 0.42] as [number, number, number],
    gravity: [0, -18, 0] as [number, number, number],
    spread: 1.15,
    minimumSpeed: 18,
    maximumSpeed: 34,
    minimumLifetime: 0.45,
    maximumLifetime: 0.9,
    color: '#88a9ad',
    minimumOpacity: 0.2,
    maximumOpacity: 0.5,
    minimumSize: 1.7,
    maximumSize: 3.2,
  },
} as const
