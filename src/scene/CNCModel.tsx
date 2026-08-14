import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect } from 'react'
import { useGLTF } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { CNC_MODEL_URL } from '../animation/cncAnimationConfig'
import { useCncMotionCalibration } from '../animation/useCncMotionCalibration'
import type { CncMotionController } from '../animation/useCncMotionCalibration'
import { useCncHomeTransforms } from '../hooks/useCncHomeTransforms'
import { useCncNodes } from '../hooks/useCncNodes'
import type { CncInspection, HomeTransform } from '../types/cnc'

interface CNCModelProps {
  onInspection: (inspection: CncInspection) => void
}

export type CNCModelHandle = CncMotionController

const auditedScenes = new WeakSet<object>()

const homeTransformLogRow = (name: string, home: HomeTransform | null) => ({
  assembly: name,
  position: home
    ? `(${home.position.x.toFixed(4)}, ${home.position.y.toFixed(4)}, ${home.position.z.toFixed(4)})`
    : 'missing',
  rotation: home
    ? `(${home.rotation.x.toFixed(4)}, ${home.rotation.y.toFixed(4)}, ${home.rotation.z.toFixed(4)}) ${home.rotation.order}`
    : 'missing',
  scale: home
    ? `(${home.scale.x.toFixed(4)}, ${home.scale.y.toFixed(4)}, ${home.scale.z.toFixed(4)})`
    : 'missing',
})

export const CNCModel = forwardRef<CNCModelHandle, CNCModelProps>(function CNCModel(
  { onInspection },
  ref,
) {
  const { scene } = useGLTF(CNC_MODEL_URL)
  const inspection = useCncNodes(scene)
  const homeTransforms = useCncHomeTransforms(inspection.nodes)
  const invalidate = useThree((state) => state.invalidate)
  const motion = useCncMotionCalibration({
    nodes: inspection.nodes,
    homeTransforms,
    invalidate,
  })

  useImperativeHandle(ref, () => motion, [motion])

  useLayoutEffect(() => {
    if (inspection.nodes.workpiece) inspection.nodes.workpiece.visible = true
    if (inspection.nodes.finishedWorkpiece) inspection.nodes.finishedWorkpiece.visible = false
    invalidate()
  }, [inspection.nodes.finishedWorkpiece, inspection.nodes.workpiece, invalidate])

  useEffect(() => {
    onInspection(inspection)

    if (!import.meta.env.DEV) return

    if (!auditedScenes.has(scene)) {
      auditedScenes.add(scene)
      inspection.printAudit()
      console.table([
        homeTransformLogRow('MainChuck_Assembly', homeTransforms.mainChuck),
        homeTransformLogRow('Tailstock_MovingAssembly', homeTransforms.tailstock),
        homeTransformLogRow('Turret_CarriageAssembly', homeTransforms.turretCarriage),
        homeTransformLogRow('Turret_IndexAssembly', homeTransforms.turretIndex),
        homeTransformLogRow('FrontDoor_Assembly', homeTransforms.door),
      ])
      console.info(
        `[CNC] Workpiece visibility ${JSON.stringify({
          Workpiece_Raw: inspection.nodes.workpiece?.visible ?? false,
          Workpiece_Finished_Camshaft: inspection.nodes.finishedWorkpiece?.visible ?? false,
        })}`,
      )
    }
  }, [homeTransforms, inspection, onInspection, scene])

  return <primitive object={scene} />
})

useGLTF.preload(CNC_MODEL_URL)
