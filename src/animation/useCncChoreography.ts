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
import type { SparkEffectHandle } from '../effects/SparkEffect'
import type { CncSequenceState } from '../types/cnc'

interface UseCncChoreographyOptions {
  motionRef: RefObject<CNCModelHandle | null>
  cameraRef: RefObject<CameraRigHandle | null>
  coolantRef: RefObject<CoolantEffectHandle | null>
  sparkRef: RefObject<SparkEffectHandle | null>
  cameraSpeedMultiplier: number
  onStateChange: (state: CncSequenceState) => void
  onProgressChange: (progress: number) => void
}

export interface CncChoreographyController {
  playSequence: () => void
  pauseSequence: () => void
  resumeSequence: () => void
  resetSequence: () => void
  setSequenceProgress: (progress: number) => void
  getSequenceProgress: () => number
  getSequenceDuration: () => number
}

interface SequenceTiming {
  reducedMotion: boolean
  doorStart: number
  cameraEntryStart: number
  cameraEntryEnd: number
  chuckStart: number
  chuckSlowSpinDuration: number
  chuckAccelerationDuration: number
  tailstockStart: number
  tailstockContactEnd: number
  turretLongitudinalStart: number
  turretLongitudinalEnd: number
  turretIndexStart: number
  turretIndexEnd: number
  singleApproachStart: number
  cuttingContactStart: number
  coolantStart: number
  coolantRampInEnd: number
  workpieceSwap: number
  occlusionRampStart: number
  occlusionRampOutStart: number
  occlusionRampOutEnd: number
  coolantRampOutStart: number
  coolantRampOutEnd: number
  spindleDecelerationStart: number
  spindleDecelerationEnd: number
  turretHomeReturnStart: number
  turretHomeReturnStageTwoStart: number
  turretHomeReturnEnd: number
  interiorResultHoldEnd: number
  finishedInspectionPathDuration: number
  finishedInspectionHoldStart: number
  finishedInspectionHoldEnd: number
  exitToDumanPathDuration: number
  totalDuration: number
}

const clamp01 = (value: number) => Math.min(Math.max(value, 0), 1)
const power2In = gsap.parseEase('power2.in')
const power2Out = gsap.parseEase('power2.out')
const power2InOut = gsap.parseEase('power2.inOut')

const rangeProgress = (time: number, start: number, end: number) =>
  end <= start ? Number(time >= end) : clamp01((time - start) / (end - start))

const integratedPower2Out = (progress: number) => {
  const p = clamp01(progress)
  return p - (1 - (1 - p) ** 4) / 4
}

const integratedPower2InOut = (progress: number) => {
  const p = clamp01(progress)
  return p <= 0.5 ? p ** 4 : p - 0.5 + (1 - p) ** 4
}

