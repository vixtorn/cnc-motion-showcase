import { useEffect, useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import {
  CHUCK_ROTATION_DURATION,
  CNC_MODEL_URL,
  type ChuckAxis,
} from '../animation/cncAnimationConfig'
import { useCncNodes } from '../hooks/useCncNodes'
import type { CncInspection } from '../types/cnc'

interface CNCModelProps {
  chuckAxis: ChuckAxis
  isChuckTesting: boolean
  onInspection: (inspection: CncInspection) => void
}

const auditedScenes = new WeakSet<object>()

export function CNCModel({ chuckAxis, isChuckTesting, onInspection }: CNCModelProps) {
  const { scene } = useGLTF(CNC_MODEL_URL)
  const inspection = useCncNodes(scene)
  const invalidate = useThree((state) => state.invalidate)
  const initialChuckRotation = useMemo(
    () => inspection.nodes.mainChuck?.rotation.clone() ?? null,
    [inspection.nodes.mainChuck],
  )

  useEffect(() => {
    onInspection(inspection)

    if (import.meta.env.DEV && !auditedScenes.has(scene)) {
      auditedScenes.add(scene)
      inspection.printAudit()
    }
  }, [inspection, onInspection, scene])

  useGSAP(
    () => {
      const chuck = inspection.nodes.mainChuck
      if (!chuck || !initialChuckRotation) return

      gsap.killTweensOf(chuck.rotation)

      if (isChuckTesting) {
        chuck.rotation.copy(initialChuckRotation)
        const tween = gsap.to(chuck.rotation, {
          [chuckAxis]: initialChuckRotation[chuckAxis] + Math.PI * 2,
          duration: CHUCK_ROTATION_DURATION,
          ease: 'none',
          repeat: -1,
          onUpdate: invalidate,
        })
        return () => tween.kill()
      }

      const tween = gsap.to(chuck.rotation, {
        x: initialChuckRotation.x,
        y: initialChuckRotation.y,
        z: initialChuckRotation.z,
        duration: 0.55,
        ease: 'power2.out',
        overwrite: true,
        onUpdate: invalidate,
      })

      return () => tween.kill()
    },
    {
      dependencies: [
        chuckAxis,
        initialChuckRotation,
        inspection.nodes.mainChuck,
        invalidate,
        isChuckTesting,
      ],
    },
  )

  useEffect(
    () => () => {
      const chuck = inspection.nodes.mainChuck
      if (chuck && initialChuckRotation) {
        gsap.killTweensOf(chuck.rotation)
        chuck.rotation.copy(initialChuckRotation)
      }
    },
    [initialChuckRotation, inspection.nodes.mainChuck],
  )

  return <primitive object={scene} />
}

useGLTF.preload(CNC_MODEL_URL)
