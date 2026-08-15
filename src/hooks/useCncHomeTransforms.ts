import { useMemo } from 'react'
import type { Object3D } from 'three'
import type { CncHomeTransforms, CncNodes, HomeTransform } from '../types/cnc'

const captureHomeTransform = (object: Object3D | null): HomeTransform | null => {
  if (!object) return null

  const position = Object.freeze(object.position.clone())
  const rotation = Object.freeze(object.rotation.clone())
  const scale = Object.freeze(object.scale.clone())

  return Object.freeze({ position, rotation, scale })
}

export const useCncHomeTransforms = (nodes: CncNodes): CncHomeTransforms =>
  useMemo(
    () =>
      Object.freeze({
        mainChuck: captureHomeTransform(nodes.mainChuck),
        tailstock: captureHomeTransform(nodes.tailstock),
        turretCarriage: captureHomeTransform(nodes.turretCarriage),
        turretIndex: captureHomeTransform(nodes.turretIndex),
        door: captureHomeTransform(nodes.door),
      }),
    [nodes.door, nodes.mainChuck, nodes.tailstock, nodes.turretCarriage, nodes.turretIndex],
  )
