import { useCallback, useEffect, useMemo, useRef, type RefObject } from 'react'
import gsap from 'gsap'
import { CNC_CHOREOGRAPHY } from './cncChoreographyConfig'
import { CNC_MACHINING } from './cncMachiningConfig'
import { prefersReducedMotion } from './motionPreferences'
import type { CameraRigHandle } from '../scene/CameraRig'
import type { CNCModelHandle } from '../scene/CNCModel'
import type { CoolantEffectHandle } from '../effects/CoolantEffect'
import type { CncSequenceState } from '../types/cnc'

interface UseCncChoreographyOptions {
  motionRef: RefObject<CNCModelHandle | null>
  cameraRef: RefObject<CameraRigHandle | null>
  coolantRef: RefObject<CoolantEffectHandle | null>
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
  coolantRef,
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
          coolant: coolantRef.current?.getCoolantSnapshot() ?? null,
        })}`,
      )
    },
    [coolantRef, motionRef],
  )

  const resetSequence = useCallback(() => {
    const motion = motionRef.current
    const camera = cameraRef.current
    killMasterTimeline()
    camera?.cancelTransition()
    coolantRef.current?.resetCoolant()
    motion?.restoreAllImmediate()
    camera?.setManualControlsEnabled(false)
    camera?.goToHero({ duration: 0, lockControls: false, releaseControls: false })
    camera?.setManualControlsEnabled(true)
    logCheckpoint('RESET')
    setSequenceState('idle')
  }, [cameraRef, coolantRef, killMasterTimeline, logCheckpoint, motionRef, setSequenceState])

  const playSequence = useCallback(() => {
    const motion = motionRef.current
    const camera = cameraRef.current
    const coolant = coolantRef.current
    if (!motion || !camera || !coolant) return

    killMasterTimeline()
    camera.cancelTransition()
    coolant.resetCoolant()
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
    const readyEnd = radialEnd + duration(timings.readyHold)
    const machiningTimings = CNC_MACHINING.timings
    const cuttingContactStart = readyEnd
    const cuttingContactEnd =
      cuttingContactStart + duration(machiningTimings.cuttingContactDuration)
    const coolantStart =
      cuttingContactEnd + duration(machiningTimings.postContactCoolantDelay)
    const workpieceSwap =
      coolantStart + duration(machiningTimings.workpieceSwapAfterCoolantStart)
    const coolantRampOutStart =
      workpieceSwap + duration(machiningTimings.coolantRampOutAfterSwap)
    const turretRetractStart =
      workpieceSwap + duration(machiningTimings.turretRetractAfterSwap)
    const spindleDecelerationStart =
      workpieceSwap + duration(machiningTimings.spindleDecelerationAfterSwap)
    const inspectionCameraStart =
      workpieceSwap + duration(machiningTimings.inspectionCameraAfterSwap)
    const inspectionCameraEnd =
      inspectionCameraStart + duration(machiningTimings.inspectionCameraDuration)
    const cuttingOffsets = {
      [turret.longitudinalAxis]:
        turret.longitudinalOffset +
        (CNC_MACHINING.turret.contactAdditionalOffsets[turret.longitudinalAxis] ?? 0),
      [turret.radialAxis]:
        turret.radialOffset +
        (CNC_MACHINING.turret.contactAdditionalOffsets[turret.radialAxis] ?? 0),
    }
    const coolantLevel = { value: 0 }

    const timeline = gsap.timeline({
      paused: true,
      onComplete: () => {
        coolant.stopCoolant()
        motion.stopChuck(false)
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
          rpmVisualSpeed: CNC_MACHINING.chuck.machiningRpmVisualSpeed,
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
    motion.addTurretCarriageToTimeline(
      timeline,
      cuttingOffsets,
      cuttingContactStart,
      duration(machiningTimings.cuttingContactDuration),
      'cutting-contact',
    )

    if (!reducedMotion) {
      timeline.to(
        coolantLevel,
        {
          value: 1,
          duration: machiningTimings.coolantRampInDuration,
          ease: 'power2.inOut',
          onStart: () => coolant.startCoolant(),
          onUpdate: () => coolant.setCoolantIntensity(coolantLevel.value),
        },
        coolantStart,
      )
    }

    timeline.call(() => motion.revealFinishedImmediate(), [], workpieceSwap)

    if (!reducedMotion) {
      timeline.to(
        coolantLevel,
        {
          value: 0,
          duration: machiningTimings.coolantRampOutDuration,
          ease: 'power2.inOut',
          onUpdate: () => coolant.setCoolantIntensity(coolantLevel.value),
          onComplete: () => coolant.stopCoolant(),
        },
        coolantRampOutStart,
      )
    }

    motion.addTurretCarriageToTimeline(
      timeline,
      CNC_MACHINING.turret.inspectionOffsets,
      turretRetractStart,
      duration(machiningTimings.turretRetractDuration),
      'inspection-retract',
    )
    timeline.call(
      () =>
        motion.setChuckVisualRpm(
          CNC_MACHINING.chuck.inspectionRpmVisualSpeed,
          duration(machiningTimings.spindleDecelerationDuration),
        ),
      [],
      spindleDecelerationStart,
    )
    timeline.call(
      () =>
        camera.goToWaypoint('finishedInspection', {
          duration: duration(machiningTimings.inspectionCameraDuration),
          lockControls: false,
          releaseControls: false,
        }),
      [],
      inspectionCameraStart,
    )
    timeline.to(
      {},
      { duration: duration(machiningTimings.inspectionHold) },
      inspectionCameraEnd,
    )

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
          cuttingContactStart: Number(cuttingContactStart.toFixed(3)),
          coolantStart: Number(coolantStart.toFixed(3)),
          workpieceSwap: Number(workpieceSwap.toFixed(3)),
          coolantRampOutStart: Number(coolantRampOutStart.toFixed(3)),
          inspectionCameraStart: Number(inspectionCameraStart.toFixed(3)),
          cuttingOffsets,
          inspectionOffsets: CNC_MACHINING.turret.inspectionOffsets,
        })}`,
      )
    }
    timeline.play(0)
  }, [cameraRef, coolantRef, killMasterTimeline, logCheckpoint, motionRef, setSequenceState])

  const pauseSequence = useCallback(() => {
    if (stateRef.current !== 'playing' || !timelineRef.current) return
    timelineRef.current.pause()
    motionRef.current?.pauseChuck()
    cameraRef.current?.pauseTransition()
    coolantRef.current?.pauseCoolant()
    logCheckpoint('PAUSE')
    setSequenceState('paused')
  }, [cameraRef, coolantRef, logCheckpoint, motionRef, setSequenceState])

  const resumeSequence = useCallback(() => {
    if (stateRef.current !== 'paused' || !timelineRef.current) return
    cameraRef.current?.resumeTransition()
    motionRef.current?.resumeChuck()
    coolantRef.current?.resumeCoolant()
    logCheckpoint('RESUME')
    timelineRef.current.resume()
    setSequenceState('playing')
  }, [cameraRef, coolantRef, logCheckpoint, motionRef, setSequenceState])

  useEffect(
    () => () => {
      killMasterTimeline()
      cameraRef.current?.cancelTransition()
      cameraRef.current?.setManualControlsEnabled(true)
      coolantRef.current?.resetCoolant()
      motionRef.current?.killAllMotion()
    },
    [cameraRef, coolantRef, killMasterTimeline, motionRef],
  )

  return useMemo(
    () => ({ playSequence, pauseSequence, resumeSequence, resetSequence }),
    [pauseSequence, playSequence, resetSequence, resumeSequence],
  )
}
