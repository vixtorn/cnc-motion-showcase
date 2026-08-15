import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DoubleSide,
  DynamicDrawUsage,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PlaneGeometry,
  Points,
  PointsMaterial,
  Vector3,
} from 'three'
import { CNC_MACHINING } from '../animation/cncMachiningConfig'

export interface CoolantEffectHandle {
  startCoolant: () => void
  setCoolantIntensity: (value: number) => void
  setRevealOcclusion: (value: number) => void
  triggerHotChips: () => void
  stopCoolant: () => void
  pauseCoolant: () => void
  resumeCoolant: () => void
  resetCoolant: () => void
  getCoolantSnapshot: () => Record<string, unknown>
}

const { coolant } = CNC_MACHINING
const EMITTER = new Vector3(...coolant.emitterPosition)
const SPRAY_DIRECTION = new Vector3(...coolant.sprayDirection).normalize()
const JET_GRAVITY = new Vector3(...coolant.jet.gravity)
const MIST_GRAVITY = new Vector3(...coolant.mist.gravity)
const CHIP_GRAVITY = new Vector3(...coolant.hotChips.gravity)
const Y_AXIS = new Vector3(0, 1, 0)

const pseudoRandom = (particle: number, channel: number, generation: number) => {
  const value = Math.sin(
    particle * 127.1 + channel * 311.7 + generation * 74.7,
  ) * 43758.5453
  return value - Math.floor(value)
}

const createSoftParticleTexture = () => {
  const canvas = document.createElement('canvas')
  canvas.width = 48
  canvas.height = 48
  const context = canvas.getContext('2d')
  if (context) {
    const gradient = context.createRadialGradient(24, 24, 2, 24, 24, 24)
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.94)')
    gradient.addColorStop(0.42, 'rgba(255, 255, 255, 0.64)')
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
    context.fillStyle = gradient
    context.fillRect(0, 0, 48, 48)
  }
  return new CanvasTexture(canvas)
}

const createVeilTexture = () => {
  const canvas = document.createElement('canvas')
  canvas.width = 160
  canvas.height = 96
  const context = canvas.getContext('2d')
  if (context) {
    context.fillStyle = 'rgba(255, 255, 255, 0.2)'
    context.fillRect(0, 0, canvas.width, canvas.height)
    const clouds = [
      [34, 56, 54, 0.76],
      [76, 38, 60, 0.56],
      [116, 58, 64, 0.68],
      [148, 34, 42, 0.42],
    ] as const
    for (const [x, y, radius, alpha] of clouds) {
      const gradient = context.createRadialGradient(x, y, 2, x, y, radius)
      gradient.addColorStop(0, `rgba(255, 255, 255, ${alpha})`)
      gradient.addColorStop(0.5, `rgba(255, 255, 255, ${alpha * 0.54})`)
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
      context.fillStyle = gradient
      context.fillRect(0, 0, canvas.width, canvas.height)
    }
  }
  return new CanvasTexture(canvas)
}

