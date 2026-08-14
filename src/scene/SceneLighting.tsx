import { useEffect } from 'react'
import { Environment, Lightformer } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { VISUAL_CALIBRATION } from '../animation/visualCalibrationConfig'

const { environment } = VISUAL_CALIBRATION
const diagnosedScenes = new WeakSet<object>()

function LightingDiagnostics() {
  const gl = useThree((state) => state.gl)
  const scene = useThree((state) => state.scene)

  useEffect(() => {
    if (!import.meta.env.DEV || diagnosedScenes.has(scene)) return

    const frame = window.requestAnimationFrame(() => {
      diagnosedScenes.add(scene)
      console.info(
        `[CNC] Renderer and environment diagnostics ${JSON.stringify({
          toneMapping: gl.toneMapping,
          toneMappingExposure: gl.toneMappingExposure,
          outputColorSpace: gl.outputColorSpace,
          sceneEnvironmentPresent: scene.environment !== null,
          sceneEnvironmentIntensity: scene.environmentIntensity,
          environmentResolution: environment.resolution,
          environmentIntensity: environment.intensity,
          hemisphereIntensity: environment.hemisphereIntensity,
          keyLightIntensity: environment.keyLightIntensity,
          fillLightIntensity: environment.fillLightIntensity,
          rimLightIntensity: environment.rimLightIntensity,
          softboxes: environment.softboxes,
        })}`,
      )
    })

    return () => window.cancelAnimationFrame(frame)
  }, [gl, scene])

  return null
}

export function SceneLighting() {
  const [keyLight, fillLight, rimLight] = environment.directionalLights

  return (
    <>
      <hemisphereLight args={['#f5f3ec', '#777970', environment.hemisphereIntensity]} />
      <directionalLight
        position={keyLight.position}
        intensity={environment.keyLightIntensity}
        color={keyLight.color}
      />
      <directionalLight
        position={fillLight.position}
        intensity={environment.fillLightIntensity}
        color={fillLight.color}
      />
      <directionalLight
        position={rimLight.position}
        intensity={environment.rimLightIntensity}
        color={rimLight.color}
      />

      <Environment
        frames={1}
        resolution={environment.resolution}
        environmentIntensity={environment.intensity}
      >
        {environment.softboxes.map((softbox) => (
          <Lightformer
            key={softbox.name}
            form="rect"
            color={softbox.color}
            intensity={softbox.intensity}
            position={softbox.position}
            scale={softbox.scale}
            target={[0, 0, 0]}
          />
        ))}
      </Environment>
      <LightingDiagnostics />
    </>
  )
}
