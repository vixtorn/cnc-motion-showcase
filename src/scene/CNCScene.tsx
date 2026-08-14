import { Canvas } from '@react-three/fiber'
import {
  forwardRef,
  Suspense,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import { ACESFilmicToneMapping, SRGBColorSpace } from 'three'
import type { CncAxis } from '../animation/cncAnimationConfig'
import { VISUAL_CALIBRATION } from '../animation/visualCalibrationConfig'
import type {
  CalibrationDirection,
  CncInspection,
} from '../types/cnc'
import { CameraRig, type CameraRigHandle } from './CameraRig'
import { CNCModel, type CNCModelHandle } from './CNCModel'
import { SceneLighting } from './SceneLighting'

export interface CNCSceneHandle {
  resetCamera: () => void
  testDumanCamera: () => void
  setTailstockContact: (contact: boolean) => void
  resetTailstock: () => void
  testTurretCarriage: (axis: CncAxis, direction: CalibrationDirection) => void
  resetTurretCarriage: () => void
  testTurretIndex: (direction: CalibrationDirection) => void
  resetTurretIndex: () => void
  setDoorOpen: (open: boolean) => void
  resetDoor: () => void
  resetAllAssemblies: () => void
}

interface CNCSceneProps {
  isChuckTesting: boolean
  onInspection: (inspection: CncInspection) => void
}

export const CNCScene = forwardRef<CNCSceneHandle, CNCSceneProps>(function CNCScene(
  { isChuckTesting, onInspection },
  ref,
) {
  const cameraRigRef = useRef<CameraRigHandle>(null)
  const modelRef = useRef<CNCModelHandle>(null)
  const [inspection, setInspection] = useState<CncInspection | null>(null)

  useImperativeHandle(
    ref,
    () => ({
      resetCamera: () => cameraRigRef.current?.resetCamera(),
      testDumanCamera: () => cameraRigRef.current?.testDumanCamera(),
      setTailstockContact: (contact) => modelRef.current?.setTailstockContact(contact),
      resetTailstock: () => modelRef.current?.resetTailstock(),
      testTurretCarriage: (axis, direction) =>
        modelRef.current?.testTurretCarriage(axis, direction),
      resetTurretCarriage: () => modelRef.current?.resetTurretCarriage(),
      testTurretIndex: (direction) => modelRef.current?.testTurretIndex(direction),
      resetTurretIndex: () => modelRef.current?.resetTurretIndex(),
      setDoorOpen: (open) => modelRef.current?.setDoorOpen(open),
      resetDoor: () => modelRef.current?.resetDoor(),
      resetAllAssemblies: () => modelRef.current?.resetAllAssemblies(),
    }),
    [],
  )

  const handleInspection = useCallback(
    (nextInspection: CncInspection) => {
      setInspection(nextInspection)
      onInspection(nextInspection)
    },
    [onInspection],
  )

  return (
    <Canvas
      className="scene-canvas"
      dpr={VISUAL_CALIBRATION.renderer.dpr}
      frameloop="demand"
      camera={{ fov: VISUAL_CALIBRATION.camera.fov, near: 0.1, far: 10000 }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      onCreated={({ gl, invalidate }) => {
        gl.toneMapping = ACESFilmicToneMapping
        gl.toneMappingExposure = VISUAL_CALIBRATION.renderer.toneMappingExposure
        gl.outputColorSpace = SRGBColorSpace
        invalidate()
      }}
    >
      <color attach="background" args={[VISUAL_CALIBRATION.background]} />
      <SceneLighting />
      <Suspense fallback={null}>
        <CNCModel
          ref={modelRef}
          isChuckTesting={isChuckTesting}
          onInspection={handleInspection}
        />
      </Suspense>
      <CameraRig
        ref={cameraRigRef}
        bounds={inspection?.bounds ?? null}
        dumanBadgeBounds={inspection?.dumanBadgeBounds ?? null}
      />
    </Canvas>
  )
})
