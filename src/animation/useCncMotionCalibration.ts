import { useCallback, useEffect } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { Vector3, type Object3D } from 'three'
import {
  CHUCK_ROTATION_AXIS,
  CHUCK_ROTATION_DURATION,
  type CncAxis,
} from './cncAnimationConfig'
import { VISUAL_CALIBRATION } from './visualCalibrationConfig'
import type {
  CalibrationAssembly,
  CalibrationDirection,
  CncHomeTransforms,
  CncNodes,
  HomeTransform,
} from '../types/cnc'

interface UseCncMotionCalibrationOptions {
  nodes: CncNodes
  homeTransforms: CncHomeTransforms
  isChuckTesting: boolean
  invalidate: () => void
}

const CALIBRATION_ASSEMBLIES: CalibrationAssembly[] = ['tailstock', 'turret', 'door']
const LOCAL_AXES: Record<CncAxis, Vector3> = {
  x: new Vector3(1, 0, 0),
  y: new Vector3(0, 1, 0),
  z: new Vector3(0, 0, 1),
}

const restoreHomeTransform = (target: Object3D, home: HomeTransform) => {
  target.position.set(home.position.x, home.position.y, home.position.z)
  target.rotation.set(home.rotation.x, home.rotation.y, home.rotation.z, home.rotation.order)
  target.scale.set(home.scale.x, home.scale.y, home.scale.z)
}

export function useCncMotionCalibration({
  nodes,
  homeTransforms,
  isChuckTesting,
  invalidate,
}: UseCncMotionCalibrationOptions) {
  const getAssembly = useCallback(
    (assembly: CalibrationAssembly) => ({
      target: nodes[assembly],
      home: homeTransforms[assembly],
    }),
    [homeTransforms, nodes],
  )

  const resetAssembly = useCallback(
    (assembly: CalibrationAssembly) => {
      const { target, home } = getAssembly(assembly)
      if (!target || !home) return

      gsap.killTweensOf(target.position)
      gsap.killTweensOf(target.rotation)
      gsap.killTweensOf(target.scale)
      const { resetDuration } = VISUAL_CALIBRATION.motionCalibration

      gsap.to(target.position, {
        x: home.position.x,
        y: home.position.y,
        z: home.position.z,
        duration: resetDuration,
        ease: 'power2.out',
        onUpdate: invalidate,
      })
      gsap.to(target.rotation, {
        x: home.rotation.x,
        y: home.rotation.y,
        z: home.rotation.z,
        duration: resetDuration,
        ease: 'power2.out',
        onUpdate: invalidate,
      })
      gsap.to(target.scale, {
        x: home.scale.x,
        y: home.scale.y,
        z: home.scale.z,
        duration: resetDuration,
        ease: 'power2.out',
        onUpdate: invalidate,
      })
    },
    [getAssembly, invalidate],
  )

  const testTranslation = useCallback(
    (assembly: CalibrationAssembly, axis: CncAxis, direction: CalibrationDirection) => {
      const { target, home } = getAssembly(assembly)
      if (!target || !home) return

      const { translationDistance, translationDuration } =
        VISUAL_CALIBRATION.motionCalibration
      const localOffset = LOCAL_AXES[axis]
        .clone()
        .applyEuler(home.rotation)
        .multiplyScalar(translationDistance * direction)

      gsap.killTweensOf(target.position)
      gsap.to(target.position, {
        x: home.position.x + localOffset.x,
        y: home.position.y + localOffset.y,
        z: home.position.z + localOffset.z,
        duration: translationDuration,
        ease: 'power2.inOut',
        overwrite: true,
        onUpdate: invalidate,
      })
    },
    [getAssembly, invalidate],
  )

  const resetAllAssemblies = useCallback(() => {
    CALIBRATION_ASSEMBLIES.forEach(resetAssembly)
  }, [resetAssembly])

  useGSAP(
    () => {
      const chuck = nodes.mainChuck
      const home = homeTransforms.mainChuck
      if (!chuck || !home) return

      gsap.killTweensOf(chuck.rotation)

      if (isChuckTesting) {
        restoreHomeTransform(chuck, home)
        const tween = gsap.to(chuck.rotation, {
          [CHUCK_ROTATION_AXIS]: home.rotation[CHUCK_ROTATION_AXIS] + Math.PI * 2,
          duration: CHUCK_ROTATION_DURATION,
          ease: 'none',
          repeat: -1,
          onUpdate: invalidate,
        })
        return () => tween.kill()
      }

      const tween = gsap.to(chuck.rotation, {
        x: home.rotation.x,
        y: home.rotation.y,
        z: home.rotation.z,
        duration: VISUAL_CALIBRATION.motionCalibration.resetDuration,
        ease: 'power2.out',
        overwrite: true,
        onUpdate: invalidate,
      })
      return () => tween.kill()
    },
    {
      dependencies: [homeTransforms.mainChuck, nodes.mainChuck, invalidate, isChuckTesting],
    },
  )

  useEffect(
    () => () => {
      const assemblies = {
        mainChuck: nodes.mainChuck,
        tailstock: nodes.tailstock,
        turret: nodes.turret,
        door: nodes.door,
      }

      for (const [key, target] of Object.entries(assemblies)) {
        const home = homeTransforms[key as keyof typeof assemblies]
        if (!target || !home) continue
        gsap.killTweensOf(target.position)
        gsap.killTweensOf(target.rotation)
        gsap.killTweensOf(target.scale)
        restoreHomeTransform(target, home)
      }
    },
    [homeTransforms, nodes],
  )

  return { testTranslation, resetAssembly, resetAllAssemblies }
}
