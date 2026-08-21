import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import { OrbitControls } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import gsap from 'gsap'
import { CatmullRomCurve3, MathUtils, PerspectiveCamera, Vector3, type Box3 } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import {
  CNC_CHOREOGRAPHY,
  getEffectiveCameraDuration,
} from '../animation/cncChoreographyConfig'
import { prefersReducedMotion } from '../animation/motionPreferences'
import { VISUAL_CALIBRATION } from '../animation/visualCalibrationConfig'

export type CameraWaypointName =
  | 'hero'
  | 'doorApproach'
  | 'doorThreshold'
  | 'interior'
  | 'finishedInspectionStart'
  | 'finishedInspection'
  | 'finishedRetreat'
  | 'exitThreshold'
  | 'exitClearance'
  | 'dumanApproach'
  | 'dumanFinal'

export type CameraPathName =
  | 'heroToInterior'
  | 'interiorToDuman'
  | 'finishedInspection'
  | 'finishedToDuman'

export interface CameraTransitionOptions {
  duration?: number
  lockControls?: boolean
  releaseControls?: boolean
}

export interface CameraPathOptions extends Omit<CameraTransitionOptions, 'duration'> {
  durationScale?: number
}

export interface CameraRigHandle {
  resetCamera: () => void
  goToHero: (options?: CameraTransitionOptions) => void
  goToInterior: (options?: CameraTransitionOptions) => void
  goToWaypoint: (name: CameraWaypointName, options?: CameraTransitionOptions) => void
  playPath: (name: CameraPathName, options?: CameraPathOptions) => void
  applyPathProgress: (name: CameraPathName, progress: number) => void
  getCameraSnapshot: () => Record<string, unknown>
  testDumanCamera: () => void
  pauseTransition: () => void
  resumeTransition: () => void
  cancelTransition: () => void
  setManualControlsEnabled: (enabled: boolean) => void
}

interface CameraRigProps {
  bounds: Box3 | null
  dumanBadgeBounds: Box3 | null
  interiorBounds: Box3 | null
  finishedWorkpieceBounds: Box3 | null
  cameraSpeedMultiplier: number
  manualControlsLocked: boolean
  exclusiveCameraOwnership: boolean
}

interface CameraPreset {
  position: Vector3
  target: Vector3
  distance: number
  radius: number
  fov: number
}

interface CameraTransitionStep {
  name: CameraWaypointName
  preset: CameraPreset
  duration: number
}

const { camera: cameraCalibration } = VISUAL_CALIBRATION
const CAMERA_DIRECTION = new Vector3(...cameraCalibration.direction).normalize()
const DUMAN_CAMERA_DIRECTION = new Vector3(...cameraCalibration.dumanDirection).normalize()
const DUMAN_TARGET_OFFSET = new Vector3(...cameraCalibration.dumanTargetOffset)
const INTERIOR_CAMERA_DIRECTION = new Vector3(...cameraCalibration.interiorDirection).normalize()
const INTERIOR_TARGET_OFFSET = new Vector3(...cameraCalibration.interiorTargetOffset)
const FINISHED_INSPECTION_DIRECTION = new Vector3(
  ...cameraCalibration.finishedInspectionDirection,
).normalize()
const FINISHED_INSPECTION_TARGET_OFFSET = new Vector3(
  ...cameraCalibration.finishedInspectionTargetOffset,
)
const FINISHED_INSPECTION_START_DIRECTION = new Vector3(
  ...cameraCalibration.finishedInspectionStartDirection,
).normalize()
const FINISHED_INSPECTION_START_TARGET_OFFSET = new Vector3(
  ...cameraCalibration.finishedInspectionStartTargetOffset,
)

const presetDiagnostic = (preset: CameraPreset) => ({
  position: preset.position.toArray().map((value) => Number(value.toFixed(4))),
  target: preset.target.toArray().map((value) => Number(value.toFixed(4))),
  distance: Number(preset.distance.toFixed(4)),
  fov: preset.fov,
})

const CAMERA_PATH_STARTS: Record<CameraPathName, CameraWaypointName> = {
  heroToInterior: 'hero',
  interiorToDuman: 'interior',
  finishedInspection: 'interior',
  finishedToDuman: 'finishedInspection',
}

const cameraPathEase = gsap.parseEase(CNC_CHOREOGRAPHY.productionMotion.cameraEase)

