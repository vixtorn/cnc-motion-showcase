import { useCallback, useEffect, useMemo, useRef, type RefObject } from 'react'
import gsap from 'gsap'
import type { CncMotionController } from './useCncMotionCalibration'
import { CNC_CHOREOGRAPHY } from './cncChoreographyConfig'
import { prefersReducedMotion } from './motionPreferences'
import type { CameraRigHandle } from '../scene/CameraRig'
import type { CncSequenceState } from '../types/cnc'

interface UseCncChoreographyOptions {
  motionRef: RefObject<CncMotionController | null>
  cameraRef: RefObject<CameraRigHandle | null>
  onStateChange: (state: CncSequenceState) => void
}

export interface CncChoreographyController {
  playSequence: () => void
  pauseSequence: () => void
  resumeSequence: () => void
  resetSequence: () => void
}

export function useCncChoreography({
  motionRef,
  cameraRef,
  onStateChange,
}: UseCncChoreographyOptions): CncChoreographyController {
  const timelineRef = useRef<gsap.core.Timeline | null>(null)
  const stateRef = useRef<CncSequenceState>('idle')

  const setSequenceState = useCallback(
    (state: CncSequenceState) => {
      if (stateRef.current === state) return
      stateRef.current = state
      onStateChange(state)
      if (import.meta.env.DEV) console.info(`[CNC] Sequence state ${state.toUpperCase()}`)
    },
    [onStateChange],
  )

  const killMasterTimeline = useCallback(() => {
    timelineRef.current?.kill()
    timelineRef.current = null
  }, [])

  const logCheckpoint = useCallback(
    (label: string) => {
      if (!import.meta.env.DEV) return
      const timeline = timelineRef.current
      console.info(
        `[CNC] Sequence checkpoint ${label} ${JSON.stringify({
          timelineTime: Number((timeline?.time() ?? 0).toFixed(4)),
          timelineProgress: Number((timeline?.progress() ?? 0).toFixed(4)),
          motion: motionRef.current?.getMotionSnapshot() ?? null,
        })}`,
      )
    },
    [motionRef],
  )

  const resetSequence = useCallback(() => {
    const motion = motionRef.current
    const camera = cameraRef.current
    killMasterTimeline()
    camera?.cancelTransition()
    motion?.restoreAllImmediate()
    camera?.setManualControlsEnabled(false)
    camera?.goToHero({ duration: 0, lockControls: false, releaseControls: false })
    camera?.setManualControlsEnabled(true)
    logCheckpoint('RESET')
    setSequenceState('idle')
  }, [cameraRef, killMasterTimeline, logCheckpoint, motionRef, setSequenceState])

  const playSequence = useCallback(() => {
    const motion = motionRef.current
    const camera = cameraRef.current
    if (!motion || !camera) return

    killMasterTimeline()
    camera.cancelTransition()
    motion.restoreAllImmediate()
    camera.setManualControlsEnabled(false)
    camera.goToHero({ duration: 0, lockControls: false, releaseControls: false })

    const reducedMotion = prefersReducedMotion()
    const scale = reducedMotion ? CNC_CHOREOGRAPHY.reducedMotion.durationScale : 1
    const duration = (value: number) =>
      reducedMotion
        ? Math.max(value * scale, CNC_CHOREOGRAPHY.reducedMotion.minimumDuration)
        : value
    const at = (value: number) => value * scale
    const timings = CNC_CHOREOGRAPHY.timings
    const doorStart = at(timings.establishingHold)
    const cameraEntryStart =
      doorStart + duration(timings.doorOpenDuration) + duration(timings.postDoorHold)
    const turret = CNC_CHOREOGRAPHY.turret
    const longitudinalOffsets = { [turret.longitudinalAxis]: turret.longitudinalOffset }
    const readyOffsets = {
      [turret.longitudinalAxis]: turret.longitudinalOffset,
      [turret.radialAxis]: turret.radialOffset,
    }
    const radialEnd = at(timings.turretRadialStartTime) + duration(timings.turretRadialDuration)

    const timeline = gsap.timeline({
      paused: true,
      onComplete: () => {
        logCheckpoint('COMPLETE')
        timelineRef.current = null
        camera.setManualControlsEnabled(true)
        setSequenceState('complete')
      },
    })

    timeline.to({}, { duration: duration(timings.establishingHold) }, 0)
    motion.addDoorToTimeline(timeline, doorStart, duration(timings.doorOpenDuration))
    timeline.call(
      () =>
        camera.playPath('heroToInterior', {
          durationScale: scale,
          lockControls: false,
          releaseControls: false,
        }),
      [],
      cameraEntryStart,
    )
    timeline.call(
      () =>
        motion.startChuck({
          rampDuration: duration(timings.chuckRampDuration),
          revolutionDuration: CNC_CHOREOGRAPHY.chuck.revolutionDuration,
        }),
      [],
      at(timings.chuckStartTime),
    )
    motion.addTailstockToTimeline(
      timeline,
      at(timings.tailstockStartTime),
      duration(timings.tailstockDuration),
    )
    motion.addTurretCarriageToTimeline(
      timeline,
      longitudinalOffsets,
      at(timings.turretLongitudinalStartTime),
      duration(timings.turretLongitudinalDuration),
      'longitudinal',
    )
    motion.addTurretIndexToTimeline(
      timeline,
      turret.sequenceIndexRadians,
      at(timings.turretIndexStartTime),
      duration(timings.turretIndexDuration),
    )
    motion.addTurretCarriageToTimeline(
      timeline,
      readyOffsets,
      at(timings.turretRadialStartTime),
      duration(timings.turretRadialDuration),
      'radial-ready',
    )
    timeline.to({}, { duration: duration(timings.readyHold) }, radialEnd)

    timelineRef.current = timeline
    setSequenceState('playing')
    if (import.meta.env.DEV) {
      console.info(
        `[CNC] Sequence timeline ${JSON.stringify({
          reducedMotion,
          duration: Number(timeline.duration().toFixed(3)),
          doorDuration: timings.doorOpenDuration,
          postDoorHold: timings.postDoorHold,
          cameraEntryStart: Number(
            (
              timings.establishingHold +
              timings.doorOpenDuration +
              timings.postDoorHold
            ).toFixed(3),
          ),
          turretLongitudinalOffset: turret.longitudinalOffset,
          turretRadialOffset: turret.radialOffset,
          turretSequenceIndexAngleDeg: turret.sequenceIndexAngleDeg,
        })}`,
      )
    }
    timeline.play(0)
  }, [cameraRef, killMasterTimeline, logCheckpoint, motionRef, setSequenceState])

  const pauseSequence = useCallback(() => {
    if (stateRef.current !== 'playing' || !timelineRef.current) return
    timelineRef.current.pause()
    motionRef.current?.pauseChuck()
    cameraRef.current?.pauseTransition()
    logCheckpoint('PAUSE')
    setSequenceState('paused')
  }, [cameraRef, logCheckpoint, motionRef, setSequenceState])

  const resumeSequence = useCallback(() => {
    if (stateRef.current !== 'paused' || !timelineRef.current) return
    cameraRef.current?.resumeTransition()
    motionRef.current?.resumeChuck()
    logCheckpoint('RESUME')
    timelineRef.current.resume()
    setSequenceState('playing')
  }, [cameraRef, logCheckpoint, motionRef, setSequenceState])

  useEffect(
    () => () => {
      killMasterTimeline()
      cameraRef.current?.cancelTransition()
      cameraRef.current?.setManualControlsEnabled(true)
      motionRef.current?.killAllMotion()
    },
    [cameraRef, killMasterTimeline, motionRef],
  )

  return useMemo(
    () => ({ playSequence, pauseSequence, resumeSequence, resetSequence }),
    [pauseSequence, playSequence, resetSequence, resumeSequence],
  )
}
