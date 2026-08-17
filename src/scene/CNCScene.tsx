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
import { useCncChoreography } from '../animation/useCncChoreography'
import { VISUAL_CALIBRATION } from '../animation/visualCalibrationConfig'
import type {
  CalibrationDirection,
  CncInspection,
  CncSequenceState,
} from '../types/cnc'
import {
  CameraRig,
  type CameraRigHandle,
  type CameraWaypointName,
} from './CameraRig'
import { CNCModel, type CNCModelHandle } from './CNCModel'
import { SceneLighting } from './SceneLighting'
import { CoolantEffect, type CoolantEffectHandle } from '../effects/CoolantEffect'

export interface CNCSceneHandle {
  resetCamera: () => void
  goToHero: () => void
  goToInterior: () => void
  goToCameraWaypoint: (name: CameraWaypointName) => void
  testDumanCamera: () => void
  testInteriorToDumanPath: () => void
  testFinishedPartCamera: () => void
  startCoolant: () => void
  stopCoolant: () => void
  testWorkpieceTransition: () => void
  resetMachining: () => void
  startChuckTest: () => void
  stopChuckTest: () => void
  setTailstockContact: (contact: boolean) => void
  resetTailstock: () => void
  testTurretCarriage: (axis: CncAxis, direction: CalibrationDirection) => void
  resetTurretCarriage: () => void
  testTurretIndex: (direction: CalibrationDirection) => void
  resetTurretIndex: () => void
  setDoorOpen: (open: boolean) => void
  resetDoor: () => void
  resetAllAssemblies: () => void
  playSequence: () => void
  pauseSequence: () => void
  resumeSequence: () => void
  resetSequence: () => void
}

interface CNCSceneProps {
  onInspection: (inspection: CncInspection) => void
  onSequenceStateChange: (state: CncSequenceState) => void
  cameraSpeedMultiplier: number
}

export const CNCScene = forwardRef<CNCSceneHandle, CNCSceneProps>(function CNCScene(
  { onInspection, onSequenceStateChange, cameraSpeedMultiplier },
  ref,
) {
  const cameraRigRef = useRef<CameraRigHandle>(null)
  const modelRef = useRef<CNCModelHandle>(null)
  const coolantRef = useRef<CoolantEffectHandle>(null)
  const [inspection, setInspection] = useState<CncInspection | null>(null)
  const choreography = useCncChoreography({
    motionRef: modelRef,
    cameraRef: cameraRigRef,
    coolantRef,
    cameraSpeedMultiplier,
    onStateChange: onSequenceStateChange,
  })

  useImperativeHandle(
    ref,
    () => ({
      resetCamera: () => cameraRigRef.current?.resetCamera(),
      goToHero: () => cameraRigRef.current?.goToHero(),
      goToInterior: () => cameraRigRef.current?.goToInterior({ duration: 0 }),
      goToCameraWaypoint: (name) =>
        cameraRigRef.current?.goToWaypoint(name, { duration: 0 }),
      testDumanCamera: () => cameraRigRef.current?.testDumanCamera(),
      testInteriorToDumanPath: () =>
        cameraRigRef.current?.playPath('interiorToDuman'),
      testFinishedPartCamera: () =>
        cameraRigRef.current?.goToWaypoint('finishedInspection', { duration: 0 }),
      startCoolant: () => {
        coolantRef.current?.startCoolant()
        coolantRef.current?.setCoolantIntensity(1)
      },
      stopCoolant: () => coolantRef.current?.stopCoolant(),
      testWorkpieceTransition: () => modelRef.current?.revealFinishedImmediate(),
      resetMachining: () => {
        coolantRef.current?.resetCoolant()
        const model = modelRef.current
        model?.restoreAllImmediate()
        if (import.meta.env.DEV) {
          console.info(
            `[CNC] Reset machining ${JSON.stringify(model?.getMotionSnapshot() ?? null)}`,
          )
        }
      },
      startChuckTest: () => modelRef.current?.startChuck({ rampDuration: 0.55 }),
      stopChuckTest: () => modelRef.current?.stopChuck(true),
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
      playSequence: choreography.playSequence,
      pauseSequence: choreography.pauseSequence,
      resumeSequence: choreography.resumeSequence,
      resetSequence: choreography.resetSequence,
    }),
    [choreography],
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
          onInspection={handleInspection}
        />
      </Suspense>
      <CameraRig
        ref={cameraRigRef}
        bounds={inspection?.bounds ?? null}
        dumanBadgeBounds={inspection?.dumanBadgeBounds ?? null}
        interiorBounds={inspection?.interiorBounds ?? null}
        finishedWorkpieceBounds={inspection?.finishedWorkpieceBounds ?? null}
        cameraSpeedMultiplier={cameraSpeedMultiplier}
      />
      <CoolantEffect ref={coolantRef} />
    </Canvas>
  )
})