export const CameraRig = forwardRef<CameraRigHandle, CameraRigProps>(function CameraRig(
  {
    bounds,
    dumanBadgeBounds,
    interiorBounds,
    finishedWorkpieceBounds,
    cameraSpeedMultiplier,
    manualControlsLocked,
    exclusiveCameraOwnership,
  },
  ref,
) {
  const camera = useThree((state) => state.camera)
  const size = useThree((state) => state.size)
  const invalidate = useThree((state) => state.invalidate)
  const controlsRef = useRef<OrbitControlsImpl>(null)
  const transitionRef = useRef<gsap.core.Animation | null>(null)
  const cameraSpeedMultiplierRef = useRef(cameraSpeedMultiplier)
  const manualControlsLockedRef = useRef(manualControlsLocked)
  const exclusiveCameraOwnershipRef = useRef(exclusiveCameraOwnership)

  manualControlsLockedRef.current = manualControlsLocked
  exclusiveCameraOwnershipRef.current = exclusiveCameraOwnership

  useEffect(() => {
    if (controlsRef.current) controlsRef.current.enabled = !manualControlsLocked
    invalidate()
  }, [invalidate, manualControlsLocked])

  useEffect(() => {
    cameraSpeedMultiplierRef.current = cameraSpeedMultiplier
  }, [cameraSpeedMultiplier])

  const heroPreset = useMemo<CameraPreset | null>(() => {
    if (!bounds || !(camera instanceof PerspectiveCamera)) return null

    const target = bounds.getCenter(new Vector3())
    const dimensions = bounds.getSize(new Vector3())
    const radius = Math.max(dimensions.length() / 2, 0.001)
    const verticalFov = MathUtils.degToRad(cameraCalibration.fov)
    const horizontalFov = 2 * Math.atan(
      Math.tan(verticalFov / 2) * Math.max(size.width / size.height, 0.1),
    )
    const limitingFov = Math.min(verticalFov, horizontalFov)
    const aspect = size.width / Math.max(size.height, 1)
    const distanceScale =
      aspect <= cameraCalibration.mobileAspectThreshold
        ? cameraCalibration.mobileDistanceScale
        : cameraCalibration.desktopDistanceScale
    const distance = (radius / Math.sin(limitingFov / 2)) * distanceScale

    return {
      target,
      position: target.clone().addScaledVector(CAMERA_DIRECTION, distance),
      distance,
      radius,
      fov: cameraCalibration.fov,
    }
  }, [bounds, camera, size.height, size.width])

  const dumanPreset = useMemo<CameraPreset | null>(() => {
    if (!dumanBadgeBounds || !heroPreset || !(camera instanceof PerspectiveCamera)) return null

    const target = dumanBadgeBounds.getCenter(new Vector3()).add(DUMAN_TARGET_OFFSET)
    const badgeSize = dumanBadgeBounds.getSize(new Vector3())
    const badgeRadius = Math.max(badgeSize.length() / 2, 0.001)
    const verticalFov = MathUtils.degToRad(camera.fov)
    const badgeFitDistance =
      (badgeRadius / Math.sin(verticalFov / 2)) * cameraCalibration.dumanBadgeFitScale
    const contextDistance = heroPreset.radius * cameraCalibration.dumanModelContextScale
    const distance = Math.max(badgeFitDistance, contextDistance)

    return {
      target,
      position: target.clone().addScaledVector(DUMAN_CAMERA_DIRECTION, distance),
      distance,
      radius: heroPreset.radius,
      fov: cameraCalibration.fov,
    }
  }, [camera, dumanBadgeBounds, heroPreset])

  const interiorPreset = useMemo<CameraPreset | null>(() => {
    if (!interiorBounds || !heroPreset || !(camera instanceof PerspectiveCamera)) return null

    const target = interiorBounds.getCenter(new Vector3()).add(INTERIOR_TARGET_OFFSET)
    const dimensions = interiorBounds.getSize(new Vector3())
    const radius = Math.max(dimensions.length() / 2, 0.001)
    const verticalFov = MathUtils.degToRad(cameraCalibration.fov)
    const horizontalFov = 2 * Math.atan(
      Math.tan(verticalFov / 2) * Math.max(size.width / size.height, 0.1),
    )
    const limitingFov = Math.min(verticalFov, horizontalFov)
    const distance =
      (radius / Math.sin(limitingFov / 2)) * cameraCalibration.interiorFitScale

    return {
      target,
      position: target.clone().addScaledVector(INTERIOR_CAMERA_DIRECTION, distance),
      distance,
      radius: heroPreset.radius,
      fov: cameraCalibration.interiorFov,
    }
  }, [camera, heroPreset, interiorBounds, size.height, size.width])

  const finishedInspectionPreset = useMemo<CameraPreset | null>(() => {
    if (!finishedWorkpieceBounds || !heroPreset) return null

    const target = finishedWorkpieceBounds
      .getCenter(new Vector3())
      .add(FINISHED_INSPECTION_TARGET_OFFSET)
    const distance = cameraCalibration.finishedInspectionDistance
    return {
      target,
      position: target.clone().addScaledVector(FINISHED_INSPECTION_DIRECTION, distance),
      distance,
      radius: heroPreset.radius,
      fov: cameraCalibration.finishedInspectionFov,
    }
  }, [finishedWorkpieceBounds, heroPreset])

  const finishedInspectionStartPreset = useMemo<CameraPreset | null>(() => {
    if (!finishedWorkpieceBounds || !heroPreset) return null

    const target = finishedWorkpieceBounds
      .getCenter(new Vector3())
      .add(FINISHED_INSPECTION_START_TARGET_OFFSET)
    const distance = cameraCalibration.finishedInspectionStartDistance
    return {
      target,
      position: target.clone().addScaledVector(FINISHED_INSPECTION_START_DIRECTION, distance),
      distance,
      radius: heroPreset.radius,
      fov: cameraCalibration.finishedInspectionStartFov,
    }
  }, [finishedWorkpieceBounds, heroPreset])

  const calibratedWaypointPresets = useMemo(() => {
    if (!heroPreset) return null

    const createPreset = (
      calibration: (typeof cameraCalibration.waypoints)[keyof typeof cameraCalibration.waypoints],
    ): CameraPreset => {
      const position = new Vector3(...calibration.position)
      const target = new Vector3(...calibration.target)
      return {
        position,
        target,
        distance: position.distanceTo(target),
        radius: heroPreset.radius,
        fov: calibration.fov,
      }
    }

    return {
      doorApproach: createPreset(cameraCalibration.waypoints.doorApproach),
      doorThreshold: createPreset(cameraCalibration.waypoints.doorThreshold),
      exitThreshold: createPreset(cameraCalibration.waypoints.exitThreshold),
      finishedRetreat: createPreset(cameraCalibration.waypoints.finishedRetreat),
      exitClearance: createPreset(cameraCalibration.waypoints.exitClearance),
      dumanApproach: createPreset(cameraCalibration.waypoints.dumanApproach),
    }
  }, [heroPreset])

  const getPreset = useCallback(
    (name: CameraWaypointName): CameraPreset | null => {
      if (name === 'hero') return heroPreset
      if (name === 'interior') return interiorPreset
      if (name === 'finishedInspectionStart') return finishedInspectionStartPreset
      if (name === 'finishedInspection') return finishedInspectionPreset
      if (name === 'dumanFinal') return dumanPreset
      return calibratedWaypointPresets?.[name] ?? null
    },
    [
      calibratedWaypointPresets,
      dumanPreset,
      finishedInspectionPreset,
      finishedInspectionStartPreset,
      heroPreset,
      interiorPreset,
    ],
  )

  const configureClipping = useCallback(
    (preset: CameraPreset) => {
      if (!(camera instanceof PerspectiveCamera)) return
      camera.near = Math.max(preset.distance / cameraCalibration.nearDistanceDivisor, 0.01)
      camera.far = Math.max(
        preset.distance + preset.radius * cameraCalibration.farRadiusMultiplier,
        1000,
      )
      camera.updateProjectionMatrix()
    },
    [camera],
  )

  const setManualControlsEnabled = useCallback(
    (enabled: boolean) => {
      if (controlsRef.current) {
        controlsRef.current.enabled = enabled && !manualControlsLockedRef.current
      }
      invalidate()
    },
    [invalidate],
  )

  const cancelTransition = useCallback(() => {
    if (import.meta.env.DEV && transitionRef.current) {
      console.info(
        `[CNC] Camera transition cancelled ${JSON.stringify({
          progress: Number(transitionRef.current.progress().toFixed(4)),
        })}`,
      )
    }
    transitionRef.current?.kill()
    transitionRef.current = null
    gsap.killTweensOf(camera)
    gsap.killTweensOf(camera.position)
    if (controlsRef.current) gsap.killTweensOf(controlsRef.current.target)
  }, [camera])

  const applyImmediate = useCallback(
    (preset: CameraPreset, releaseControls: boolean) => {
      if (!(camera instanceof PerspectiveCamera)) return
      const controls = controlsRef.current
      camera.position.copy(preset.position)
      camera.fov = preset.fov
      controls?.target.copy(preset.target)
      configureClipping(preset)
      controls?.update()
      if (releaseControls && controls) controls.enabled = !manualControlsLockedRef.current
      invalidate()
    },
    [camera, configureClipping, invalidate],
  )

  const runTransition = useCallback(
    (
      steps: CameraTransitionStep[],
      label: string,
      options: Omit<CameraTransitionOptions, 'duration'> = {},
    ) => {
      if (!(camera instanceof PerspectiveCamera) || steps.length === 0) return
      const controls = controlsRef.current
      const lockControls = options.lockControls ?? true
      const releaseControls = options.releaseControls ?? true
      const finalStep = steps.at(-1)
      if (!finalStep) return

      cancelTransition()
      if (lockControls && controls) controls.enabled = false

      if (!controls || steps.every((step) => step.duration === 0)) {
        applyImmediate(finalStep.preset, releaseControls)
        if (import.meta.env.DEV) {
          console.info(
            `[CNC] Camera ${label} applied immediately ${JSON.stringify(presetDiagnostic(finalStep.preset))}`,
          )
        }
        return
      }

      configureClipping(steps[0].preset)
      const transition = gsap.timeline({
        defaults: {
          ease: CNC_CHOREOGRAPHY.productionMotion.cameraEase,
          overwrite: true,
        },
        onUpdate: () => {
          camera.updateProjectionMatrix()
          controls.update()
          invalidate()
        },
        onComplete: () => {
          if (transitionRef.current === transition) transitionRef.current = null
          configureClipping(finalStep.preset)
          if (releaseControls) controls.enabled = !manualControlsLockedRef.current
          controls.update()
          invalidate()
          if (import.meta.env.DEV) {
            console.info(
              `[CNC] Camera ${label} complete ${JSON.stringify(presetDiagnostic(finalStep.preset))}`,
            )
          }
        },
      })

      let cursor = 0
      for (const step of steps) {
        const { preset, duration } = step
        transition
          .to(
            camera.position,
            { x: preset.position.x, y: preset.position.y, z: preset.position.z, duration },
            cursor,
          )
          .to(
            controls.target,
            { x: preset.target.x, y: preset.target.y, z: preset.target.z, duration },
            cursor,
          )
          .to(camera, { fov: preset.fov, duration }, cursor)
        cursor += duration
      }

      transitionRef.current = transition
      if (import.meta.env.DEV) {
        console.info(
          `[CNC] Camera ${label} started ${JSON.stringify({
            duration: Number(cursor.toFixed(3)),
            waypoints: steps.map((step) => ({
              name: step.name,
              duration: step.duration,
              ...presetDiagnostic(step.preset),
            })),
          })}`,
        )
      }
    },
    [applyImmediate, camera, cancelTransition, configureClipping, invalidate],
  )

  const runContinuousTransition = useCallback(
    (
      steps: CameraTransitionStep[],
      label: string,
      options: Omit<CameraTransitionOptions, 'duration'> = {},
    ) => {
      if (!(camera instanceof PerspectiveCamera) || steps.length === 0) return
      const controls = controlsRef.current
      const finalStep = steps.at(-1)
      if (!controls || !finalStep) return
      const releaseControls = options.releaseControls ?? true
      const totalDuration = steps.reduce((total, step) => total + step.duration, 0)
      if (totalDuration === 0) {
        applyImmediate(finalStep.preset, releaseControls)
        return
      }

      cancelTransition()
      if ((options.lockControls ?? true) && controls) controls.enabled = false

      const positionCurve = new CatmullRomCurve3(
        [camera.position.clone(), ...steps.map((step) => step.preset.position.clone())],
        false,
        'centripetal',
      )
      const targetCurve = new CatmullRomCurve3(
        [controls.target.clone(), ...steps.map((step) => step.preset.target.clone())],
        false,
        'centripetal',
      )
      const startFov = camera.fov
      const progress = { value: 0 }
      configureClipping(steps[0].preset)
      const transition = gsap.to(progress, {
        value: 1,
        duration: totalDuration,
        ease: CNC_CHOREOGRAPHY.productionMotion.cameraEase,
        onUpdate: () => {
          positionCurve.getPoint(progress.value, camera.position)
          targetCurve.getPoint(progress.value, controls.target)
          camera.fov = MathUtils.lerp(startFov, finalStep.preset.fov, progress.value)
          camera.updateProjectionMatrix()
          controls.update()
          invalidate()
        },
        onComplete: () => {
          camera.position.copy(finalStep.preset.position)
          controls.target.copy(finalStep.preset.target)
          camera.fov = finalStep.preset.fov
          if (transitionRef.current === transition) transitionRef.current = null
          configureClipping(finalStep.preset)
          if (releaseControls) controls.enabled = !manualControlsLockedRef.current
          controls.update()
          invalidate()
          if (import.meta.env.DEV) {
            console.info(
              `[CNC] Camera ${label} complete ${JSON.stringify(presetDiagnostic(finalStep.preset))}`,
            )
          }
        },
      })
      transitionRef.current = transition

      if (import.meta.env.DEV) {
        console.info(
          `[CNC] Camera ${label} started ${JSON.stringify({
            interpolation: 'centripetal Catmull-Rom',
            duration: Number(totalDuration.toFixed(3)),
            waypoints: steps.map((step) => ({
              name: step.name,
              duration: step.duration,
              ...presetDiagnostic(step.preset),
            })),
          })}`,
        )
      }
    },
    [applyImmediate, camera, cancelTransition, configureClipping, invalidate],
  )

  const goToWaypoint = useCallback(
    (name: CameraWaypointName, options: CameraTransitionOptions = {}) => {
      const preset = getPreset(name)
      if (!preset) return
      const duration = prefersReducedMotion()
        ? 0
        : getEffectiveCameraDuration(
            options.duration ?? cameraCalibration.presetTransitionDuration,
            cameraSpeedMultiplierRef.current,
          )
      runTransition([{ name, preset, duration }], `waypoint ${name.toUpperCase()}`, options)
    },
    [getPreset, runTransition],
  )

  const playPath = useCallback(
    (name: CameraPathName, options: CameraPathOptions = {}) => {
      const durationScale = prefersReducedMotion() ? 0 : (options.durationScale ?? 1)
      const path = cameraCalibration.paths[name]
      const steps = path.flatMap((step) => {
        const waypoint = step.waypoint as CameraWaypointName
        const preset = getPreset(waypoint)
        return preset
          ? [
              {
                name: waypoint,
                preset,
                duration: getEffectiveCameraDuration(
                  step.duration * durationScale,
                  cameraSpeedMultiplierRef.current,
                ),
              },
            ]
          : []
      })
      const runPath =
        name === 'finishedInspection' || name === 'finishedToDuman'
          ? runContinuousTransition
          : runTransition
      runPath(steps, `path ${name.toUpperCase()}`, options)
    },
    [getPreset, runContinuousTransition, runTransition],
  )

  const applyPathProgress = useCallback(
    (name: CameraPathName, progress: number) => {
      if (!(camera instanceof PerspectiveCamera)) return
      const controls = controlsRef.current
      const startPreset = getPreset(CAMERA_PATH_STARTS[name])
      if (!controls || !startPreset) return
      const steps = cameraCalibration.paths[name].flatMap((step) => {
        const preset = getPreset(step.waypoint as CameraWaypointName)
        return preset ? [{ preset, duration: step.duration }] : []
      })
      const finalStep = steps.at(-1)
      if (!finalStep) return
      const clampedProgress = MathUtils.clamp(progress, 0, 1)

      if (name === 'finishedInspection' || name === 'finishedToDuman') {
        const easedProgress = cameraPathEase(clampedProgress)
        new CatmullRomCurve3(
          [startPreset.position, ...steps.map((step) => step.preset.position)],
          false,
          'centripetal',
        ).getPoint(easedProgress, camera.position)
        new CatmullRomCurve3(
          [startPreset.target, ...steps.map((step) => step.preset.target)],
          false,
          'centripetal',
        ).getPoint(easedProgress, controls.target)
        camera.fov = MathUtils.lerp(startPreset.fov, finalStep.preset.fov, easedProgress)
      } else {
        const totalDuration = steps.reduce((total, step) => total + step.duration, 0)
        const elapsed = clampedProgress * totalDuration
        let cursor = 0
        let segmentStart = startPreset
        for (const step of steps) {
          const segmentEnd = cursor + step.duration
          if (elapsed <= segmentEnd || step === finalStep) {
            const localProgress =
              step.duration === 0 ? 1 : MathUtils.clamp((elapsed - cursor) / step.duration, 0, 1)
            const easedProgress = cameraPathEase(localProgress)
            camera.position.lerpVectors(
              segmentStart.position,
              step.preset.position,
              easedProgress,
            )
            controls.target.lerpVectors(
              segmentStart.target,
              step.preset.target,
              easedProgress,
            )
            camera.fov = MathUtils.lerp(segmentStart.fov, step.preset.fov, easedProgress)
            break
          }
          cursor = segmentEnd
          segmentStart = step.preset
        }
      }

      configureClipping(clampedProgress === 1 ? finalStep.preset : steps[0].preset)
      camera.updateProjectionMatrix()
      controls.update()
      invalidate()
    },
    [camera, configureClipping, getPreset, invalidate],
  )

  const getCameraSnapshot = useCallback(
    () => ({
      position: camera.position.toArray().map((value) => Number(value.toFixed(6))),
      target:
        controlsRef.current?.target.toArray().map((value) => Number(value.toFixed(6))) ?? null,
      fov: Number((camera as PerspectiveCamera).fov?.toFixed(4) ?? 0),
      transitionActive: Boolean(transitionRef.current),
    }),
    [camera],
  )

  const goToHero = useCallback(
    (options: CameraTransitionOptions = {}) => goToWaypoint('hero', options),
    [goToWaypoint],
  )

  const goToInterior = useCallback(
    (options: CameraTransitionOptions = {}) => goToWaypoint('interior', options),
    [goToWaypoint],
  )

  const resetCamera = useCallback(() => goToHero(), [goToHero])

  const testDumanCamera = useCallback(
    () => goToWaypoint('dumanFinal', { duration: 0 }),
    [goToWaypoint],
  )

  const pauseTransition = useCallback(() => transitionRef.current?.pause(), [])
  const resumeTransition = useCallback(() => transitionRef.current?.resume(), [])

  const logCameraCalibration = useCallback(() => {
    if (!import.meta.env.DEV || !controlsRef.current) return
    console.info(
      `[CNC] Camera calibration ${JSON.stringify({
        position: camera.position.toArray().map((value) => Number(value.toFixed(4))),
        target: controlsRef.current.target.toArray().map((value) => Number(value.toFixed(4))),
      })}`,
    )
  }, [camera])

  useImperativeHandle(
    ref,
    () => ({
      resetCamera,
      goToHero,
      goToInterior,
      goToWaypoint,
      playPath,
      applyPathProgress,
      getCameraSnapshot,
      testDumanCamera,
      pauseTransition,
      resumeTransition,
      cancelTransition,
      setManualControlsEnabled,
    }),
    [
      cancelTransition,
      applyPathProgress,
      getCameraSnapshot,
      goToHero,
      goToInterior,
      goToWaypoint,
      pauseTransition,
      playPath,
      resetCamera,
      resumeTransition,
      setManualControlsEnabled,
      testDumanCamera,
    ],
  )

  useEffect(() => {
    if (
      !heroPreset ||
      !(camera instanceof PerspectiveCamera) ||
      exclusiveCameraOwnershipRef.current
    ) {
      return
    }
    goToWaypoint('hero', { duration: 0 })
  }, [camera, goToWaypoint, heroPreset])

  useEffect(() => {
    if (!import.meta.env.DEV) return
    const names: CameraWaypointName[] = [
      'hero',
      'doorApproach',
      'doorThreshold',
      'interior',
      'finishedInspectionStart',
      'finishedInspection',
      'finishedRetreat',
      'exitThreshold',
      'exitClearance',
      'dumanApproach',
      'dumanFinal',
    ]
    for (const name of names) {
      const preset = getPreset(name)
      if (preset) {
        console.info(`[CNC] Camera waypoint ${name.toUpperCase()} ${JSON.stringify(presetDiagnostic(preset))}`)
      }
    }
  }, [getPreset])

  useEffect(() => () => cancelTransition(), [cancelTransition])

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enabled={!manualControlsLocked}
      enableDamping
      dampingFactor={0.075}
      minDistance={heroPreset ? heroPreset.radius * cameraCalibration.minimumOrbitDistanceScale : 1}
      maxDistance={heroPreset ? heroPreset.distance * 2.4 : 10000}
      minPolarAngle={Math.PI * 0.08}
      maxPolarAngle={Math.PI * 0.88}
      onChange={() => invalidate()}
      onEnd={logCameraCalibration}
    />
  )
})
