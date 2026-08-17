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
    const productionMotionSpeed = CNC_CHOREOGRAPHY.productionMotion.speedMultiplier
    const motionDuration = (value: number) =>
      reducedMotion ? duration(value) : value / productionMotionSpeed
    const cameraDurationScale = reducedMotion ? scale : 1 / productionMotionSpeed
    const timings = CNC_CHOREOGRAPHY.timings
    const cameraPathDuration = (
      name: 'heroToInterior' | 'finishedInspection' | 'finishedToDuman',
    ) =>
      reducedMotion
        ? 0
        : VISUAL_CALIBRATION.camera.paths[name].reduce(
            (total, step) =>
              total +
              getEffectiveCameraDuration(
                step.duration * cameraDurationScale,
                cameraSpeedMultiplier,
              ),
            0,
          )
    const doorStart = duration(timings.establishingHold)
    const cameraEntryStart = duration(timings.cameraEntryDelay)
    const cameraEntryEnd = cameraEntryStart + cameraPathDuration('heroToInterior')
    const chuckStart = cameraEntryEnd + duration(timings.interiorSettleHold)
    const spindleStartupEnd =
      chuckStart +
      motionDuration(timings.chuckSlowSpinDuration) +
      motionDuration(timings.chuckAccelerationDuration)
    const tailstockStart = chuckStart + duration(timings.tailstockAfterChuckStart)
    const turretLongitudinalStart =
      spindleStartupEnd + duration(timings.spindleToTurretHold)
    const turretLongitudinalEnd =
      turretLongitudinalStart + motionDuration(timings.turretLongitudinalDuration)
    const turretIndexStart =
      turretLongitudinalEnd + duration(timings.mechanicalTransitionGap)
    const turretIndexEnd =
      turretIndexStart + motionDuration(timings.turretIndexDuration)
    const turret = CNC_CHOREOGRAPHY.turret
    const longitudinalOffsets = { [turret.longitudinalAxis]: turret.longitudinalOffset }
    const machiningTimings = CNC_MACHINING.timings
    const singleApproachStart =
      turretIndexEnd + duration(timings.mechanicalTransitionGap)
    const cuttingContactStart =
      singleApproachStart + motionDuration(machiningTimings.singleApproachDuration)
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
    const spindleDecelerationStart =
      workpieceSwap + duration(machiningTimings.spindleDecelerationAfterSwap)
    const coolantRampOutEnd =
      coolantRampOutStart + duration(machiningTimings.coolantRampOutDuration)
    const machiningComplete = coolantRampOutEnd
    const turretHomeReturnStart =
      machiningComplete + duration(machiningTimings.postMachiningRetractionHold)
    const turretHomeReturnStageDuration =
      CNC_MACHINING.turret.homeReturnDuration / 2
    const turretHomeReturnStageTwoStart =
      turretHomeReturnStart + duration(turretHomeReturnStageDuration)
    const turretHomeReturnEnd =
      turretHomeReturnStageTwoStart + duration(turretHomeReturnStageDuration)
    const interiorResultHoldStart = Math.max(coolantRampOutEnd, turretHomeReturnEnd)
    const interiorResultHoldEnd =
      interiorResultHoldStart + duration(machiningTimings.interiorResultHoldDuration)
    const finishedInspectionPathDuration = cameraPathDuration('finishedInspection')
    const finishedInspectionHoldStart = interiorResultHoldEnd + finishedInspectionPathDuration
    const finishedInspectionHoldEnd =
      finishedInspectionHoldStart + duration(machiningTimings.finishedInspectionHoldDuration)
    const exitToDumanPathDuration = cameraPathDuration('finishedToDuman')
    const cuttingOffsets = CNC_MACHINING.turret.machiningOffsets
    const turretAfterXReturnOffsets = { ...cuttingOffsets, x: 0 }
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
    motion.addDoorToTimeline(timeline, doorStart, motionDuration(timings.doorOpenDuration))
    timeline.call(
      () =>
        camera.playPath('heroToInterior', {
          durationScale: cameraDurationScale,
          lockControls: false,
          releaseControls: false,
        }),
      [],
      cameraEntryStart,
    )
    timeline.call(
      () =>
        motion.startChuck({
          slowSpinRpmVisualSpeed: CNC_CHOREOGRAPHY.chuckStartup.slowSpinRpmVisualSpeed,
          slowSpinDuration: motionDuration(timings.chuckSlowSpinDuration),
          accelerationDuration: motionDuration(timings.chuckAccelerationDuration),
          rpmVisualSpeed: CNC_MACHINING.chuck.machiningRpmVisualSpeed,
        }),
      [],
      chuckStart,
    )
    motion.addTailstockToTimeline(
      timeline,
      tailstockStart,
      motionDuration(timings.tailstockDuration),
    )
    motion.addTurretCarriageToTimeline(
      timeline,
      longitudinalOffsets,
      turretLongitudinalStart,
      motionDuration(timings.turretLongitudinalDuration),
      'longitudinal',
    )
    motion.addTurretIndexToTimeline(
      timeline,
      turret.sequenceIndexRadians,
      turretIndexStart,
      motionDuration(timings.turretIndexDuration),
    )
    motion.addTurretCarriageToTimeline(
      timeline,
      cuttingOffsets,
      singleApproachStart,
      motionDuration(machiningTimings.singleApproachDuration),
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

    timeline.call(
      () =>
        motion.setChuckVisualRpm(
          CNC_MACHINING.chuck.inspectionRpmVisualSpeed,
          motionDuration(machiningTimings.spindleDecelerationDuration),
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
        camera.playPath('finishedInspection', {
          durationScale: cameraDurationScale,
          lockControls: false,
          releaseControls: false,
        }),
      [],
      interiorResultHoldEnd,
    )
    timeline.to(
      {},
      { duration: finishedInspectionPathDuration },
      interiorResultHoldEnd,
    )
    timeline.to(
      {},
      { duration: duration(machiningTimings.finishedInspectionHoldDuration) },
      finishedInspectionHoldStart,
    )
    motion.addTurretCarriageToTimeline(
      timeline,
      turretAfterXReturnOffsets,
      turretHomeReturnStart,
      duration(turretHomeReturnStageDuration),
      'home-return-x',
    )
    motion.addTurretCarriageToTimeline(
      timeline,
      {},
      turretHomeReturnStageTwoStart,
      duration(turretHomeReturnStageDuration),
      'home-return-z',
    )
    timeline.call(
      () =>
        camera.playPath('finishedToDuman', {
          durationScale: cameraDurationScale,
          lockControls: false,
          releaseControls: false,
        }),
      [],
      finishedInspectionHoldEnd,
    )
    timeline.to({}, { duration: exitToDumanPathDuration }, finishedInspectionHoldEnd)

    timelineRef.current = timeline
    setSequenceState('playing')
    if (import.meta.env.DEV) {
      console.info(
        `[CNC] Sequence timeline ${JSON.stringify({
          reducedMotion,
          duration: Number(timeline.duration().toFixed(3)),
          productionMotionSpeed,
          cameraDurationScale,
          doorDuration: Number(motionDuration(timings.doorOpenDuration).toFixed(3)),
          cameraEntryStart: Number(cameraEntryStart.toFixed(3)),
          cameraEntryEnd: Number(cameraEntryEnd.toFixed(3)),
          cameraSpeedMultiplier,
          turretLongitudinalOffset: turret.longitudinalOffset,
          turretMachiningOffsets: CNC_MACHINING.turret.machiningOffsets,
          turretSequenceIndexAngleDeg: turret.sequenceIndexAngleDeg,
          cuttingContactStart: Number(cuttingContactStart.toFixed(3)),
          singleApproachStart: Number(singleApproachStart.toFixed(3)),
          coolantStart: Number(coolantStart.toFixed(3)),
          workpieceSwap: Number(workpieceSwap.toFixed(3)),
          occlusionRampStart: Number(occlusionRampStart.toFixed(3)),
          occlusionRampOutStart: Number(occlusionRampOutStart.toFixed(3)),
          coolantRampOutStart: Number(coolantRampOutStart.toFixed(3)),
          machiningComplete: Number(machiningComplete.toFixed(3)),
          interiorResultHoldStart: Number(interiorResultHoldStart.toFixed(3)),
          interiorResultHoldEnd: Number(interiorResultHoldEnd.toFixed(3)),
          chuckStartup: {
            start: Number(chuckStart.toFixed(3)),
            slowSpinDuration: Number(motionDuration(timings.chuckSlowSpinDuration).toFixed(3)),
            accelerationDuration: Number(
              motionDuration(timings.chuckAccelerationDuration).toFixed(3),
            ),
          },
          finishedInspectionPathDuration: Number(finishedInspectionPathDuration.toFixed(3)),
          finishedInspectionHoldStart: Number(finishedInspectionHoldStart.toFixed(3)),
          finishedInspectionHoldEnd: Number(finishedInspectionHoldEnd.toFixed(3)),
          turretHomeReturnStart: Number(turretHomeReturnStart.toFixed(3)),
          turretHomeReturnEnd: Number(turretHomeReturnEnd.toFixed(3)),
          turretHomeReturnDuration: CNC_MACHINING.turret.homeReturnDuration,
          postMachiningRetractionHold: machiningTimings.postMachiningRetractionHold,
          exitToDumanPathDuration: Number(exitToDumanPathDuration.toFixed(3)),
          cameraBeatOrder: [
            'doorApproach',
            'doorThreshold',
            'interior',
            'finishedInspectionStart',
            'finishedInspection',
            'finishedRetreat',
            'exitThreshold',
            'dumanFinal',
          ],
          cuttingOffsets,
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
