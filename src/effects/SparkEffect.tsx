import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
  AdditiveBlending,
  Box3,
  BufferAttribute,
  BufferGeometry,
  Color,
  ShaderMaterial,
  Vector3,
  type Object3D,
} from 'three'
import { CNC_MACHINING } from '../animation/cncMachiningConfig'

export interface SparkEffectHandle {
  startSparks: (source?: 'diagnostic' | 'sequence') => void
  stopSparks: (source?: 'diagnostic' | 'sequence', clearExisting?: boolean) => void
  resetSparks: () => void
  getSparkSnapshot: () => Record<string, unknown>
}

interface SparkEffectProps {
  rawWorkpiece: Object3D | null
  finishedWorkpiece: Object3D | null
  tailstockTip: Object3D | null
}

const config = CNC_MACHINING.sparks

export const SparkEffect = forwardRef<SparkEffectHandle, SparkEffectProps>(function SparkEffect(
  { rawWorkpiece, finishedWorkpiece, tailstockTip },
  ref,
) {
  const invalidate = useThree((state) => state.invalidate)
  const activeRef = useRef(false)
  const spawnAccumulatorRef = useRef(0)
  const cursorRef = useRef(0)
  const liveCountRef = useRef(0)
  const originLoggedRef = useRef(false)
  const contactBoundsRef = useRef(new Box3())
  const tailstockBoundsRef = useRef(new Box3())
  const tailstockCenterRef = useRef(new Vector3())
  const emissionOriginRef = useRef(new Vector3())

  const resources = useMemo(() => {
    const positions = new Float32Array(config.particleCount * 3)
    const colors = new Float32Array(config.particleCount * 3)
    const velocities = new Float32Array(config.particleCount * 3)
    const sizes = new Float32Array(config.particleCount)
    const lifetimes = new Float32Array(config.particleCount)
    const maximumLifetimes = new Float32Array(config.particleCount)
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(positions, 3))
    geometry.setAttribute('color', new BufferAttribute(colors, 3))
    geometry.setAttribute('particleSize', new BufferAttribute(sizes, 1))
    const material = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: true,
      toneMapped: false,
      blending: AdditiveBlending,
      vertexShader: `
        attribute vec3 color;
        attribute float particleSize;
        varying vec3 vColor;

        void main() {
          vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
          vColor = color;
          gl_PointSize = max(3.0, particleSize * (360.0 / max(1.0, -viewPosition.z)));
          gl_Position = projectionMatrix * viewPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;

        void main() {
          float radius = distance(gl_PointCoord, vec2(0.5));
          float edge = 1.0 - smoothstep(0.34, 0.5, radius);
          gl_FragColor = vec4(vColor, edge * 0.98);
        }
      `,
    })
    return {
      positions,
      colors,
      velocities,
      sizes,
      lifetimes,
      maximumLifetimes,
      geometry,
      material,
      baseColor: new Color(config.color),
    }
  }, [])

  const clearPool = useCallback(() => {
    resources.positions.fill(0)
    resources.colors.fill(0)
    resources.velocities.fill(0)
    resources.sizes.fill(0)
    resources.lifetimes.fill(0)
    resources.maximumLifetimes.fill(0)
    resources.geometry.attributes.position.needsUpdate = true
    resources.geometry.attributes.color.needsUpdate = true
    resources.geometry.attributes.particleSize.needsUpdate = true
    liveCountRef.current = 0
    cursorRef.current = 0
    spawnAccumulatorRef.current = 0
  }, [resources])

  useImperativeHandle(
    ref,
    () => ({
      startSparks: (source = 'diagnostic') => {
        activeRef.current = true
        originLoggedRef.current = false
        spawnAccumulatorRef.current = 1
        invalidate()
        if (import.meta.env.DEV) console.info(`[CNC] Spark ${source} START`)
      },
      stopSparks: (source = 'diagnostic', clearExisting = false) => {
        activeRef.current = false
        if (clearExisting) clearPool()
        invalidate()
        if (import.meta.env.DEV) console.info(`[CNC] Spark ${source} STOP`)
      },
      resetSparks: () => {
        activeRef.current = false
        originLoggedRef.current = false
        clearPool()
        invalidate()
        if (import.meta.env.DEV) console.info('[CNC] Spark diagnostic RESET')
      },
      getSparkSnapshot: () => ({
        active: activeRef.current,
        liveParticles: liveCountRef.current,
        poolSize: config.particleCount,
        emissionOrigin: emissionOriginRef.current
          .toArray()
          .map((value) => Number(value.toFixed(4))),
      }),
    }),
    [clearPool, invalidate],
  )

  useFrame((_, delta) => {
    if (!activeRef.current && liveCountRef.current === 0) return

    const workpiece = finishedWorkpiece?.visible ? finishedWorkpiece : rawWorkpiece
    if (workpiece && tailstockTip) {
      const bounds = contactBoundsRef.current.setFromObject(workpiece)
      const tailstockBounds = tailstockBoundsRef.current.setFromObject(tailstockTip)
      const tailstockCenter = tailstockBounds.getCenter(tailstockCenterRef.current)
      emissionOriginRef.current.set(
        tailstockCenter.x,
        tailstockCenter.y,
        bounds.min.z,
      )
      if (activeRef.current && !originLoggedRef.current && import.meta.env.DEV) {
        originLoggedRef.current = true
        console.info(
          `[CNC] Spark contact derived ${JSON.stringify({
            workpiece: workpiece.name,
            tailstockTip: tailstockTip.name,
            origin: emissionOriginRef.current.toArray().map((value) => Number(value.toFixed(4))),
            workpieceTailstockSurfaceZ: Number(bounds.min.z.toFixed(4)),
            tailstockTipSurfaceZ: Number(tailstockBounds.max.z.toFixed(4)),
          })}`,
        )
      }
    }

    if (activeRef.current && workpiece) {
      spawnAccumulatorRef.current += delta * config.spawnRate
      const spawnCount = Math.min(Math.floor(spawnAccumulatorRef.current), 4)
      spawnAccumulatorRef.current -= spawnCount
      for (let spawned = 0; spawned < spawnCount; spawned += 1) {
        let index = cursorRef.current
        for (let probe = 0; probe < config.particleCount; probe += 1) {
          const candidate = (cursorRef.current + probe) % config.particleCount
          if (resources.lifetimes[candidate] <= 0) {
            index = candidate
            break
          }
        }
        cursorRef.current = (index + 1) % config.particleCount
        const offset = index * 3
        const lifetime =
          config.minimumLifetime +
          Math.random() * (config.maximumLifetime - config.minimumLifetime)
        const speed =
          config.minimumSpeed + Math.random() * (config.maximumSpeed - config.minimumSpeed)
        const directionX = 0.25 + Math.random() * 0.85
        const directionY = 0.25 + Math.random() * 0.75
        const directionZ = -0.45 + Math.random() * 0.65
        const directionLength = Math.hypot(directionX, directionY, directionZ)

        resources.positions[offset] = emissionOriginRef.current.x + (Math.random() - 0.5) * 0.22
        resources.positions[offset + 1] = emissionOriginRef.current.y + (Math.random() - 0.5) * 0.22
        resources.positions[offset + 2] = emissionOriginRef.current.z
        resources.velocities[offset] = (directionX / directionLength) * speed
        resources.velocities[offset + 1] = (directionY / directionLength) * speed
        resources.velocities[offset + 2] = (directionZ / directionLength) * speed
        resources.lifetimes[index] = lifetime
        resources.maximumLifetimes[index] = lifetime
        resources.sizes[index] =
          config.minimumSize + Math.random() * (config.maximumSize - config.minimumSize)
        resources.colors[offset] = resources.baseColor.r
        resources.colors[offset + 1] = resources.baseColor.g
        resources.colors[offset + 2] = resources.baseColor.b
      }
    }

    let liveCount = 0
    for (let index = 0; index < config.particleCount; index += 1) {
      if (resources.lifetimes[index] <= 0) continue
      const offset = index * 3
      resources.lifetimes[index] = Math.max(0, resources.lifetimes[index] - delta)
      if (resources.lifetimes[index] === 0) {
        resources.colors[offset] = 0
        resources.colors[offset + 1] = 0
        resources.colors[offset + 2] = 0
        continue
      }

      resources.velocities[offset] += config.gravity[0] * delta
      resources.velocities[offset + 1] += config.gravity[1] * delta
      resources.velocities[offset + 2] += config.gravity[2] * delta
      resources.positions[offset] += resources.velocities[offset] * delta
      resources.positions[offset + 1] += resources.velocities[offset + 1] * delta
      resources.positions[offset + 2] += resources.velocities[offset + 2] * delta
      const fade = resources.lifetimes[index] / resources.maximumLifetimes[index]
      resources.colors[offset] = resources.baseColor.r * fade
      resources.colors[offset + 1] = resources.baseColor.g * fade
      resources.colors[offset + 2] = resources.baseColor.b * fade
      liveCount += 1
    }

    liveCountRef.current = liveCount
    resources.geometry.attributes.position.needsUpdate = true
    resources.geometry.attributes.color.needsUpdate = true
    resources.geometry.attributes.particleSize.needsUpdate = true
    if (activeRef.current || liveCount > 0) invalidate()
  })

  useEffect(
    () => () => {
      resources.geometry.dispose()
      resources.material.dispose()
    },
    [resources],
  )

  return <points geometry={resources.geometry} material={resources.material} frustumCulled={false} />
})