export const CoolantEffect = forwardRef<CoolantEffectHandle>(function CoolantEffect(_, ref) {
  const camera = useThree((state) => state.camera)
  const invalidate = useThree((state) => state.invalidate)
  const jetMeshRef = useRef<InstancedMesh>(null)
  const mistPointsRef = useRef<Points>(null)
  const chipPointsRef = useRef<Points>(null)
  const veilMeshRef = useRef<Mesh>(null)
  const activeRef = useRef(false)
  const pausedRef = useRef(false)
  const chipActiveRef = useRef(false)
  const intensityRef = useRef(0)
  const occlusionRef = useRef(0)

  const jetPositions = useMemo(() => new Float32Array(coolant.jet.particleCount * 3), [])
  const jetVelocities = useMemo(() => new Float32Array(coolant.jet.particleCount * 3), [])
  const jetLifetimes = useMemo(() => new Float32Array(coolant.jet.particleCount), [])
  const jetGenerations = useMemo(() => new Uint16Array(coolant.jet.particleCount), [])
  const mistPositions = useMemo(() => new Float32Array(coolant.mist.particleCount * 3), [])
  const mistVelocities = useMemo(() => new Float32Array(coolant.mist.particleCount * 3), [])
  const mistLifetimes = useMemo(() => new Float32Array(coolant.mist.particleCount), [])
  const mistGenerations = useMemo(() => new Uint16Array(coolant.mist.particleCount), [])
  const chipPositions = useMemo(() => new Float32Array(coolant.hotChips.particleCount * 3), [])
  const chipVelocities = useMemo(() => new Float32Array(coolant.hotChips.particleCount * 3), [])
  const chipLifetimes = useMemo(() => new Float32Array(coolant.hotChips.particleCount), [])
  const chipGenerations = useMemo(() => new Uint16Array(coolant.hotChips.particleCount), [])

  const mistGeometry = useMemo(() => {
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(mistPositions, 3))
    geometry.setDrawRange(0, 0)
    return geometry
  }, [mistPositions])
  const chipGeometry = useMemo(() => {
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(chipPositions, 3))
    geometry.setDrawRange(0, coolant.hotChips.particleCount)
    return geometry
  }, [chipPositions])
  const jetGeometry = useMemo(() => new CylinderGeometry(0.035, 0.055, 1.15, 5, 1, true), [])
  const veilGeometry = useMemo(() => new PlaneGeometry(4.2, 2.5), [])
  const softParticleTexture = useMemo(createSoftParticleTexture, [])
  const veilTexture = useMemo(createVeilTexture, [])
  const jetMaterial = useMemo(
    () =>
      new MeshBasicMaterial({
        color: new Color(coolant.jet.color),
        transparent: true,
        opacity: 0,
        depthWrite: false,
        toneMapped: true,
      }),
    [],
  )
  const mistMaterial = useMemo(
    () =>
      new PointsMaterial({
        color: new Color(coolant.mist.color),
        map: softParticleTexture,
        transparent: true,
        opacity: 0,
        alphaTest: 0.015,
        depthWrite: false,
        size: coolant.mist.minimumSize,
        sizeAttenuation: true,
        toneMapped: true,
      }),
    [softParticleTexture],
  )
  const chipMaterial = useMemo(
    () =>
      new PointsMaterial({
        color: new Color(coolant.hotChips.color),
        map: softParticleTexture,
        transparent: true,
        opacity: 0,
        alphaTest: 0.04,
        depthWrite: false,
        size: coolant.hotChips.size,
        sizeAttenuation: true,
        toneMapped: true,
      }),
    [softParticleTexture],
  )
  const veilMaterial = useMemo(
    () =>
      new MeshBasicMaterial({
        color: new Color(coolant.veil.color),
        map: veilTexture,
        transparent: true,
        opacity: 0,
        depthTest: false,
        depthWrite: false,
        side: DoubleSide,
        toneMapped: false,
      }),
    [veilTexture],
  )
  const jetTransform = useMemo(() => new Object3D(), [])
  const velocityDirection = useMemo(() => new Vector3(), [])
  const veilForward = useMemo(() => new Vector3(), [])

  const spawnStreamParticle = useCallback(
    (
      index: number,
      warmStart: boolean,
      positions: Float32Array,
      velocities: Float32Array,
      lifetimes: Float32Array,
      generations: Uint16Array,
      settings: typeof coolant.jet | typeof coolant.mist,
      directionWeight: number,
    ) => {
      const offset = index * 3
      const generation = generations[index]
      const directionX =
        SPRAY_DIRECTION.x * directionWeight +
        (pseudoRandom(index, 0, generation) - 0.5) * settings.spread
      const directionY =
        SPRAY_DIRECTION.y * directionWeight +
        (pseudoRandom(index, 1, generation) - 0.5) * settings.spread
      const directionZ =
        SPRAY_DIRECTION.z * directionWeight +
        (pseudoRandom(index, 2, generation) - 0.5) * settings.spread
      const inverseLength =
        1 / Math.max(Math.hypot(directionX, directionY, directionZ), 0.0001)
      const speed =
        settings.minimumSpeed +
        (settings.maximumSpeed - settings.minimumSpeed) *
          pseudoRandom(index, 3, generation)
      const lifetime =
        settings.minimumLifetime +
        (settings.maximumLifetime - settings.minimumLifetime) *
          pseudoRandom(index, 4, generation)
      const age = warmStart ? lifetime * pseudoRandom(index, 5, generation) : 0

      velocities[offset] = directionX * inverseLength * speed
      velocities[offset + 1] = directionY * inverseLength * speed
      velocities[offset + 2] = directionZ * inverseLength * speed
      lifetimes[index] = lifetime - age
      positions[offset] = EMITTER.x + velocities[offset] * age
      positions[offset + 1] = EMITTER.y + velocities[offset + 1] * age
      positions[offset + 2] = EMITTER.z + velocities[offset + 2] * age
      generations[index] += 1
    },
    [],
  )

  const initializeStreams = useCallback(() => {
    jetGenerations.fill(0)
    mistGenerations.fill(0)
    for (let index = 0; index < coolant.jet.particleCount; index += 1) {
      spawnStreamParticle(
        index,
        true,
        jetPositions,
        jetVelocities,
        jetLifetimes,
        jetGenerations,
        coolant.jet,
        1,
      )
    }
    for (let index = 0; index < coolant.mist.particleCount; index += 1) {
      spawnStreamParticle(
        index,
        true,
        mistPositions,
        mistVelocities,
        mistLifetimes,
        mistGenerations,
        coolant.mist,
        0.35,
      )
    }
    mistGeometry.getAttribute('position').needsUpdate = true
  }, [
    jetGenerations,
    jetLifetimes,
    jetPositions,
    jetVelocities,
    mistGenerations,
    mistGeometry,
    mistLifetimes,
    mistPositions,
    mistVelocities,
    spawnStreamParticle,
  ])

  const applyVisualLevels = useCallback(() => {
    const intensity = intensityRef.current
    const occlusion = occlusionRef.current
    jetMaterial.opacity =
      intensity *
      (coolant.jet.minimumOpacity +
        (coolant.jet.maximumOpacity - coolant.jet.minimumOpacity) * intensity)
    const mistLevel = Math.max(intensity, occlusion)
    mistMaterial.opacity = Math.min(
      coolant.mist.maximumOpacity + coolant.mist.occlusionOpacityBoost,
      mistLevel *
        (coolant.mist.minimumOpacity +
          (coolant.mist.maximumOpacity - coolant.mist.minimumOpacity) * intensity +
          coolant.mist.occlusionOpacityBoost * occlusion),
    )
    mistMaterial.size =
      coolant.mist.minimumSize +
      (coolant.mist.maximumSize - coolant.mist.minimumSize) *
        Math.max(intensity, occlusion)
    veilMaterial.opacity = coolant.veil.maximumOpacity * occlusion
    if (veilMeshRef.current) veilMeshRef.current.visible = occlusion > 0.001
    invalidate()
  }, [invalidate, jetMaterial, mistMaterial, veilMaterial])

  const setCoolantIntensity = useCallback(
    (value: number) => {
      intensityRef.current = Math.min(Math.max(value, 0), 1)
      applyVisualLevels()
    },
    [applyVisualLevels],
  )

  const setRevealOcclusion = useCallback(
    (value: number) => {
      occlusionRef.current = Math.min(Math.max(value, 0), 1)
      applyVisualLevels()
    },
    [applyVisualLevels],
  )

  const startCoolant = useCallback(() => {
    initializeStreams()
    activeRef.current = true
    pausedRef.current = false
    if (jetMeshRef.current) jetMeshRef.current.visible = true
    if (mistPointsRef.current) mistPointsRef.current.visible = true
    invalidate()
  }, [initializeStreams, invalidate])

  const spawnHotChip = useCallback(
    (index: number) => {
      const offset = index * 3
      const generation = chipGenerations[index]
      const directionX = pseudoRandom(index, 0, generation) * 1.5 - 0.65
      const directionY = pseudoRandom(index, 1, generation) * 0.85 + 0.12
      const directionZ = pseudoRandom(index, 2, generation) * 1.5 - 0.75
      const inverseLength =
        1 / Math.max(Math.hypot(directionX, directionY, directionZ), 0.0001)
      const speed =
        coolant.hotChips.minimumSpeed +
        (coolant.hotChips.maximumSpeed - coolant.hotChips.minimumSpeed) *
          pseudoRandom(index, 3, generation)
      chipPositions[offset] = EMITTER.x
      chipPositions[offset + 1] = EMITTER.y
      chipPositions[offset + 2] = EMITTER.z
      chipVelocities[offset] = directionX * inverseLength * speed
      chipVelocities[offset + 1] = directionY * inverseLength * speed
      chipVelocities[offset + 2] = directionZ * inverseLength * speed
      chipLifetimes[index] =
        coolant.hotChips.minimumLifetime +
        (coolant.hotChips.maximumLifetime - coolant.hotChips.minimumLifetime) *
          pseudoRandom(index, 4, generation)
      chipGenerations[index] += 1
    },
    [chipGenerations, chipLifetimes, chipPositions, chipVelocities],
  )

  const triggerHotChips = useCallback(() => {
    for (let index = 0; index < coolant.hotChips.particleCount; index += 1) {
      spawnHotChip(index)
    }
    chipGeometry.getAttribute('position').needsUpdate = true
    chipMaterial.opacity = coolant.hotChips.opacity
    chipActiveRef.current = true
    if (chipPointsRef.current) chipPointsRef.current.visible = true
    invalidate()
  }, [chipGeometry, chipMaterial, invalidate, spawnHotChip])

  const stopCoolant = useCallback(() => {
    activeRef.current = false
    pausedRef.current = false
    chipActiveRef.current = false
    intensityRef.current = 0
    occlusionRef.current = 0
    jetMaterial.opacity = 0
    mistMaterial.opacity = 0
    chipMaterial.opacity = 0
    veilMaterial.opacity = 0
    mistGeometry.setDrawRange(0, 0)
    if (jetMeshRef.current) jetMeshRef.current.visible = false
    if (mistPointsRef.current) mistPointsRef.current.visible = false
    if (chipPointsRef.current) chipPointsRef.current.visible = false
    if (veilMeshRef.current) veilMeshRef.current.visible = false
    invalidate()
  }, [chipMaterial, invalidate, jetMaterial, mistGeometry, mistMaterial, veilMaterial])

  const pauseCoolant = useCallback(() => {
    pausedRef.current = true
  }, [])
  const resumeCoolant = useCallback(() => {
    if (!activeRef.current && !chipActiveRef.current) return
    pausedRef.current = false
    invalidate()
  }, [invalidate])
  const resetCoolant = useCallback(() => {
    stopCoolant()
    initializeStreams()
    chipGenerations.fill(0)
  }, [chipGenerations, initializeStreams, stopCoolant])

  const getCoolantSnapshot = useCallback(
    () => ({
      active: activeRef.current,
      paused: pausedRef.current,
      intensity: Number(intensityRef.current.toFixed(4)),
      revealOcclusion: Number(occlusionRef.current.toFixed(4)),
      hotChipsActive: chipActiveRef.current,
      jetVisible: jetMeshRef.current?.visible ?? false,
      mistVisible: mistPointsRef.current?.visible ?? false,
      veilVisible: veilMeshRef.current?.visible ?? false,
      particleCounts: {
        jet: coolant.jet.particleCount,
        mist: coolant.mist.particleCount,
        hotChips: coolant.hotChips.particleCount,
      },
    }),
    [],
  )

  useImperativeHandle(
    ref,
    () => ({
      startCoolant,
      setCoolantIntensity,
      setRevealOcclusion,
      triggerHotChips,
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
      setRevealOcclusion,
      startCoolant,
      stopCoolant,
      triggerHotChips,
    ],
  )

  useFrame((_, frameDelta) => {
    if (pausedRef.current) return
    const streamActive =
      activeRef.current && (intensityRef.current > 0 || occlusionRef.current > 0)
    if (!streamActive && !chipActiveRef.current) return

    const delta = Math.min(frameDelta, 0.05)
    if (streamActive) {
      const jetCount = Math.max(
        1,
        Math.floor(coolant.jet.particleCount * intensityRef.current),
      )
      const mistLevel = Math.max(intensityRef.current, occlusionRef.current)
      const mistCount = Math.max(
        1,
        Math.floor(coolant.mist.particleCount * mistLevel),
      )
      const jetMesh = jetMeshRef.current
      for (let index = 0; index < coolant.jet.particleCount; index += 1) {
        if (!jetMesh || index >= jetCount) {
          if (jetMesh) {
            jetTransform.scale.setScalar(0)
            jetTransform.updateMatrix()
            jetMesh.setMatrixAt(index, jetTransform.matrix)
          }
          continue
        }
        const offset = index * 3
        jetLifetimes[index] -= delta
        if (jetLifetimes[index] <= 0) {
          spawnStreamParticle(
            index,
            false,
            jetPositions,
            jetVelocities,
            jetLifetimes,
            jetGenerations,
            coolant.jet,
            1,
          )
        }
        jetVelocities[offset] += JET_GRAVITY.x * delta
        jetVelocities[offset + 1] += JET_GRAVITY.y * delta
        jetVelocities[offset + 2] += JET_GRAVITY.z * delta
        jetPositions[offset] += jetVelocities[offset] * delta
        jetPositions[offset + 1] += jetVelocities[offset + 1] * delta
        jetPositions[offset + 2] += jetVelocities[offset + 2] * delta
        velocityDirection
          .set(jetVelocities[offset], jetVelocities[offset + 1], jetVelocities[offset + 2])
          .normalize()
        jetTransform.position.set(
          jetPositions[offset],
          jetPositions[offset + 1],
          jetPositions[offset + 2],
        )
        jetTransform.quaternion.setFromUnitVectors(Y_AXIS, velocityDirection)
        jetTransform.scale.set(1, 0.72 + intensityRef.current * 0.64, 1)
        jetTransform.updateMatrix()
        jetMesh.setMatrixAt(index, jetTransform.matrix)
      }
      if (jetMesh) jetMesh.instanceMatrix.needsUpdate = true

      for (let index = 0; index < mistCount; index += 1) {
        const offset = index * 3
        mistLifetimes[index] -= delta
        if (mistLifetimes[index] <= 0) {
          spawnStreamParticle(
            index,
            false,
            mistPositions,
            mistVelocities,
            mistLifetimes,
            mistGenerations,
            coolant.mist,
            0.35,
          )
        }
        mistVelocities[offset] += MIST_GRAVITY.x * delta
        mistVelocities[offset + 1] += MIST_GRAVITY.y * delta
        mistVelocities[offset + 2] += MIST_GRAVITY.z * delta
        mistPositions[offset] += mistVelocities[offset] * delta
        mistPositions[offset + 1] += mistVelocities[offset + 1] * delta
        mistPositions[offset + 2] += mistVelocities[offset + 2] * delta
      }
      mistGeometry.setDrawRange(0, mistCount)
      mistGeometry.getAttribute('position').needsUpdate = true

      const veil = veilMeshRef.current
      if (veil && occlusionRef.current > 0) {
        veilForward.set(0, 0, -1).applyQuaternion(camera.quaternion)
        veil.position.copy(camera.position).addScaledVector(veilForward, 1.7)
        veil.quaternion.copy(camera.quaternion)
      }
    }

    if (chipActiveRef.current) {
      let livingChips = 0
      for (let index = 0; index < coolant.hotChips.particleCount; index += 1) {
        if (chipLifetimes[index] <= 0) continue
        livingChips += 1
        const offset = index * 3
        chipLifetimes[index] -= delta
        chipVelocities[offset] += CHIP_GRAVITY.x * delta
        chipVelocities[offset + 1] += CHIP_GRAVITY.y * delta
        chipVelocities[offset + 2] += CHIP_GRAVITY.z * delta
        chipPositions[offset] += chipVelocities[offset] * delta
        chipPositions[offset + 1] += chipVelocities[offset + 1] * delta
        chipPositions[offset + 2] += chipVelocities[offset + 2] * delta
      }
      chipGeometry.getAttribute('position').needsUpdate = true
      if (livingChips === 0) {
        chipActiveRef.current = false
        chipMaterial.opacity = 0
        if (chipPointsRef.current) chipPointsRef.current.visible = false
      }
    }
    invalidate()
  })

  useEffect(() => {
    initializeStreams()
    if (jetMeshRef.current) {
      jetMeshRef.current.visible = false
      jetMeshRef.current.instanceMatrix.setUsage(DynamicDrawUsage)
    }
    if (mistPointsRef.current) mistPointsRef.current.visible = false
    if (chipPointsRef.current) chipPointsRef.current.visible = false
    if (veilMeshRef.current) veilMeshRef.current.visible = false
    return () => {
      mistGeometry.dispose()
      chipGeometry.dispose()
      jetGeometry.dispose()
      veilGeometry.dispose()
      jetMaterial.dispose()
      mistMaterial.dispose()
      chipMaterial.dispose()
      veilMaterial.dispose()
      softParticleTexture.dispose()
      veilTexture.dispose()
    }
  }, [
    chipGeometry,
    chipMaterial,
    initializeStreams,
    jetGeometry,
    jetMaterial,
    mistGeometry,
    mistMaterial,
    softParticleTexture,
    veilGeometry,
    veilMaterial,
    veilTexture,
  ])

  return (
    <>
      <instancedMesh
        ref={jetMeshRef}
        args={[jetGeometry, jetMaterial, coolant.jet.particleCount]}
        frustumCulled={false}
        renderOrder={4}
      />
      <points
        ref={mistPointsRef}
        geometry={mistGeometry}
        material={mistMaterial}
        frustumCulled={false}
        renderOrder={5}
      />
      <points
        ref={chipPointsRef}
        geometry={chipGeometry}
        material={chipMaterial}
        frustumCulled={false}
        renderOrder={6}
      />
      <mesh
        ref={veilMeshRef}
        geometry={veilGeometry}
        material={veilMaterial}
        frustumCulled={false}
        renderOrder={10}
      />
    </>
  )
})
