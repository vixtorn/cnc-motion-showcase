import { Outlines } from '@react-three/drei'
import { Mesh } from 'three'

interface InteractiveMeshOutlineProps {
  mesh: Mesh
  color: string
  thickness: number
}

export function InteractiveMeshOutline({
  mesh,
  color,
  thickness,
}: InteractiveMeshOutlineProps) {
  mesh.updateWorldMatrix(true, false)

  return (
    <mesh
      geometry={mesh.geometry}
      matrix={mesh.matrixWorld}
      matrixAutoUpdate={false}
      frustumCulled={false}
    >
      <meshBasicMaterial colorWrite={false} depthWrite={false} />
      <Outlines
        angle={0}
        color={color}
        thickness={thickness}
        renderOrder={2}
        toneMapped={false}
      />
    </mesh>
  )
}
