import { Canvas } from '@react-three/fiber'
import {
  forwardRef,
  Suspense,
  useCallback,
  useEffect,
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
  CncAnatomyComponentId,
  CncInspection,
  CncProcessComparisonSnapshot,
  CncSequenceState,
  CncSequenceTelemetry,
} from '../types/cnc'
import { getAnatomyComponent } from '../config/cncAnatomyConfig'
import {
  CameraRig,
  type CameraRigHandle,
  type CameraWaypointName,
} from './CameraRig'
import { CNCModel, type CNCModelHandle } from './CNCModel'
import { SceneLighting } from './SceneLighting'
import { CoolantEffect, type CoolantEffectHandle } from '../effects/CoolantEffect'
import { SparkEffect, type SparkEffectHandle } from '../effects/SparkEffect'
import { AnatomyHotspots } from './AnatomyHotspots'
import { AnatomyInteractionLayer } from './AnatomyInteractionLayer'

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
  startSparks: () => void
  stopSparks: () => void
  resetSparks: () => void
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
  setSequenceProgress: (progress: number) => void
  getSequenceProgress: () => number
  getSequenceDuration: () => number
  enterOperatorMode: () => Promise<boolean>
  exitOperatorMode: () => Promise<boolean>
  operatorStartSpindle: () => Promise<boolean>
  operatorEngageTailstock: () => Promise<boolean>
  operatorIndexTool: () => Promise<boolean>
  operatorApproachCut: () => Promise<boolean>
  operatorStartCoolant: () => Promise<boolean>
  operatorCompletePass: () => Promise<boolean>
  operatorReset: () => Promise<boolean>
  getOperatorSpindleVisualRpm: () => number
  enterProcessComparisonMode: () => Promise<boolean>
  setProcessComparisonProgress: (progress: number) => void
  resetProcessComparison: () => void
  exitProcessComparisonMode: () => Promise<void>
  getProcessComparisonSnapshot: () => CncProcessComparisonSnapshot
  enterAnatomyMode: () => Promise<boolean>
  exitAnatomyMode: () => Promise<void>
  focusAnatomyComponent: (id: CncAnatomyComponentId) => void
  returnToAnatomyOverview: () => void
}

interface CNCSceneProps {
  onInspection: (inspection: CncInspection) => void
  onSequenceStateChange: (state: CncSequenceState) => void
  onSequenceProgressChange: (progress: number) => void
  onSequenceTelemetryChange: (telemetry: CncSequenceTelemetry) => void
  cameraSpeedMultiplier: number
  scrollModeActive: boolean
  operatorModeActive: boolean
  comparisonModeActive: boolean
  anatomyModeActive: boolean
  anatomySelectedId: CncAnatomyComponentId | null
  onAnatomyComponentSelect: (id: CncAnatomyComponentId) => void
}

