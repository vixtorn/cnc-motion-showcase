import { useCallback, useEffect, useMemo, useRef, type RefObject } from 'react'
import gsap from 'gsap'
import {
  CNC_CHOREOGRAPHY,
  getEffectiveCameraDuration,
} from './cncChoreographyConfig'
import { CNC_MACHINING } from './cncMachiningConfig'
import { prefersReducedMotion } from './motionPreferences'
import { VISUAL_CALIBRATION } from './visualCalibrationConfig'
import type { CameraRigHandle } from '../scene/CameraRig'
import type { CNCModelHandle } from '../scene/CNCModel'
import type { CoolantEffectHandle } from '../effects/CoolantEffect'
import type { CncSequenceState } from '../types/cnc'

interface UseCncChoreographyOptions {
  motionRef: RefObject<CNCModelHandle | null>
  cameraRef: RefObject<CameraRigHandle | null>
  coolantRef: RefObject<CoolantEffectHandle | null>
  cameraSpeedMultiplier: number
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
  cameraSpeedMultiplier,
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
    const cameraEntryStart = at(timings.cameraEntryDelay)
    const turret = CNC_CHOREOGRAPHY.turret
    const longitudinalOffsets = { [turret.longitudinalAxis]: turret.longitudinalOffset }
    const machiningTimings = CNC_MACHINING.timings
    const singleApproachStart = at(timings.turretRadialStartTime)
    const cuttingContactStart =
      singleApproachStart + duration(machiningTimings.singleApproachDuration)
    const coolantStart =
      cuttingContactStart + duration(machiningTimings.postContactCoolantDelay)
    const workpieceSwap =
      coolantStart + duration(machiningTimings.workpieceSwapAfterCoolantStart)
    const occlusionRampStart =
      workpieceSwap - duration(machiningTimings.occlusionRampBeforeSwap)
    const occlusionRampOutStart =
      workpieceSwap + duration(machiningTimings.occlusionHoldAfterSwap)
    const coolantRampOutStart =
      workpieceSwap + duration(machiningTimings.coolantRampOutAfterSwap)
    const turretRetractStart =
      workpieceSwap + duration(machiningTimings.turretRetractAfterSwap)
    const spindleDecelerationStart =
      workpieceSwap + duration(machiningTimings.spindleDecelerationAfterSwap)
    const coolantRampOutEnd =
      coolantRampOutStart + duration(machiningTimings.coolantRampOutDuration)
    const turretRetractEnd =
      turretRetractStart + duration(machiningTimings.turretRetractDuration)
    const interiorResultHoldStart = Math.max(coolantRampOutEnd, turretRetractEnd)
    const interiorResultHoldEnd =
      interiorResultHoldStart + duration(machiningTimings.interiorResultHoldDuration)
    const exitToDumanPathDuration = reducedMotion
      ? 0
      : VISUAL_CALIBRATION.camera.paths.interiorToDuman.reduce(
          (total, step) =>
            total + getEffectiveCameraDuration(step.duration * scale, cameraSpeedMultiplier),
          0,
        )
    const cuttingOffsets = {
      [turret.longitudinalAxis]:
        turret.longitudinalOffset +
        (CNC_MACHINING.turret.contactAdditionalOffsets[turret.longitudinalAxis] ?? 0),
      [turret.radialAxis]:
        turret.radialOffset +
        (CNC_MACHINING.turret.contactAdditionalOffsets[turret.radialAxis] ?? 0),
    }
    const coolantLevel = { value: 0 }
    const occlusionLevel = { value: 0 }

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
      cuttingOffsets,
      singleApproachStart,
      duration(machiningTimings.singleApproachDuration),
      'single-machining-approach',
    )
    if (!reducedMotion) {
      timeline.call(() => coolant.triggerHotChips(), [], cuttingContactStart)
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

    if (!reducedMotion) {
      timeline.to(
        occlusionLevel,
        {
          value: 1,
          duration: machiningTimings.occlusionRampBeforeSwap,
          ease: 'power2.in',
          onUpdate: () => coolant.setRevealOcclusion(occlusionLevel.value),
        },
        occlusionRampStart,
      )
      timeline.to(
        occlusionLevel,
        {
          value: 0,
          duration: machiningTimings.occlusionRampOutDuration,
          ease: 'power2.out',
          onUpdate: () => coolant.setRevealOcclusion(occlusionLevel.value),
        },
        occlusionRampOutStart,
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
    timeline.to(
      {},
      { duration: duration(machiningTimings.interiorResultHoldDuration) },
      interiorResultHoldStart,
    )
    timeline.call(
      () =>
        camera.playPath('interiorToDuman', {
          durationScale: scale,
          lockControls: false,
          releaseControls: false,
        }),
      [],
      interiorResultHoldEnd,
    )
    timeline.to(
      {},
      { duration: exitToDumanPathDuration },
      interiorResultHoldEnd,
    )

    timelineRef.current = timeline
    setSequenceState('playing')
    if (import.meta.env.DEV) {
      console.info(
        `[CNC] Sequence timeline ${JSON.stringify({
          reducedMotion,
          duration: Number(timeline.duration().toFixed(3)),
          doorDuration: timings.doorOpenDuration,
          cameraEntryStart: Number(cameraEntryStart.toFixed(3)),
          cameraSpeedMultiplier,
          turretLongitudinalOffset: turret.longitudinalOffset,
          turretRadialOffset: turret.radialOffset,
          turretSequenceIndexAngleDeg: turret.sequenceIndexAngleDeg,
          cuttingContactStart: Number(cuttingContactStart.toFixed(3)),
          singleApproachStart: Number(singleApproachStart.toFixed(3)),
          coolantStart: Number(coolantStart.toFixed(3)),
          workpieceSwap: Number(workpieceSwap.toFixed(3)),
          occlusionRampStart: Number(occlusionRampStart.toFixed(3)),
          occlusionRampOutStart: Number(occlusionRampOutStart.toFixed(3)),
          coolantRampOutStart: Number(coolantRampOutStart.toFixed(3)),
          interiorResultHoldStart: Number(interiorResultHoldStart.toFixed(3)),
          interiorResultHoldEnd: Number(interiorResultHoldEnd.toFixed(3)),
          exitToDumanPathDuration: Number(exitToDumanPathDuration.toFixed(3)),
          cameraBeatOrder: [
            'doorApproach',
            'doorThreshold',
            'interior',
            'exitThreshold',
            'dumanFinal',
          ],
          cuttingOffsets,
          inspectionOffsets: CNC_MACHINING.turret.inspectionOffsets,
        })}`,
      )
    }
    timeline.play(0)
  }, [
    cameraRef,
    cameraSpeedMultiplier,
    coolantRef,
    killMasterTimeline,
    logCheckpoint,
    motionRef,
    setSequenceState,
  ])

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
