import type { CncAxis } from './cncAnimationConfig'

export const CNC_CHOREOGRAPHY = {
  timings: {
    establishingHold: 0.5,
    doorOpenDuration: 1.7,
    cameraEntryDelay: 1,
    interiorSettleHold: 0.65,
    chuckSlowSpinDuration: 0.5,
    chuckAccelerationDuration: 1,
    tailstockAfterChuckStart: 0.9,
    tailstockDuration: 1.3,
    spindleToTurretHold: 0.75,
    turretLongitudinalDuration: 1,
    mechanicalTransitionGap: 0.05,
    turretIndexDuration: 0.7,
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
  productionMotion: {
    speedMultiplier: 0.6,
    cameraEase: 'sine.inOut',
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
