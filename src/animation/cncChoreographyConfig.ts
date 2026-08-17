import type { CncAxis } from './cncAnimationConfig'

export const CNC_CHOREOGRAPHY = {
  timings: {
    establishingHold: 0.5,
    doorOpenDuration: 1.7,
    cameraEntryDelay: 1,
    chuckStartTime: 5.35,
    chuckSlowSpinDuration: 0.5,
    chuckAccelerationDuration: 1,
    tailstockStartTime: 6.25,
    tailstockDuration: 1.3,
    turretLongitudinalStartTime: 7.6,
    turretLongitudinalDuration: 1,
    turretIndexStartTime: 8.65,
    turretIndexDuration: 0.7,
    turretRadialStartTime: 9.4,
  },
  turret: {
    longitudinalAxis: 'z' as CncAxis,
    longitudinalOffset: 6,
    sequenceIndexAngleDeg: 30,
    sequenceIndexRadians: Math.PI / 6,
  },
  reducedMotion: {
    durationScale: 0.08,
    minimumDuration: 0.04,
  },
  cameraSpeed: {
    defaultMultiplier: 0.7,
    minimumMultiplier: 0.4,
    maximumMultiplier: 1.2,
    step: 0.05,
  },
  chuckStartup: {
    slowSpinRpmVisualSpeed: 2.5,
  },
} as const

export function getEffectiveCameraDuration(
  baseDuration: number,
  cameraSpeedMultiplier: number,
) {
  return baseDuration / cameraSpeedMultiplier
}
