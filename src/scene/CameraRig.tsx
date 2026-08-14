import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import { OrbitControls } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import gsap from 'gsap'
import { MathUtils, PerspectiveCamera, Vector3, type Box3 } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { VISUAL_CALIBRATION } from '../animation/visualCalibrationConfig'

export interface CameraRigHandle {
  resetCamera: () => void
  testDumanCamera: () => void
}

interface CameraRigProps {
  bounds: Box3 | null
  dumanBadgeBounds: Box3 | null
}

interface CameraPreset {
  position: Vector3
  target: Vector3
  distance: number
  radius: number
}

const { camera: cameraCalibration } = VISUAL_CALIBRATION
const CAMERA_DIRECTION = new Vector3(...cameraCalibration.direction).normalize()
const DUMAN_CAMERA_DIRECTION = new Vector3(...cameraCalibration.dumanDirection).normalize()
const DUMAN_TARGET_OFFSET = new Vector3(...cameraCalibration.dumanTargetOffset)

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

export const CameraRig = forwardRef<CameraRigHandle, CameraRigProps>(function CameraRig(
  { bounds, dumanBadgeBounds },
  ref,
) {
  const camera = useThree((state) => state.camera)
  const size = useThree((state) => state.size)
  const invalidate = useThree((state) => state.invalidate)
  const controlsRef = useRef<OrbitControlsImpl>(null)
  const introPlayedRef = useRef(false)

  const heroPreset = useMemo<CameraPreset | null>(() => {
    if (!bounds || !(camera instanceof PerspectiveCamera)) return null

    const target = bounds.getCenter(new Vector3())
    const dimensions = bounds.getSize(new Vector3())
    const radius = Math.max(dimensions.length() / 2, 0.001)
    const verticalFov = MathUtils.degToRad(camera.fov)
    const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * Math.max(size.width / size.height, 0.1))
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
    }
  }, [camera, dumanBadgeBounds, heroPreset])

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

  const applyPreset = useCallback(
    (preset: CameraPreset, duration: number) => {
      if (!(camera instanceof PerspectiveCamera)) return
      const controls = controlsRef.current

      gsap.killTweensOf(camera.position)
      if (controls) gsap.killTweensOf(controls.target)
      configureClipping(preset)

      if (!controls || duration === 0) {
        camera.position.copy(preset.position)
        controls?.target.copy(preset.target)
        controls?.update()
        invalidate()
        return
      }

      gsap
        .timeline({
          defaults: { duration, ease: 'power2.inOut', overwrite: true },
          onUpdate: () => {
            controls.update()
            invalidate()
          },
        })
        .to(camera.position, {
          x: preset.position.x,
          y: preset.position.y,
          z: preset.position.z,
        }, 0)
        .to(controls.target, {
          x: preset.target.x,
          y: preset.target.y,
          z: preset.target.z,
        }, 0)
    },
    [camera, configureClipping, invalidate],
  )

  const resetCamera = useCallback(() => {
    if (!heroPreset) return
    applyPreset(
      heroPreset,
      prefersReducedMotion() ? 0 : cameraCalibration.presetTransitionDuration,
    )
  }, [applyPreset, heroPreset])

  const testDumanCamera = useCallback(() => {
    if (!dumanPreset) return
    if (import.meta.env.DEV) {
      console.info(
        `[CNC] Activating DUMAN camera ${JSON.stringify({
          position: dumanPreset.position.toArray().map((value) => Number(value.toFixed(4))),
          target: dumanPreset.target.toArray().map((value) => Number(value.toFixed(4))),
          distance: Number(dumanPreset.distance.toFixed(4)),
        })}`,
      )
    }
    applyPreset(
      dumanPreset,
      prefersReducedMotion() ? 0 : cameraCalibration.presetTransitionDuration,
    )
  }, [applyPreset, dumanPreset])

  const logCameraCalibration = useCallback(() => {
    if (!import.meta.env.DEV || !controlsRef.current) return
    console.info(
      `[CNC] Camera calibration ${JSON.stringify({
        position: camera.position.toArray().map((value) => Number(value.toFixed(4))),
        target: controlsRef.current.target.toArray().map((value) => Number(value.toFixed(4))),
      })}`,
    )
  }, [camera])

  useImperativeHandle(ref, () => ({ resetCamera, testDumanCamera }), [resetCamera, testDumanCamera])

  useEffect(() => {
    if (!heroPreset || !(camera instanceof PerspectiveCamera)) return
    const controls = controlsRef.current

    if (introPlayedRef.current) {
      applyPreset(heroPreset, 0)
      return
    }

    introPlayedRef.current = true
    if (prefersReducedMotion()) {
      applyPreset(heroPreset, 0)
      return
    }

    const introPreset = {
      ...heroPreset,
      position: heroPreset.target
        .clone()
        .addScaledVector(
          CAMERA_DIRECTION,
          heroPreset.distance * cameraCalibration.heroIntroDistanceScale,
        ),
      distance: heroPreset.distance * cameraCalibration.heroIntroDistanceScale,
    }
    camera.position.copy(introPreset.position)
    controls?.target.copy(introPreset.target)
    configureClipping(introPreset)
    controls?.update()
    invalidate()
    applyPreset(heroPreset, cameraCalibration.heroIntroDuration)

    return () => {
      const cameraTween = gsap.getTweensOf(camera.position)[0]
      const completed = !cameraTween || cameraTween.progress() >= 1
      gsap.killTweensOf(camera.position)
      if (controls) gsap.killTweensOf(controls.target)
      if (!completed) introPlayedRef.current = false
    }
  }, [applyPreset, camera, configureClipping, heroPreset, invalidate])

  useEffect(() => {
    if (!import.meta.env.DEV || !dumanPreset) return
    console.info(
      `[CNC] DUMAN camera preset ${JSON.stringify({
        position: dumanPreset.position.toArray().map((value) => Number(value.toFixed(4))),
        target: dumanPreset.target.toArray().map((value) => Number(value.toFixed(4))),
        distance: Number(dumanPreset.distance.toFixed(4)),
      })}`,
    )
  }, [dumanPreset])

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.075}
      minDistance={heroPreset ? heroPreset.radius * 0.22 : 1}
      maxDistance={heroPreset ? heroPreset.distance * 2.4 : 10000}
      minPolarAngle={Math.PI * 0.08}
      maxPolarAngle={Math.PI * 0.88}
      onChange={() => invalidate()}
      onEnd={logCameraCalibration}
    />
  )
})
