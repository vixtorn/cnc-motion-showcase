import { useCallback, useEffect, useMemo } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { Quaternion, Vector3, type Object3D } from 'three'
import {
  CHUCK_ROTATION_AXIS,
  CHUCK_ROTATION_DURATION,
  CNC_MOTION_CALIBRATION,
  TURRET_INDEX_AXIS,
  type CncAxis,
} from './cncAnimationConfig'
import type {
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

const LOCAL_AXES: Record<CncAxis, Vector3> = {
  x: new Vector3(1, 0, 0),
  y: new Vector3(0, 1, 0),
  z: new Vector3(0, 0, 1),
}

const restoreHomeTransform = (target: Object3D, home: HomeTransform) => {
  target.position.copy(home.position)
  target.rotation.copy(home.rotation)
  target.scale.copy(home.scale)
}

const localOffsetFromHome = (
  home: HomeTransform,
  axis: CncAxis,
  distance: number,
) => LOCAL_AXES[axis].clone().applyEuler(home.rotation).multiplyScalar(distance)

const transformSnapshot = (target: Object3D) => ({
  position: target.position.toArray().map((value) => Number(value.toFixed(4))),
  rotation: [target.rotation.x, target.rotation.y, target.rotation.z].map((value) =>
    Number(value.toFixed(4)),
  ),
})

const logMotionEndpoint = (label: string, payload: object) => {
  if (import.meta.env.DEV) console.info(`[CNC] Motion endpoint ${label} ${JSON.stringify(payload)}`)
}

export function useCncMotionCalibration({
  nodes,
  homeTransforms,
  isChuckTesting,
  invalidate,
}: UseCncMotionCalibrationOptions) {
  const animatePosition = useCallback(
    (target: Object3D, home: HomeTransform, offset: Vector3, onComplete?: () => void) => {
      gsap.killTweensOf(target.position)
      gsap.to(target.position, {
        x: home.position.x + offset.x,
        y: home.position.y + offset.y,
        z: home.position.z + offset.z,
        duration: CNC_MOTION_CALIBRATION.translationDuration,
        ease: 'power2.inOut',
        overwrite: true,
        onUpdate: invalidate,
        onComplete,
      })
    },
    [invalidate],
  )

  const resetTarget = useCallback(
    (target: Object3D | null, home: HomeTransform | null, onComplete?: () => void) => {
      if (!target || !home) return

      gsap.killTweensOf(target.position)
      gsap.killTweensOf(target.rotation)
      gsap.killTweensOf(target.quaternion)
      gsap.killTweensOf(target.scale)
      const tweenOptions = {
        duration: CNC_MOTION_CALIBRATION.resetDuration,
        ease: 'power2.out',
        overwrite: true,
        onUpdate: invalidate,
      }

      gsap.to(target.position, {
        x: home.position.x,
        y: home.position.y,
        z: home.position.z,
        ...tweenOptions,
      })
      gsap.to(target.rotation, {
        x: home.rotation.x,
        y: home.rotation.y,
        z: home.rotation.z,
        ...tweenOptions,
        onComplete,
      })
      gsap.to(target.scale, {
        x: home.scale.x,
        y: home.scale.y,
        z: home.scale.z,
        ...tweenOptions,
      })
    },
    [invalidate],
  )

  const setTailstockContact = useCallback(
    (contact: boolean) => {
      const target = nodes.tailstock
      const home = homeTransforms.tailstock
      if (!target || !home) return

      const distance = contact ? CNC_MOTION_CALIBRATION.tailstockContactDistance : 0
      animatePosition(target, home, localOffsetFromHome(home, 'z', distance), () => {
        logMotionEndpoint(contact ? 'tailstock-contact' : 'tailstock-home', transformSnapshot(target))
      })
    },
    [animatePosition, homeTransforms.tailstock, nodes.tailstock],
  )

  const resetTailstock = useCallback(() => {
    resetTarget(nodes.tailstock, homeTransforms.tailstock)
  }, [homeTransforms.tailstock, nodes.tailstock, resetTarget])

  const testTurretCarriage = useCallback(
    (axis: CncAxis, direction: CalibrationDirection) => {
      const target = nodes.turretCarriage
      const home = homeTransforms.turretCarriage
      if (!target || !home) return

      const distance = CNC_MOTION_CALIBRATION.translationTestDistance * direction
      animatePosition(target, home, localOffsetFromHome(home, axis, distance), () => {
        logMotionEndpoint(`turret-carriage-${axis}${direction > 0 ? '+' : '-'}`, {
          carriage: transformSnapshot(target),
          centerHubWorldPosition: nodes.turretCenterHub
            ?.getWorldPosition(new Vector3())
            .toArray()
            .map((value) => Number(value.toFixed(4))),
        })
      })
    },
    [animatePosition, homeTransforms.turretCarriage, nodes.turretCarriage, nodes.turretCenterHub],
  )

  const resetTurretCarriage = useCallback(() => {
    resetTarget(nodes.turretCarriage, homeTransforms.turretCarriage)
  }, [homeTransforms.turretCarriage, nodes.turretCarriage, resetTarget])

  const testTurretIndex = useCallback(
    (direction: CalibrationDirection) => {
      const target = nodes.turretIndex
      const home = homeTransforms.turretIndex
      if (!target || !home) return

      const homeQuaternion = new Quaternion().setFromEuler(home.rotation)
      const localAxisDelta = new Quaternion().setFromAxisAngle(
        LOCAL_AXES[TURRET_INDEX_AXIS],
        CNC_MOTION_CALIBRATION.turretIndexStepRadians * direction,
      )
      const targetQuaternion = homeQuaternion.clone().multiply(localAxisDelta)

      gsap.killTweensOf(target.rotation)
      gsap.killTweensOf(target.quaternion)
      gsap.to(target.quaternion, {
        x: targetQuaternion.x,
        y: targetQuaternion.y,
        z: targetQuaternion.z,
        w: targetQuaternion.w,
        duration: CNC_MOTION_CALIBRATION.rotationDuration,
        ease: 'power2.inOut',
        overwrite: true,
        onUpdate: () => {
          target.quaternion.normalize()
          invalidate()
        },
        onComplete: () => {
          target.quaternion.copy(targetQuaternion)
          target.updateMatrixWorld(true)
          logMotionEndpoint(`turret-index-${TURRET_INDEX_AXIS}${direction > 0 ? '+' : '-'}`, {
            selectedAxis: `${TURRET_INDEX_AXIS.toUpperCase()}${direction > 0 ? '+' : '-'}`,
            parent: target.parent?.name ?? null,
            localQuaternion: target.quaternion
              .toArray()
              .map((value) => Number(value.toFixed(6))),
            worldQuaternion: target
              .getWorldQuaternion(new Quaternion())
              .toArray()
              .map((value) => Number(value.toFixed(6))),
            localPosition: target.position
              .toArray()
              .map((value) => Number(value.toFixed(6))),
            worldPosition: target
              .getWorldPosition(new Vector3())
              .toArray()
              .map((value) => Number(value.toFixed(6))),
            carriage: nodes.turretCarriage
              ? transformSnapshot(nodes.turretCarriage)
              : null,
            centerHub: nodes.turretCenterHub
              ? {
                  ...transformSnapshot(nodes.turretCenterHub),
                  worldQuaternion: nodes.turretCenterHub
                    .getWorldQuaternion(new Quaternion())
                    .toArray()
                    .map((value) => Number(value.toFixed(6))),
                }
              : null,
          })
        },
      })
    },
    [
      homeTransforms.turretIndex,
      invalidate,
      nodes.turretCarriage,
      nodes.turretCenterHub,
      nodes.turretIndex,
    ],
  )

  const resetTurretIndex = useCallback(() => {
    const target = nodes.turretIndex
    const home = homeTransforms.turretIndex
    resetTarget(target, home, () => {
      if (!target || !home) return
      logMotionEndpoint('turret-index-reset', {
        index: transformSnapshot(target),
        expectedHome: {
          position: home.position.toArray().map((value) => Number(value.toFixed(6))),
          rotation: [home.rotation.x, home.rotation.y, home.rotation.z].map((value) =>
            Number(value.toFixed(6)),
          ),
        },
      })
    })
  }, [homeTransforms.turretIndex, nodes.turretIndex, resetTarget])

  const setDoorOpen = useCallback(
    (open: boolean) => {
      const target = nodes.door
      const home = homeTransforms.door
      if (!target || !home) return

      const distance = open ? CNC_MOTION_CALIBRATION.doorOpenDistance : 0
      const doorOffset = localOffsetFromHome(home, 'z', distance)
      animatePosition(target, home, doorOffset, () => {
        const worldPosition = (object: Object3D | null) =>
          object
            ?.getWorldPosition(new Vector3())
            .toArray()
            .map((value) => Number(value.toFixed(4)))
        logMotionEndpoint(open ? 'door-open' : 'door-close', {
          door: transformSnapshot(target),
          body: worldPosition(nodes.doorBody),
          glass: worldPosition(nodes.doorGlass),
          lowerStrip: worldPosition(nodes.doorLowerStrip),
          fixedFrame: worldPosition(nodes.doorFixedFrame),
        })
      })
    },
    [
      animatePosition,
      homeTransforms.door,
      nodes.door,
      nodes.doorBody,
      nodes.doorFixedFrame,
      nodes.doorGlass,
      nodes.doorLowerStrip,
    ],
  )

  const resetDoor = useCallback(() => {
    resetTarget(nodes.door, homeTransforms.door)
  }, [homeTransforms.door, nodes.door, resetTarget])

  const resetAllAssemblies = useCallback(() => {
    resetTailstock()
    resetTurretCarriage()
    resetTurretIndex()
    resetDoor()
  }, [resetDoor, resetTailstock, resetTurretCarriage, resetTurretIndex])

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
        duration: CNC_MOTION_CALIBRATION.resetDuration,
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
      const targets = [
        [nodes.mainChuck, homeTransforms.mainChuck],
        [nodes.tailstock, homeTransforms.tailstock],
        [nodes.turretCarriage, homeTransforms.turretCarriage],
        [nodes.turretIndex, homeTransforms.turretIndex],
        [nodes.door, homeTransforms.door],
      ] as const

      for (const [target, home] of targets) {
        if (!target || !home) continue
        gsap.killTweensOf(target.position)
        gsap.killTweensOf(target.rotation)
        gsap.killTweensOf(target.quaternion)
        gsap.killTweensOf(target.scale)
        restoreHomeTransform(target, home)
      }
    },
    [homeTransforms, nodes],
  )

  return useMemo(
    () => ({
      setTailstockContact,
      resetTailstock,
      testTurretCarriage,
      resetTurretCarriage,
      testTurretIndex,
      resetTurretIndex,
      setDoorOpen,
      resetDoor,
      resetAllAssemblies,
    }),
    [
      resetAllAssemblies,
      resetDoor,
      resetTailstock,
      resetTurretCarriage,
      resetTurretIndex,
      setDoorOpen,
      setTailstockContact,
      testTurretCarriage,
      testTurretIndex,
    ],
  )
}