export function useCncChoreography({
  motionRef,
  cameraRef,
  coolantRef,
  sparkRef,
  cameraSpeedMultiplier,
  onStateChange,
  onProgressChange,
}: UseCncChoreographyOptions): CncChoreographyController {
  const timelineRef = useRef<gsap.core.Timeline | null>(null)
  const timingRef = useRef<SequenceTiming | null>(null)
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
    timingRef.current = null
  }, [])

  const logCheckpoint = useCallback(
    (label: string) => {
      if (!import.meta.env.DEV) return
      const timeline = timelineRef.current
      console.info(
        `[CNC] Sequence checkpoint ${label} ${JSON.stringify({
          timelineTime: Number((timeline?.time() ?? 0).toFixed(4)),
          timelineProgress: Number((timeline?.progress() ?? 0).toFixed(4)),
          camera: cameraRef.current?.getCameraSnapshot() ?? null,
          motion: motionRef.current?.getMotionSnapshot() ?? null,
          coolant: coolantRef.current?.getCoolantSnapshot() ?? null,
          sparks: sparkRef.current?.getSparkSnapshot() ?? null,
        })}`,
      )
    },
    [cameraRef, coolantRef, motionRef, sparkRef],
  )

  const reconcileSequenceState = useCallback(
    (time: number) => {
      const timing = timingRef.current
      const motion = motionRef.current
      const camera = cameraRef.current
      const coolant = coolantRef.current
      const sparks = sparkRef.current
      if (!timing || !motion || !camera || !coolant) return

      if (time <= timing.cameraEntryStart) {
        camera.applyPathProgress('heroToInterior', 0)
      } else if (time < timing.cameraEntryEnd) {
        camera.applyPathProgress(
          'heroToInterior',
          rangeProgress(time, timing.cameraEntryStart, timing.cameraEntryEnd),
        )
      } else if (time < timing.interiorResultHoldEnd) {
        camera.applyPathProgress('heroToInterior', 1)
      } else if (time < timing.finishedInspectionHoldStart) {
        camera.applyPathProgress(
          'finishedInspection',
          rangeProgress(
            time,
            timing.interiorResultHoldEnd,
            timing.finishedInspectionHoldStart,
          ),
        )
      } else if (time < timing.finishedInspectionHoldEnd) {
        camera.applyPathProgress('finishedInspection', 1)
      } else {
        camera.applyPathProgress(
          'finishedToDuman',
          rangeProgress(time, timing.finishedInspectionHoldEnd, timing.totalDuration),
        )
      }

      const slowSpeed =
        (CNC_CHOREOGRAPHY.chuckStartup.slowSpinRpmVisualSpeed * Math.PI * 2) / 60
      const machiningSpeed =
        (CNC_MACHINING.chuck.machiningRpmVisualSpeed * Math.PI * 2) / 60
      const inspectionSpeed =
        (CNC_MACHINING.chuck.inspectionRpmVisualSpeed * Math.PI * 2) / 60
      const startupEnd =
        timing.chuckStart + timing.chuckSlowSpinDuration + timing.chuckAccelerationDuration
      let chuckAngle = 0
      let chuckSpeed = 0
      if (time > timing.chuckStart) {
        const slowProgress = rangeProgress(
          time,
          timing.chuckStart,
          timing.chuckStart + timing.chuckSlowSpinDuration,
        )
        chuckAngle +=
          slowSpeed * timing.chuckSlowSpinDuration * integratedPower2Out(slowProgress)
        chuckSpeed = slowSpeed * power2Out(slowProgress)
        if (time > timing.chuckStart + timing.chuckSlowSpinDuration) {
          const accelerationProgress = rangeProgress(
            time,
            timing.chuckStart + timing.chuckSlowSpinDuration,
            startupEnd,
          )
          chuckAngle +=
            slowSpeed * timing.chuckAccelerationDuration * accelerationProgress +
            (machiningSpeed - slowSpeed) *
              timing.chuckAccelerationDuration *
              integratedPower2InOut(accelerationProgress)
          chuckSpeed =
            slowSpeed +
            (machiningSpeed - slowSpeed) * power2InOut(accelerationProgress)
        }
        if (time > startupEnd) {
          chuckAngle +=
            machiningSpeed * Math.max(0, Math.min(time, timing.spindleDecelerationStart) - startupEnd)
          chuckSpeed = machiningSpeed
        }
        if (time > timing.spindleDecelerationStart) {
          const decelerationProgress = rangeProgress(
            time,
            timing.spindleDecelerationStart,
            timing.spindleDecelerationEnd,
          )
          chuckAngle +=
            machiningSpeed *
              (timing.spindleDecelerationEnd - timing.spindleDecelerationStart) *
              decelerationProgress +
            (inspectionSpeed - machiningSpeed) *
              (timing.spindleDecelerationEnd - timing.spindleDecelerationStart) *
              integratedPower2InOut(decelerationProgress)
          chuckSpeed =
            machiningSpeed +
            (inspectionSpeed - machiningSpeed) * power2InOut(decelerationProgress)
        }
        if (time > timing.spindleDecelerationEnd) {
          chuckAngle += inspectionSpeed * (time - timing.spindleDecelerationEnd)
          chuckSpeed = inspectionSpeed
        }
      }
      if (time >= timing.totalDuration) chuckSpeed = 0
      motion.setSequenceChuckState(chuckAngle, chuckSpeed)
      motion.setWorkpieceState(time >= timing.workpieceSwap ? 'finished' : 'raw')

      const coolantSnapshot = coolant.getCoolantSnapshot() as {
        active?: boolean
        intensity?: number
        revealOcclusion?: number
      }
      const coolantActive =
        !timing.reducedMotion &&
        time >= timing.coolantStart &&
        time < timing.coolantRampOutEnd
      if (coolantActive && !coolantSnapshot.active) coolant.startCoolant()
      if (!coolantActive && coolantSnapshot.active) coolant.stopCoolant()

      let coolantIntensity = 0
      if (coolantActive) {
        if (time < timing.coolantRampInEnd) {
          coolantIntensity = power2InOut(
            rangeProgress(time, timing.coolantStart, timing.coolantRampInEnd),
          )
        } else if (time < timing.coolantRampOutStart) {
          coolantIntensity = 1
        } else {
          coolantIntensity =
            1 -
            power2InOut(
              rangeProgress(time, timing.coolantRampOutStart, timing.coolantRampOutEnd),
            )
        }
      }
      let revealOcclusion = 0
      if (!timing.reducedMotion && time >= timing.occlusionRampStart) {
        if (time < timing.workpieceSwap) {
          revealOcclusion = power2In(
            rangeProgress(time, timing.occlusionRampStart, timing.workpieceSwap),
          )
        } else if (time < timing.occlusionRampOutStart) {
          revealOcclusion = 1
        } else if (time < timing.occlusionRampOutEnd) {
          revealOcclusion =
            1 -
            power2Out(
              rangeProgress(time, timing.occlusionRampOutStart, timing.occlusionRampOutEnd),
            )
        }
      }
      coolant.setCoolantIntensity(coolantIntensity)
      coolant.setRevealOcclusion(revealOcclusion)
      coolant.setHotChipsActive(
        !timing.reducedMotion &&
          time >= timing.cuttingContactStart &&
          time <
            timing.cuttingContactStart + CNC_MACHINING.coolant.hotChips.maximumLifetime,
      )

      if (sparks) {
        const sparkSnapshot = sparks.getSparkSnapshot() as {
          active?: boolean
          liveParticles?: number
        }
        const inSparkWindow =
          !timing.reducedMotion &&
          time >= timing.tailstockContactEnd &&
          time < timing.coolantStart
        if (inSparkWindow && !sparkSnapshot.active) {
          sparks.startSparks('sequence')
        } else if (time < timing.tailstockContactEnd) {
          if (sparkSnapshot.active || (sparkSnapshot.liveParticles ?? 0) > 0) {
            sparks.resetSparks()
          }
        } else if (!inSparkWindow && sparkSnapshot.active) {
          sparks.stopSparks('sequence')
        }
      }
    },
    [cameraRef, coolantRef, motionRef, sparkRef],
  )

  const buildMasterTimeline = useCallback(() => {
    const motion = motionRef.current
    const camera = cameraRef.current
    const coolant = coolantRef.current
    if (!motion || !camera || !coolant) return null

    killMasterTimeline()
    motion.restoreAllImmediate()
    coolant.resetCoolant()
    sparkRef.current?.resetSparks()
    camera.cancelTransition()
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
    const machiningTimings = CNC_MACHINING.timings
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
    const chuckSlowSpinDuration = motionDuration(timings.chuckSlowSpinDuration)
    const chuckAccelerationDuration = motionDuration(timings.chuckAccelerationDuration)
    const spindleStartupEnd = chuckStart + chuckSlowSpinDuration + chuckAccelerationDuration
    const tailstockStart = chuckStart + duration(timings.tailstockAfterChuckStart)
    const tailstockContactEnd = tailstockStart + motionDuration(timings.tailstockDuration)
    const turretLongitudinalStart =
      spindleStartupEnd + duration(timings.spindleToTurretHold)
    const turretLongitudinalEnd =
      turretLongitudinalStart + motionDuration(timings.turretLongitudinalDuration)
    const turretIndexStart =
      turretLongitudinalEnd + duration(timings.mechanicalTransitionGap)
    const turretIndexEnd = turretIndexStart + motionDuration(timings.turretIndexDuration)
    const singleApproachStart =
      turretIndexEnd + duration(timings.mechanicalTransitionGap)
    const cuttingContactStart =
      singleApproachStart + motionDuration(machiningTimings.singleApproachDuration)
    const coolantStart =
      cuttingContactStart + duration(machiningTimings.postContactCoolantDelay)
    const coolantRampInEnd =
      coolantStart + duration(machiningTimings.coolantRampInDuration)
    const workpieceSwap =
      coolantStart + duration(machiningTimings.workpieceSwapAfterCoolantStart)
    const occlusionRampStart =
      workpieceSwap - duration(machiningTimings.occlusionRampBeforeSwap)
    const occlusionRampOutStart =
      workpieceSwap + duration(machiningTimings.occlusionHoldAfterSwap)
    const occlusionRampOutEnd =
      occlusionRampOutStart + duration(machiningTimings.occlusionRampOutDuration)
    const coolantRampOutStart =
      workpieceSwap + duration(machiningTimings.coolantRampOutAfterSwap)
    const coolantRampOutEnd =
      coolantRampOutStart + duration(machiningTimings.coolantRampOutDuration)
    const spindleDecelerationStart =
      workpieceSwap + duration(machiningTimings.spindleDecelerationAfterSwap)
    const spindleDecelerationEnd =
      spindleDecelerationStart + motionDuration(machiningTimings.spindleDecelerationDuration)
    const turretHomeReturnStart =
      coolantRampOutEnd + duration(machiningTimings.postMachiningRetractionHold)
    const turretHomeReturnStageDuration = CNC_MACHINING.turret.homeReturnDuration / 2
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
    const totalDuration = finishedInspectionHoldEnd + exitToDumanPathDuration
    const timing: SequenceTiming = {
      reducedMotion,
      doorStart,
      cameraEntryStart,
      cameraEntryEnd,
      chuckStart,
      chuckSlowSpinDuration,
      chuckAccelerationDuration,
      tailstockStart,
      tailstockContactEnd,
      turretLongitudinalStart,
      turretLongitudinalEnd,
      turretIndexStart,
      turretIndexEnd,
      singleApproachStart,
      cuttingContactStart,
      coolantStart,
      coolantRampInEnd,
      workpieceSwap,
      occlusionRampStart,
      occlusionRampOutStart,
      occlusionRampOutEnd,
      coolantRampOutStart,
      coolantRampOutEnd,
      spindleDecelerationStart,
      spindleDecelerationEnd,
      turretHomeReturnStart,
      turretHomeReturnStageTwoStart,
      turretHomeReturnEnd,
      interiorResultHoldEnd,
      finishedInspectionPathDuration,
      finishedInspectionHoldStart,
      finishedInspectionHoldEnd,
      exitToDumanPathDuration,
      totalDuration,
    }
    timingRef.current = timing

    const turret = CNC_CHOREOGRAPHY.turret
    const cuttingOffsets = CNC_MACHINING.turret.machiningOffsets
    const turretAfterXReturnOffsets = { ...cuttingOffsets, x: 0 }
    const longitudinalOffsets = { [turret.longitudinalAxis]: turret.longitudinalOffset }
    let timeline: gsap.core.Timeline
    timeline = gsap.timeline({
      paused: true,
      onUpdate: () => {
        reconcileSequenceState(timeline.time())
        onProgressChange(timeline.progress())
      },
      onComplete: () => {
        reconcileSequenceState(timing.totalDuration)
        camera.setManualControlsEnabled(true)
        setSequenceState('complete')
        logCheckpoint('COMPLETE')
      },
    })
    timeline.to({}, { duration: duration(timings.establishingHold) }, 0)
    motion.addDoorToTimeline(timeline, doorStart, motionDuration(timings.doorOpenDuration))
    timeline.to({}, { duration: cameraEntryEnd - cameraEntryStart }, cameraEntryStart)
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
    timeline.to(
      {},
      { duration: duration(machiningTimings.interiorResultHoldDuration) },
      interiorResultHoldStart,
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
    timeline.to({}, { duration: exitToDumanPathDuration }, finishedInspectionHoldEnd)
    timelineRef.current = timeline
    timeline.pause(0)
    reconcileSequenceState(0)
    onProgressChange(0)

    if (import.meta.env.DEV) {
      console.info(
        `[CNC] Canonical sequence timeline ${JSON.stringify({
          reducedMotion,
          duration: Number(timeline.duration().toFixed(3)),
          doorStart: Number(doorStart.toFixed(3)),
          cameraEntryStart: Number(cameraEntryStart.toFixed(3)),
          cameraEntryEnd: Number(cameraEntryEnd.toFixed(3)),
          chuckStart: Number(chuckStart.toFixed(3)),
          tailstockStart: Number(tailstockStart.toFixed(3)),
          tailstockContactEnd: Number(tailstockContactEnd.toFixed(3)),
          turretLongitudinalStart: Number(turretLongitudinalStart.toFixed(3)),
          turretIndexStart: Number(turretIndexStart.toFixed(3)),
          singleApproachStart: Number(singleApproachStart.toFixed(3)),
          cuttingContactStart: Number(cuttingContactStart.toFixed(3)),
          coolantStart: Number(coolantStart.toFixed(3)),
          workpieceSwap: Number(workpieceSwap.toFixed(3)),
          coolantRampOutEnd: Number(coolantRampOutEnd.toFixed(3)),
          turretHomeReturnStart: Number(turretHomeReturnStart.toFixed(3)),
          turretHomeReturnStageTwoStart: Number(turretHomeReturnStageTwoStart.toFixed(3)),
          turretHomeReturnEnd: Number(turretHomeReturnEnd.toFixed(3)),
          finishedInspectionStart: Number(interiorResultHoldEnd.toFixed(3)),
          finishedInspectionHoldEnd: Number(finishedInspectionHoldEnd.toFixed(3)),
          dumanFinal: Number(totalDuration.toFixed(3)),
        })}`,
      )
    }
    return timeline
  }, [
    cameraRef,
    cameraSpeedMultiplier,
    coolantRef,
    killMasterTimeline,
    logCheckpoint,
    motionRef,
    onProgressChange,
    reconcileSequenceState,
    setSequenceState,
    sparkRef,
  ])

  const ensureTimeline = useCallback(
    () => timelineRef.current ?? buildMasterTimeline(),
    [buildMasterTimeline],
  )

  const resetSequence = useCallback(() => {
    const timeline = ensureTimeline()
    const camera = cameraRef.current
    if (!timeline || !camera) return
    camera.cancelTransition()
    timeline.pause(0)
    timeline.progress(0)
    reconcileSequenceState(0)
    onProgressChange(0)
    camera.setManualControlsEnabled(true)
    setSequenceState('idle')
    logCheckpoint('RESET')
  }, [cameraRef, ensureTimeline, logCheckpoint, onProgressChange, reconcileSequenceState, setSequenceState])

  const playSequence = useCallback(() => {
    const timeline = ensureTimeline()
    const camera = cameraRef.current
    if (!timeline || !camera) return
    camera.cancelTransition()
    camera.setManualControlsEnabled(false)
    timeline.pause(0)
    timeline.progress(0)
    reconcileSequenceState(0)
    setSequenceState('playing')
    timeline.play(0)
  }, [cameraRef, ensureTimeline, reconcileSequenceState, setSequenceState])

  const setSequenceProgress = useCallback(
    (progress: number) => {
      const timeline = ensureTimeline()
      const camera = cameraRef.current
      if (!timeline || !camera) return
      const clampedProgress = clamp01(progress)
      camera.cancelTransition()
      camera.setManualControlsEnabled(false)
      timeline.pause()
      timeline.progress(clampedProgress)
      reconcileSequenceState(timeline.time())
      onProgressChange(clampedProgress)
      setSequenceState(
        clampedProgress === 0 ? 'idle' : clampedProgress === 1 ? 'complete' : 'paused',
      )
    },
    [cameraRef, ensureTimeline, onProgressChange, reconcileSequenceState, setSequenceState],
  )

  const getSequenceProgress = useCallback(
    () => timelineRef.current?.progress() ?? 0,
    [],
  )

  const getSequenceDuration = useCallback(
    () => timelineRef.current?.duration() ?? timingRef.current?.totalDuration ?? 0,
    [],
  )

  const pauseSequence = useCallback(() => {
    if (stateRef.current !== 'playing' || !timelineRef.current) return
    timelineRef.current.pause()
    coolantRef.current?.pauseCoolant()
    logCheckpoint('PAUSE')
    setSequenceState('paused')
  }, [coolantRef, logCheckpoint, setSequenceState])

  const resumeSequence = useCallback(() => {
    if (stateRef.current !== 'paused' || !timelineRef.current) return
    coolantRef.current?.resumeCoolant()
    logCheckpoint('RESUME')
    timelineRef.current.resume()
    setSequenceState('playing')
  }, [coolantRef, logCheckpoint, setSequenceState])

  useEffect(() => {
    killMasterTimeline()
    onProgressChange(0)
  }, [cameraSpeedMultiplier, killMasterTimeline, onProgressChange])

  useEffect(
    () => () => {
      killMasterTimeline()
      cameraRef.current?.cancelTransition()
      cameraRef.current?.setManualControlsEnabled(true)
      coolantRef.current?.resetCoolant()
      sparkRef.current?.resetSparks()
      motionRef.current?.killAllMotion()
    },
    [cameraRef, coolantRef, killMasterTimeline, motionRef, sparkRef],
  )

  return useMemo(
    () => ({
      playSequence,
      pauseSequence,
      resumeSequence,
      resetSequence,
      setSequenceProgress,
      getSequenceProgress,
      getSequenceDuration,
    }),
    [
      getSequenceDuration,
      getSequenceProgress,
      pauseSequence,
      playSequence,
      resetSequence,
      resumeSequence,
      setSequenceProgress,
    ],
  )
}
