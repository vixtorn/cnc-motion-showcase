import { Environment, Lightformer } from '@react-three/drei'
import { VISUAL_CALIBRATION } from '../animation/visualCalibrationConfig'

const { environment } = VISUAL_CALIBRATION

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
    </>
  )
}
