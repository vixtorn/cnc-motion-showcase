export function SceneLighting() {
  return (
    <>
      <hemisphereLight args={['#f5f3ec', '#777970', 1.65]} />
      <directionalLight position={[5, 8, 7]} intensity={2.2} color="#fffdf5" />
      <directionalLight position={[-6, 3, 4]} intensity={1.25} color="#ecece5" />
      <directionalLight position={[1, 5, -7]} intensity={1.1} color="#f5f4ef" />
    </>
  )
}
