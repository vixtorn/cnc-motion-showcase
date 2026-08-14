import { Canvas } from '@react-three/fiber'
import {
  forwardRef,
  Suspense,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import { ACESFilmicToneMapping } from 'three'
import type { CncAxis } from '../animation/cncAnimationConfig'
import { VISUAL_CALIBRATION } from '../animation/visualCalibrationConfig'
import type {
  CalibrationAssembly,
  CalibrationDirection,
  CncInspection,
} from '../types/cnc'
import { CameraRig, type CameraRigHandle } from './CameraRig'
import { CNCModel, type CNCModelHandle } from './CNCModel'
import { SceneLighting } from './SceneLighting'

export interface CNCSceneHandle {
  resetCamera: () => void
  testTranslation: (
    assembly: CalibrationAssembly,
    axis: CncAxis,
    direction: CalibrationDirection,
  ) => void
  resetAssembly: (assembly: CalibrationAssembly) => void
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
      testTranslation: (assembly, axis, direction) =>
        modelRef.current?.testTranslation(assembly, axis, direction),
      resetAssembly: (assembly) => modelRef.current?.resetAssembly(assembly),
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
      <CameraRig ref={cameraRigRef} bounds={inspection?.bounds ?? null} />
    </Canvas>
  )
})
