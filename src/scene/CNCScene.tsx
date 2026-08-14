import { Canvas } from '@react-three/fiber'
import {
  forwardRef,
  Suspense,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import type { ChuckAxis } from '../animation/cncAnimationConfig'
import type { CncInspection } from '../types/cnc'
import { CameraRig, type CameraRigHandle } from './CameraRig'
import { CNCModel } from './CNCModel'
import { SceneLighting } from './SceneLighting'

export interface CNCSceneHandle {
  resetCamera: () => void
}

interface CNCSceneProps {
  chuckAxis: ChuckAxis
  isChuckTesting: boolean
  onInspection: (inspection: CncInspection) => void
}

export const CNCScene = forwardRef<CNCSceneHandle, CNCSceneProps>(function CNCScene(
  { chuckAxis, isChuckTesting, onInspection },
  ref,
) {
  const cameraRigRef = useRef<CameraRigHandle>(null)
  const [inspection, setInspection] = useState<CncInspection | null>(null)

  useImperativeHandle(
    ref,
    () => ({
      resetCamera: () => cameraRigRef.current?.resetCamera(),
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
      dpr={[1, 1.75]}
      frameloop="demand"
      camera={{ fov: 34, near: 0.1, far: 10000 }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
    >
      <color attach="background" args={['#d8d7d1']} />
      <SceneLighting />
      <Suspense fallback={null}>
        <CNCModel
          chuckAxis={chuckAxis}
          isChuckTesting={isChuckTesting}
          onInspection={handleInspection}
        />
      </Suspense>
      <CameraRig ref={cameraRigRef} bounds={inspection?.bounds ?? null} />
    </Canvas>
  )
})
