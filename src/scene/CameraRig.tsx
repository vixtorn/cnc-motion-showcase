import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import { OrbitControls } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { MathUtils, PerspectiveCamera, Vector3, type Box3 } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { VISUAL_CALIBRATION } from '../animation/visualCalibrationConfig'

export interface CameraRigHandle {
  resetCamera: () => void
}

interface CameraRigProps {
  bounds: Box3 | null
}

const { camera: cameraCalibration } = VISUAL_CALIBRATION
const CAMERA_DIRECTION = new Vector3(...cameraCalibration.direction).normalize()

export const CameraRig = forwardRef<CameraRigHandle, CameraRigProps>(function CameraRig(
  { bounds },
  ref,
) {
  const camera = useThree((state) => state.camera)
  const size = useThree((state) => state.size)
  const invalidate = useThree((state) => state.invalidate)
  const controlsRef = useRef<OrbitControlsImpl>(null)

  const framing = useMemo(() => {
    if (!bounds || !(camera instanceof PerspectiveCamera)) return null

    const center = bounds.getCenter(new Vector3())
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
      center,
      position: center.clone().addScaledVector(CAMERA_DIRECTION, distance),
      distance,
      radius,
    }
  }, [bounds, camera, size.height, size.width])

  const applyFit = useCallback(() => {
    if (!framing || !(camera instanceof PerspectiveCamera)) return

    camera.position.copy(framing.position)
    camera.near = Math.max(framing.distance / cameraCalibration.nearDistanceDivisor, 0.01)
    camera.far = Math.max(
      framing.distance + framing.radius * cameraCalibration.farRadiusMultiplier,
      1000,
    )
    camera.updateProjectionMatrix()
    controlsRef.current?.target.copy(framing.center)
    controlsRef.current?.update()
    invalidate()
  }, [camera, framing, invalidate])

  useImperativeHandle(ref, () => ({ resetCamera: applyFit }), [applyFit])

  useEffect(() => {
    applyFit()
  }, [applyFit])

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.075}
      minDistance={framing ? framing.radius * 0.45 : 1}
      maxDistance={framing ? framing.distance * 2.4 : 10000}
      minPolarAngle={Math.PI * 0.08}
      maxPolarAngle={Math.PI * 0.88}
      target={framing?.center}
      onChange={() => invalidate()}
    />
  )
})
