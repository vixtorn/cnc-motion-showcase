import { useCallback, useEffect, useMemo, useRef } from 'react'
import gsap from 'gsap'
import { Quaternion, Vector3, type Object3D } from 'three'
import {
  CHUCK_ROTATION_AXIS,
  CNC_MOTION_CALIBRATION,
  TURRET_INDEX_AXIS,
  type CncAxis,
} from './cncAnimationConfig'
import { CNC_MACHINING } from './cncMachiningConfig'
import type {
  CalibrationDirection,
  CncHomeTransforms,
  CncNodes,
  HomeTransform,
} from '../types/cnc'

interface UseCncMotionCalibrationOptions {
  nodes: CncNodes
  homeTransforms: CncHomeTransforms
  invalidate: () => void
}

interface ChuckStartOptions {
  rampDuration?: number
  rpmVisualSpeed?: number
}

type LocalOffsets = Partial<Record<CncAxis, number>>

export interface CncMotionController {
  startChuck: (options?: ChuckStartOptions) => void
  stopChuck: (reset?: boolean) => void
  pauseChuck: () => void
  resumeChuck: () => void
  setChuckVisualRpm: (rpmVisualSpeed: number, duration: number) => void
  setTailstockContact: (contact: boolean) => void
  resetTailstock: () => void
  testTurretCarriage: (axis: CncAxis, direction: CalibrationDirection) => void
  resetTurretCarriage: () => void
  testTurretIndex: (direction: CalibrationDirection) => void
  resetTurretIndex: () => void
  setDoorOpen: (open: boolean) => void
  resetDoor: () => void
  resetAllAssemblies: () => void
  killAllMotion: () => void
  restoreAllImmediate: () => void
  getMotionSnapshot: () => Record<string, unknown>
  addDoorToTimeline: (timeline: gsap.core.Timeline, at: number, duration: number) => void
  addTailstockToTimeline: (timeline: gsap.core.Timeline, at: number, duration: number) => void
  addTurretCarriageToTimeline: (
    timeline: gsap.core.Timeline,
    offsets: LocalOffsets,
    at: number,
    duration: number,
    label: string,
  ) => void
  addTurretIndexToTimeline: (
    timeline: gsap.core.Timeline,
    angle: number,
    at: number,
    duration: number,
  ) => void
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

const killObjectTweens = (target: Object3D) => {
  gsap.killTweensOf(target.position)
  gsap.killTweensOf(target.rotation)
  gsap.killTweensOf(target.quaternion)
  gsap.killTweensOf(target.scale)
}

const localOffsetFromHome = (
  home: HomeTransform,
  offsets: LocalOffsets,
) =>
  new Vector3(offsets.x ?? 0, offsets.y ?? 0, offsets.z ?? 0)
    .applyEuler(home.rotation)

const transformSnapshot = (target: Object3D) => ({
  position: target.position.toArray().map((value) => Number(value.toFixed(4))),
  rotation: [target.rotation.x, target.rotation.y, target.rotation.z].map((value) =>
    Number(value.toFixed(4)),
  ),
})

const worldTransformSnapshot = (target: Object3D | null) => {
  if (!target) return null
  target.updateWorldMatrix(true, false)
  return {
    position: target
      .getWorldPosition(new Vector3())
      .toArray()
      .map((value) => Number(value.toFixed(6))),
    quaternion: target
      .getWorldQuaternion(new Quaternion())
      .toArray()
      .map((value) => Number(value.toFixed(6))),
  }
}

const createHomeRelativeLocalAxisQuaternion = (
  home: HomeTransform,
  axis: CncAxis,
  angle: number,
) =>
  new Quaternion()
    .setFromEuler(home.rotation)
    .multiply(new Quaternion().setFromAxisAngle(LOCAL_AXES[axis], angle))

const createLocalAxisQuaternionTween = (
  target: Object3D,
  targetQuaternion: Quaternion,
  duration: number,
  invalidate: () => void,
  onComplete: () => void,
): gsap.TweenVars => ({
  x: targetQuaternion.x,
  y: targetQuaternion.y,
  z: targetQuaternion.z,
  w: targetQuaternion.w,
  duration,
  ease: 'power2.inOut',
  overwrite: true,
  onUpdate: () => {
    target.quaternion.normalize()
    invalidate()
  },
  onComplete: () => {
    target.quaternion.copy(targetQuaternion)
    target.updateMatrixWorld(true)
    onComplete()
  },
})

const logMotionEndpoint = (label: string, payload: object) => {
  if (import.meta.env.DEV) console.info(`[CNC] Motion endpoint ${label} ${JSON.stringify(payload)}`)
}

export function useCncMotionCalibration({
  nodes,
  homeTransforms,
  invalidate,
}: UseCncMotionCalibrationOptions): CncMotionController {
  const chuckSpeedTweenRef = useRef<gsap.core.Tween | null>(null)
  const chuckTickerRef = useRef<((time: number, deltaTime: number) => void) | null>(null)
  const chuckStateRef = useRef({ angle: 0, speed: 0, paused: false })

  const stopChuck = useCallback(
    (reset = true) => {
      chuckSpeedTweenRef.current?.kill()
      chuckSpeedTweenRef.current = null
      if (chuckTickerRef.current) gsap.ticker.remove(chuckTickerRef.current)
      chuckTickerRef.current = null
      if (reset) {
        chuckStateRef.current = { angle: 0, speed: 0, paused: false }
      } else {
        chuckStateRef.current.speed = 0
        chuckStateRef.current.paused = false
      }

      const target = nodes.mainChuck
      const home = homeTransforms.mainChuck
      if (reset && target && home) {
        gsap.killTweensOf(target.rotation)
        target.rotation.copy(home.rotation)
        target.updateMatrixWorld(true)
        invalidate()
      }
    },
    [homeTransforms.mainChuck, invalidate, nodes.mainChuck],
  )

  const startChuck = useCallback(
    (options: ChuckStartOptions = {}) => {
      const target = nodes.mainChuck
      const home = homeTransforms.mainChuck
      if (!target || !home) return

      stopChuck(true)
      const state = chuckStateRef.current
      const rampDuration = options.rampDuration ?? 0.85
      const rpmVisualSpeed =
        options.rpmVisualSpeed ?? CNC_MACHINING.chuck.machiningRpmVisualSpeed
      const targetSpeed = (rpmVisualSpeed * Math.PI * 2) / 60

      const ticker = (_time: number, deltaTime: number) => {
        if (state.paused || state.speed === 0) return
        state.angle = (state.angle + state.speed * (deltaTime / 1000)) % (Math.PI * 2)
        target.rotation[CHUCK_ROTATION_AXIS] =
          home.rotation[CHUCK_ROTATION_AXIS] + state.angle
        invalidate()
      }

      chuckTickerRef.current = ticker
      gsap.ticker.add(ticker)

      if (rampDuration <= 0) {
        state.speed = targetSpeed
      } else {
        chuckSpeedTweenRef.current = gsap.to(state, {
          speed: targetSpeed,
          duration: rampDuration,
          ease: 'power2.inOut',
        })
      }

      if (import.meta.env.DEV) {
        console.info(
          `[CNC] Chuck started ${JSON.stringify({
            axis: CHUCK_ROTATION_AXIS.toUpperCase(),
            rampDuration,
            rpmVisualSpeed,
          })}`,
        )
      }
    },
    [homeTransforms.mainChuck, invalidate, nodes.mainChuck, stopChuck],
  )

  const pauseChuck = useCallback(() => {
    chuckStateRef.current.paused = true
    chuckSpeedTweenRef.current?.pause()
  }, [])

  const resumeChuck = useCallback(() => {
    if (!chuckTickerRef.current) return
    chuckStateRef.current.paused = false
    chuckSpeedTweenRef.current?.resume()
  }, [])

  const setChuckVisualRpm = useCallback(
    (rpmVisualSpeed: number, duration: number) => {
      if (!chuckTickerRef.current) return
      chuckSpeedTweenRef.current?.kill()
      const targetSpeed = (rpmVisualSpeed * Math.PI * 2) / 60
      chuckSpeedTweenRef.current = gsap.to(chuckStateRef.current, {
        speed: targetSpeed,
        duration,
        ease: 'power2.inOut',
        overwrite: true,
      })
      if (import.meta.env.DEV) {
        console.info(
          `[CNC] Chuck speed target ${JSON.stringify({ rpmVisualSpeed, duration })}`,
        )
      }
    },
    [],
  )

  const animatePosition = useCallback(
    (target: Object3D, home: HomeTransform, offsets: LocalOffsets, onComplete?: () => void) => {
      const offset = localOffsetFromHome(home, offsets)
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

      killObjectTweens(target)
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
      animatePosition(target, home, { z: distance }, () => {
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

      animatePosition(
        target,
        home,
        { [axis]: CNC_MOTION_CALIBRATION.translationTestDistance * direction },
        () => {
          logMotionEndpoint(`turret-carriage-${axis}${direction > 0 ? '+' : '-'}`, {
            carriage: transformSnapshot(target),
            centerHubWorldPosition: nodes.turretCenterHub
              ?.getWorldPosition(new Vector3())
              .toArray()
              .map((value) => Number(value.toFixed(4))),
            rearSleeveWorld: worldTransformSnapshot(nodes.turretRearSleeve),
          })
        },
      )
    },
    [
      animatePosition,
      homeTransforms.turretCarriage,
      nodes.turretCarriage,
      nodes.turretCenterHub,
      nodes.turretRearSleeve,
    ],
  )

  const resetTurretCarriage = useCallback(() => {
    resetTarget(nodes.turretCarriage, homeTransforms.turretCarriage)
  }, [homeTransforms.turretCarriage, nodes.turretCarriage, resetTarget])

  const testTurretIndex = useCallback(
    (direction: CalibrationDirection) => {
      const target = nodes.turretIndex
      const home = homeTransforms.turretIndex
      if (!target || !home) return

      const targetQuaternion = createHomeRelativeLocalAxisQuaternion(
        home,
        TURRET_INDEX_AXIS,
        CNC_MOTION_CALIBRATION.turretIndexStepRadians * direction,
      )

      gsap.killTweensOf(target.rotation)
      gsap.killTweensOf(target.quaternion)
      gsap.to(
        target.quaternion,
        createLocalAxisQuaternionTween(
          target,
          targetQuaternion,
          CNC_MOTION_CALIBRATION.rotationDuration,
          invalidate,
          () => {
            logMotionEndpoint(
              `turret-index-${TURRET_INDEX_AXIS}${direction > 0 ? '+' : '-'}`,
              {
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
                rearSleeve: {
                  local: nodes.turretRearSleeve
                    ? transformSnapshot(nodes.turretRearSleeve)
                    : null,
                  world: worldTransformSnapshot(nodes.turretRearSleeve),
                },
              },
            )
          },
        ),
      )
    },
    [
      homeTransforms.turretIndex,
      invalidate,
      nodes.turretCarriage,
      nodes.turretCenterHub,
      nodes.turretIndex,
      nodes.turretRearSleeve,
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
        rearSleeveWorld: worldTransformSnapshot(nodes.turretRearSleeve),
      })
    })
  }, [homeTransforms.turretIndex, nodes.turretIndex, nodes.turretRearSleeve, resetTarget])

  const setDoorOpen = useCallback(
    (open: boolean) => {
      const target = nodes.door
      const home = homeTransforms.door
      if (!target || !home) return

      const distance = open ? CNC_MOTION_CALIBRATION.doorOpenDistance : 0
      animatePosition(target, home, { z: distance }, () => {
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

  const killAllMotion = useCallback(() => {
    stopChuck(true)
    const targets = [
      nodes.mainChuck,
      nodes.tailstock,
      nodes.turretCarriage,
      nodes.turretIndex,
      nodes.door,
    ]
    for (const target of targets) {
      if (target) killObjectTweens(target)
    }
  }, [nodes.door, nodes.mainChuck, nodes.tailstock, nodes.turretCarriage, nodes.turretIndex, stopChuck])

  const restoreAllImmediate = useCallback(() => {
    killAllMotion()
    const targets = [
      [nodes.mainChuck, homeTransforms.mainChuck],
      [nodes.tailstock, homeTransforms.tailstock],
      [nodes.turretCarriage, homeTransforms.turretCarriage],
      [nodes.turretIndex, homeTransforms.turretIndex],
      [nodes.door, homeTransforms.door],
    ] as const

    for (const [target, home] of targets) {
      if (target && home) restoreHomeTransform(target, home)
    }
    invalidate()
  }, [homeTransforms, invalidate, killAllMotion, nodes])

  const getMotionSnapshot = useCallback(() => {
    return {
      chuck: {
        angle: Number(chuckStateRef.current.angle.toFixed(6)),
        speed: Number(chuckStateRef.current.speed.toFixed(6)),
        paused: chuckStateRef.current.paused,
        running: Boolean(chuckTickerRef.current),
        local: nodes.mainChuck ? transformSnapshot(nodes.mainChuck) : null,
      },
      door: nodes.door ? transformSnapshot(nodes.door) : null,
      tailstock: nodes.tailstock ? transformSnapshot(nodes.tailstock) : null,
      turretCarriage: nodes.turretCarriage
        ? transformSnapshot(nodes.turretCarriage)
        : null,
      turretIndex: nodes.turretIndex ? transformSnapshot(nodes.turretIndex) : null,
      turretIndexWorld: worldTransformSnapshot(nodes.turretIndex),
      turretRearSleeveWorld: worldTransformSnapshot(nodes.turretRearSleeve),
      turretCenterHubWorld: worldTransformSnapshot(nodes.turretCenterHub),
    }
  }, [nodes])

  const resetAllAssemblies = useCallback(() => {
    stopChuck(true)
    resetTailstock()
    resetTurretCarriage()
    resetTurretIndex()
    resetDoor()
  }, [resetDoor, resetTailstock, resetTurretCarriage, resetTurretIndex, stopChuck])

  const addDoorToTimeline = useCallback(
    (timeline: gsap.core.Timeline, at: number, duration: number) => {
      const target = nodes.door
      const home = homeTransforms.door
      if (!target || !home) return
      const offset = localOffsetFromHome(home, { z: CNC_MOTION_CALIBRATION.doorOpenDistance })
      timeline.to(
        target.position,
        {
          x: home.position.x + offset.x,
          y: home.position.y + offset.y,
          z: home.position.z + offset.z,
          duration,
          ease: 'power2.inOut',
          onUpdate: invalidate,
          onComplete: () => {
            const worldPosition = (object: Object3D | null) =>
              object
                ?.getWorldPosition(new Vector3())
                .toArray()
                .map((value) => Number(value.toFixed(4)))
            logMotionEndpoint('sequence-door-open', {
              door: transformSnapshot(target),
              body: worldPosition(nodes.doorBody),
              glass: worldPosition(nodes.doorGlass),
              lowerStrip: worldPosition(nodes.doorLowerStrip),
              fixedFrame: worldPosition(nodes.doorFixedFrame),
            })
          },
        },
        at,
      )
    },
    [
      homeTransforms.door,
      invalidate,
      nodes.door,
      nodes.doorBody,
      nodes.doorFixedFrame,
      nodes.doorGlass,
      nodes.doorLowerStrip,
    ],
  )

  const addTailstockToTimeline = useCallback(
    (timeline: gsap.core.Timeline, at: number, duration: number) => {
      const target = nodes.tailstock
      const home = homeTransforms.tailstock
      if (!target || !home) return
      const offset = localOffsetFromHome(home, { z: CNC_MOTION_CALIBRATION.tailstockContactDistance })
      timeline.to(
        target.position,
        {
          x: home.position.x + offset.x,
          y: home.position.y + offset.y,
          z: home.position.z + offset.z,
          duration,
          ease: 'power2.inOut',
          onUpdate: invalidate,
          onComplete: () => logMotionEndpoint('sequence-tailstock-contact', transformSnapshot(target)),
        },
        at,
      )
    },
    [homeTransforms.tailstock, invalidate, nodes.tailstock],
  )

  const addTurretCarriageToTimeline = useCallback(
    (
      timeline: gsap.core.Timeline,
      offsets: LocalOffsets,
      at: number,
      duration: number,
      label: string,
    ) => {
      const target = nodes.turretCarriage
      const home = homeTransforms.turretCarriage
      if (!target || !home) return
      const offset = localOffsetFromHome(home, offsets)
      timeline.to(
        target.position,
        {
          x: home.position.x + offset.x,
          y: home.position.y + offset.y,
          z: home.position.z + offset.z,
          duration,
          ease: 'power2.inOut',
          onUpdate: invalidate,
          onComplete: () =>
            logMotionEndpoint(`sequence-turret-${label}`, {
              carriage: transformSnapshot(target),
              centerHubWorldPosition: nodes.turretCenterHub
                ?.getWorldPosition(new Vector3())
                .toArray()
                .map((value) => Number(value.toFixed(4))),
              rearSleeveWorld: worldTransformSnapshot(nodes.turretRearSleeve),
            }),
        },
        at,
      )
    },
    [
      homeTransforms.turretCarriage,
      invalidate,
      nodes.turretCarriage,
      nodes.turretCenterHub,
      nodes.turretRearSleeve,
    ],
  )

  const addTurretIndexToTimeline = useCallback(
    (timeline: gsap.core.Timeline, angle: number, at: number, duration: number) => {
      const target = nodes.turretIndex
      const home = homeTransforms.turretIndex
      if (!target || !home) return
      const targetQuaternion = createHomeRelativeLocalAxisQuaternion(
        home,
        TURRET_INDEX_AXIS,
        angle,
      )

      timeline.to(
        target.quaternion,
        createLocalAxisQuaternionTween(
          target,
          targetQuaternion,
          duration,
          invalidate,
          () => {
            logMotionEndpoint('sequence-turret-index-z+', {
              localQuaternion: target.quaternion
                .toArray()
                .map((value) => Number(value.toFixed(6))),
              centerHubWorldQuaternion: nodes.turretCenterHub
                ?.getWorldQuaternion(new Quaternion())
                .toArray()
                .map((value) => Number(value.toFixed(6))),
              rearSleeveWorldQuaternion: nodes.turretRearSleeve
                ?.getWorldQuaternion(new Quaternion())
                .toArray()
                .map((value) => Number(value.toFixed(6))),
            })
          },
        ),
        at,
      )
    },
    [
      homeTransforms.turretIndex,
      invalidate,
      nodes.turretCenterHub,
      nodes.turretIndex,
      nodes.turretRearSleeve,
    ],
  )

  useEffect(
    () => () => {
      killAllMotion()
      const targets = [
        [nodes.mainChuck, homeTransforms.mainChuck],
        [nodes.tailstock, homeTransforms.tailstock],
        [nodes.turretCarriage, homeTransforms.turretCarriage],
        [nodes.turretIndex, homeTransforms.turretIndex],
        [nodes.door, homeTransforms.door],
      ] as const
      for (const [target, home] of targets) {
        if (target && home) restoreHomeTransform(target, home)
      }
    },
    [homeTransforms, killAllMotion, nodes],
  )

  return useMemo(
    () => ({
      startChuck,
      stopChuck,
      pauseChuck,
      resumeChuck,
      setChuckVisualRpm,
      setTailstockContact,
      resetTailstock,
      testTurretCarriage,
      resetTurretCarriage,
      testTurretIndex,
      resetTurretIndex,
      setDoorOpen,
      resetDoor,
      resetAllAssemblies,
      killAllMotion,
      restoreAllImmediate,
      getMotionSnapshot,
      addDoorToTimeline,
      addTailstockToTimeline,
      addTurretCarriageToTimeline,
      addTurretIndexToTimeline,
    }),
    [
      addDoorToTimeline,
      addTailstockToTimeline,
      addTurretCarriageToTimeline,
      addTurretIndexToTimeline,
      getMotionSnapshot,
      killAllMotion,
      pauseChuck,
      resetAllAssemblies,
      resetDoor,
      resetTailstock,
      resetTurretCarriage,
      resetTurretIndex,
      restoreAllImmediate,
      resumeChuck,
      setChuckVisualRpm,
      setDoorOpen,
      setTailstockContact,
      startChuck,
      stopChuck,
      testTurretCarriage,
      testTurretIndex,
    ],
  )
}
