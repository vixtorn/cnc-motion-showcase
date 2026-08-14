import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  Points,
  PointsMaterial,
  Vector3,
} from 'three'
import { CNC_MACHINING } from '../animation/cncMachiningConfig'

export interface CoolantEffectHandle {
  startCoolant: () => void
  setCoolantIntensity: (value: number) => void
  stopCoolant: () => void
  pauseCoolant: () => void
  resumeCoolant: () => void
  resetCoolant: () => void
  getCoolantSnapshot: () => Record<string, unknown>
}

const { coolant } = CNC_MACHINING
const EMITTER = new Vector3(...coolant.emitterPosition)
const SPRAY_DIRECTION = new Vector3(...coolant.sprayDirection).normalize()
const GRAVITY = new Vector3(...coolant.gravity)

const pseudoRandom = (particle: number, channel: number, generation: number) => {
  const value = Math.sin(
    particle * 127.1 + channel * 311.7 + generation * 74.7,
  ) * 43758.5453
  return value - Math.floor(value)
}

export const CoolantEffect = forwardRef<CoolantEffectHandle>(function CoolantEffect(_, ref) {
  const invalidate = useThree((state) => state.invalidate)
  const pointsRef = useRef<Points>(null)
  const activeRef = useRef(false)
  const pausedRef = useRef(false)
  const intensityRef = useRef(0)
  const positions = useMemo(
    () => new Float32Array(coolant.particleCount * 3),
    [],
  )
  const velocities = useMemo(
    () => new Float32Array(coolant.particleCount * 3),
    [],
  )
  const lifetimes = useMemo(() => new Float32Array(coolant.particleCount), [])
  const generations = useMemo(() => new Uint16Array(coolant.particleCount), [])

  const geometry = useMemo(() => {
    const nextGeometry = new BufferGeometry()
    nextGeometry.setAttribute('position', new BufferAttribute(positions, 3))
    return nextGeometry
  }, [positions])

  const particleTexture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 32
    canvas.height = 32
    const context = canvas.getContext('2d')
    if (context) {
      const gradient = context.createRadialGradient(16, 16, 1, 16, 16, 16)
      gradient.addColorStop(0, 'rgba(255, 255, 255, 1)')
      gradient.addColorStop(0.48, 'rgba(255, 255, 255, 0.78)')
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
      context.fillStyle = gradient
      context.fillRect(0, 0, 32, 32)
    }
    return new CanvasTexture(canvas)
  }, [])

  const material = useMemo(
    () =>
      new PointsMaterial({
        color: new Color(coolant.color),
        map: particleTexture,
        transparent: true,
        opacity: 0,
        alphaTest: 0.02,
        depthWrite: false,
        size: coolant.minimumSize,
        sizeAttenuation: true,
        toneMapped: true,
      }),
    [particleTexture],
  )

  const spawnParticle = useCallback(
    (index: number, warmStart: boolean) => {
      const offset = index * 3
      const generation = generations[index]
      const spreadX =
        (pseudoRandom(index, 0, generation) - 0.5) * coolant.spread
      const spreadY =
        (pseudoRandom(index, 1, generation) - 0.5) * coolant.spread
      const spreadZ =
        (pseudoRandom(index, 2, generation) - 0.5) * coolant.spread
      const directionX = SPRAY_DIRECTION.x + spreadX
      const directionY = SPRAY_DIRECTION.y + spreadY
      const directionZ = SPRAY_DIRECTION.z + spreadZ
      const inverseLength =
        1 / Math.max(Math.hypot(directionX, directionY, directionZ), 0.0001)
      const speed =
        coolant.minimumSpeed +
        (coolant.maximumSpeed - coolant.minimumSpeed) *
          pseudoRandom(index, 3, generation)
      const lifetime =
        coolant.minimumLifetime +
        (coolant.maximumLifetime - coolant.minimumLifetime) *
          pseudoRandom(index, 4, generation)

      velocities[offset] = directionX * inverseLength * speed
      velocities[offset + 1] = directionY * inverseLength * speed
      velocities[offset + 2] = directionZ * inverseLength * speed
      lifetimes[index] = warmStart
        ? lifetime * pseudoRandom(index, 5, generation)
        : lifetime
      positions[offset] = EMITTER.x
      positions[offset + 1] = EMITTER.y
      positions[offset + 2] = EMITTER.z
      generations[index] += 1
    },
    [generations, lifetimes, positions, velocities],
  )

  const initializeParticles = useCallback(() => {
    generations.fill(0)
    for (let index = 0; index < coolant.particleCount; index += 1) {
      spawnParticle(index, true)
    }
    geometry.getAttribute('position').needsUpdate = true
  }, [generations, geometry, spawnParticle])

  const setCoolantIntensity = useCallback(
    (value: number) => {
      const intensity = Math.min(Math.max(value, 0), 1)
      intensityRef.current = intensity
      material.opacity =
        coolant.minimumOpacity +
        (coolant.maximumOpacity - coolant.minimumOpacity) * intensity
      material.size =
        coolant.minimumSize +
        (coolant.maximumSize - coolant.minimumSize) * intensity
      invalidate()
    },
    [invalidate, material],
  )

  const startCoolant = useCallback(() => {
    activeRef.current = true
    pausedRef.current = false
    if (pointsRef.current) pointsRef.current.visible = true
    invalidate()
  }, [invalidate])

  const stopCoolant = useCallback(() => {
    activeRef.current = false
    pausedRef.current = false
    intensityRef.current = 0
    material.opacity = 0
    if (pointsRef.current) pointsRef.current.visible = false
    invalidate()
  }, [invalidate, material])

  const pauseCoolant = useCallback(() => {
    pausedRef.current = true
  }, [])

  const resumeCoolant = useCallback(() => {
    if (!activeRef.current) return
    pausedRef.current = false
    invalidate()
  }, [invalidate])

  const resetCoolant = useCallback(() => {
    stopCoolant()
    initializeParticles()
  }, [initializeParticles, stopCoolant])

  const getCoolantSnapshot = useCallback(
    () => ({
      active: activeRef.current,
      paused: pausedRef.current,
      intensity: Number(intensityRef.current.toFixed(4)),
      visible: pointsRef.current?.visible ?? false,
      particleCount: coolant.particleCount,
    }),
    [],
  )

  useImperativeHandle(
    ref,
    () => ({
      startCoolant,
      setCoolantIntensity,
      stopCoolant,
      pauseCoolant,
      resumeCoolant,
      resetCoolant,
      getCoolantSnapshot,
    }),
    [
      getCoolantSnapshot,
      pauseCoolant,
      resetCoolant,
      resumeCoolant,
      setCoolantIntensity,
      startCoolant,
      stopCoolant,
    ],
  )

  useFrame((_, frameDelta) => {
    if (!activeRef.current || pausedRef.current || intensityRef.current <= 0) return

    const delta = Math.min(frameDelta, 0.05)
    const activeCount = Math.max(
      1,
      Math.floor(coolant.particleCount * intensityRef.current),
    )
    for (let index = 0; index < coolant.particleCount; index += 1) {
      const offset = index * 3
      if (index >= activeCount) {
        positions[offset] = EMITTER.x
        positions[offset + 1] = EMITTER.y
        positions[offset + 2] = EMITTER.z
        continue
      }

      lifetimes[index] -= delta
      if (lifetimes[index] <= 0) spawnParticle(index, false)
      velocities[offset] += GRAVITY.x * delta
      velocities[offset + 1] += GRAVITY.y * delta
      velocities[offset + 2] += GRAVITY.z * delta
      positions[offset] += velocities[offset] * delta
      positions[offset + 1] += velocities[offset + 1] * delta
      positions[offset + 2] += velocities[offset + 2] * delta
    }

    geometry.getAttribute('position').needsUpdate = true
    invalidate()
  })

  useEffect(() => {
    initializeParticles()
    if (pointsRef.current) pointsRef.current.visible = false
    return () => {
      geometry.dispose()
      material.dispose()
      particleTexture.dispose()
    }
  }, [geometry, initializeParticles, material, particleTexture])

  return (
    <points
      ref={pointsRef}
      geometry={geometry}
      material={material}
      frustumCulled={false}
      renderOrder={3}
    />
  )
})