export const CNCScene = forwardRef<CNCSceneHandle, CNCSceneProps>(function CNCScene(
  {
    onInspection,
    onSequenceStateChange,
    onSequenceProgressChange,
    onSequenceTelemetryChange,
    cameraSpeedMultiplier,
    scrollModeActive,
    operatorModeActive,
    comparisonModeActive,
    anatomyModeActive,
    anatomySelectedId,
    onAnatomyComponentSelect,
  },
  ref,
) {
  const cameraRigRef = useRef<CameraRigHandle>(null)
  const modelRef = useRef<CNCModelHandle>(null)
  const coolantRef = useRef<CoolantEffectHandle>(null)
  const sparkRef = useRef<SparkEffectHandle>(null)
  const [inspection, setInspection] = useState<CncInspection | null>(null)
  const [anatomyHoveredId, setAnatomyHoveredId] = useState<CncAnatomyComponentId | null>(null)
  const choreography = useCncChoreography({
    motionRef: modelRef,
    cameraRef: cameraRigRef,
    coolantRef,
    sparkRef,
    cameraSpeedMultiplier,
    onStateChange: onSequenceStateChange,
    onProgressChange: onSequenceProgressChange,
    onTelemetryChange: onSequenceTelemetryChange,
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
      testFinishedPartCamera: () => {
        modelRef.current?.revealFinishedImmediate()
        cameraRigRef.current?.playPath('finishedInspection')
      },
      startCoolant: () => {
        coolantRef.current?.startCoolant()
        coolantRef.current?.setCoolantIntensity(1)
      },
      stopCoolant: () => coolantRef.current?.stopCoolant(),
      testWorkpieceTransition: () => modelRef.current?.revealFinishedImmediate(),
      resetMachining: () => {
        coolantRef.current?.resetCoolant()
        sparkRef.current?.resetSparks()
        const model = modelRef.current
        model?.restoreAllImmediate()
        if (import.meta.env.DEV) {
          console.info(
            `[CNC] Reset machining ${JSON.stringify(model?.getMotionSnapshot() ?? null)}`,
          )
        }
      },
      startSparks: () => sparkRef.current?.startSparks(),
      stopSparks: () => sparkRef.current?.stopSparks(),
      resetSparks: () => sparkRef.current?.resetSparks(),
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
      playSequence: () => {
        sparkRef.current?.resetSparks()
        choreography.playSequence()
      },
      pauseSequence: choreography.pauseSequence,
      resumeSequence: choreography.resumeSequence,
      resetSequence: () => {
        sparkRef.current?.resetSparks()
        choreography.resetSequence()
      },
      setSequenceProgress: choreography.setSequenceProgress,
      getSequenceProgress: choreography.getSequenceProgress,
      getSequenceDuration: choreography.getSequenceDuration,
      enterOperatorMode: async () => {
        choreography.pauseSequence()
        cameraRigRef.current?.cancelTransition()
        cameraRigRef.current?.setManualControlsEnabled(false)
        coolantRef.current?.resetCoolant()
        sparkRef.current?.resetSparks()
        const model = modelRef.current
        model?.restoreAllImmediate()
        cameraRigRef.current?.goToInterior({
          duration: 0,
          lockControls: true,
          releaseControls: false,
        })
        const completed = (await model?.operatorOpenDoor()) ?? false
        if (completed && import.meta.env.DEV) {
          console.info(
            `[CNC] Operator ready endpoint ${JSON.stringify(model?.getMotionSnapshot() ?? null)}`,
          )
        }
        return completed
      },
      exitOperatorMode: async () => {
        coolantRef.current?.resetCoolant()
        sparkRef.current?.resetSparks()
        modelRef.current?.restoreAllImmediate()
        cameraRigRef.current?.cancelTransition()
        choreography.setSequenceProgress(1)
        return true
      },
      operatorStartSpindle: async () =>
        (await modelRef.current?.operatorStartSpindle()) ?? false,
      operatorEngageTailstock: async () =>
        (await modelRef.current?.operatorEngageTailstock()) ?? false,
      operatorIndexTool: async () =>
        (await modelRef.current?.operatorIndexTool()) ?? false,
      operatorApproachCut: async () =>
        (await modelRef.current?.operatorApproachCut()) ?? false,
      operatorStartCoolant: async () => {
        const coolant = coolantRef.current
        if (!coolant) return false
        coolant.startCoolant()
        coolant.setCoolantIntensity(1)
        return true
      },
      operatorCompletePass: async () => {
        const model = modelRef.current
        if (!model) return false
        model.revealFinishedImmediate()
        coolantRef.current?.stopCoolant()
        model.stopChuck(false)
        const completed = await model.operatorReturnTurretHome()
        if (completed && import.meta.env.DEV) {
          console.info(
            `[CNC] Operator cycle endpoint ${JSON.stringify(model.getMotionSnapshot())}`,
          )
        }
        return completed
      },
      operatorReset: async () => {
        coolantRef.current?.resetCoolant()
        sparkRef.current?.resetSparks()
        const model = modelRef.current
        model?.restoreAllImmediate()
        const completed = (await model?.operatorOpenDoor()) ?? false
        if (completed && import.meta.env.DEV) {
          console.info(
            `[CNC] Operator reset endpoint ${JSON.stringify(model?.getMotionSnapshot() ?? null)}`,
          )
        }
        return completed
      },
      getOperatorSpindleVisualRpm: () =>
        modelRef.current?.getChuckVisualRpm() ?? 0,
      enterProcessComparisonMode: async () => {
        choreography.pauseSequence()
        cameraRigRef.current?.cancelTransition()
        cameraRigRef.current?.setManualControlsEnabled(false)
        coolantRef.current?.resetCoolant()
        sparkRef.current?.resetSparks()
        const model = modelRef.current
        if (!model) return false
        model.restoreAllImmediate()
        const comparisonReady = model.beginWorkpieceComparison()
        if (!comparisonReady) return false
        model.setWorkpieceComparisonProgress(0)
        cameraRigRef.current?.goToWaypoint('finishedInspectionStart', {
          duration: 0,
          lockControls: true,
          releaseControls: false,
        })
        const doorReady = model.openDoorForInspectionImmediate()
        if (!doorReady) model.endWorkpieceComparison('raw')
        return doorReady
      },
      setProcessComparisonProgress: (progress) =>
        modelRef.current?.setWorkpieceComparisonProgress(progress),
      resetProcessComparison: () =>
        modelRef.current?.setWorkpieceComparisonProgress(0),
      exitProcessComparisonMode: async () => {
        cameraRigRef.current?.cancelTransition()
        coolantRef.current?.resetCoolant()
        sparkRef.current?.resetSparks()
        const model = modelRef.current
        model?.endWorkpieceComparison('raw')
        model?.restoreAllImmediate()
        choreography.setSequenceProgress(1)
      },
      getProcessComparisonSnapshot: () =>
        modelRef.current?.getWorkpieceComparisonSnapshot() ?? {
          active: false,
          progress: 0,
          longitudinalAxis: null,
          rawVisible: null,
          finishedVisible: null,
          clonedMaterialCount: 0,
          clippingPlaneCount: 0,
        },
      enterAnatomyMode: async () => {
        choreography.pauseSequence()
        cameraRigRef.current?.cancelTransition()
        cameraRigRef.current?.setManualControlsEnabled(false)
        coolantRef.current?.resetCoolant()
        sparkRef.current?.resetSparks()
        const model = modelRef.current
        if (!model) return false
        model.restoreAllImmediate()
        model.revealFinishedImmediate()
        if (!model.openDoorForInspectionImmediate()) return false
        cameraRigRef.current?.goToAnatomyOverview()
        return true
      },
      exitAnatomyMode: async () => {
        cameraRigRef.current?.cancelTransition()
        coolantRef.current?.resetCoolant()
        sparkRef.current?.resetSparks()
        modelRef.current?.restoreAllImmediate()
        choreography.setSequenceProgress(1)
      },
      focusAnatomyComponent: (id) => {
        if (!inspection) return
        const component = getAnatomyComponent(id)
        if (!component) return
        cameraRigRef.current?.focusAnatomyPreset(id, component.camera)
      },
      returnToAnatomyOverview: () => cameraRigRef.current?.goToAnatomyOverview(),
    }),
    [choreography, inspection],
  )

  const handleInspection = useCallback(
    (nextInspection: CncInspection) => {
      setInspection(nextInspection)
      onInspection(nextInspection)
    },
    [onInspection],
  )

  useEffect(() => {
    if (!anatomyModeActive) setAnatomyHoveredId(null)
  }, [anatomyModeActive])

  return (
    <Canvas
      className="scene-canvas"
      style={{ touchAction: 'pan-y' }}
      dpr={VISUAL_CALIBRATION.renderer.dpr}
      frameloop="demand"
      camera={{ fov: VISUAL_CALIBRATION.camera.fov, near: 0.1, far: 10000 }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      onCreated={({ gl, invalidate }) => {
        gl.toneMapping = ACESFilmicToneMapping
        gl.toneMappingExposure = VISUAL_CALIBRATION.renderer.toneMappingExposure
        gl.outputColorSpace = SRGBColorSpace
        gl.localClippingEnabled = true
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
      {anatomyModeActive && inspection ? (
        <>
          <AnatomyInteractionLayer
            inspection={inspection}
            selectedId={anatomySelectedId}
            hoveredId={anatomyHoveredId}
            onHoverChange={setAnatomyHoveredId}
            onSelect={onAnatomyComponentSelect}
          />
          <AnatomyHotspots
            inspection={inspection}
            selectedId={anatomySelectedId}
            onSelect={onAnatomyComponentSelect}
          />
        </>
      ) : null}
      <CameraRig
        ref={cameraRigRef}
        bounds={inspection?.bounds ?? null}
        dumanBadgeBounds={inspection?.dumanBadgeBounds ?? null}
        interiorBounds={inspection?.interiorBounds ?? null}
        finishedWorkpieceBounds={inspection?.finishedWorkpieceBounds ?? null}
        cameraSpeedMultiplier={cameraSpeedMultiplier}
        manualControlsLocked={
          scrollModeActive || operatorModeActive || comparisonModeActive
        }
        exclusiveCameraOwnership={
          operatorModeActive || comparisonModeActive || anatomyModeActive
        }
        anatomyModeActive={anatomyModeActive}
      />
      <CoolantEffect ref={coolantRef} />
      {import.meta.env.DEV ? (
        <SparkEffect
          ref={sparkRef}
          rawWorkpiece={inspection?.nodes.workpiece ?? null}
          finishedWorkpiece={inspection?.nodes.finishedWorkpiece ?? null}
          tailstockTip={inspection?.nodes.tailstockTip ?? null}
        />
      ) : null}
    </Canvas>
  )
})
