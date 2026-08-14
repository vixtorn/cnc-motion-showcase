import type { CncAxis } from './cncAnimationConfig'

export const CNC_CHOREOGRAPHY = {
  timings: {
    establishingHold: 0.5,
    doorOpenDuration: 1.7,
    postDoorHold: 0.5,
    chuckStartTime: 5.35,
    chuckRampDuration: 0.85,
    tailstockStartTime: 6.25,
    tailstockDuration: 1.3,
    turretLongitudinalStartTime: 7.6,
    turretLongitudinalDuration: 1,
    turretIndexStartTime: 8.65,
    turretIndexDuration: 0.7,
    turretRadialStartTime: 9.4,
    turretRadialDuration: 1,
    readyHold: 0.75,
  },
  turret: {
    longitudinalAxis: 'z' as CncAxis,
    longitudinalOffset: 6,
    radialAxis: 'x' as CncAxis,
    radialOffset: 5,
    sequenceIndexAngleDeg: 25,
    sequenceIndexRadians: (25 * Math.PI) / 180,
  },
  reducedMotion: {
    durationScale: 0.08,
    minimumDuration: 0.04,
  },
} as const
