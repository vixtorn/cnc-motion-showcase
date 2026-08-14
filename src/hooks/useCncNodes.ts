import { useMemo } from 'react'
import {
  BackSide,
  Box3,
  DoubleSide,
  FrontSide,
  Mesh,
  MeshStandardMaterial,
  SRGBColorSpace,
  Vector3,
  type BufferGeometry,
  type Material,
  type Object3D,
} from 'three'
import { CNC_NODE_NAMES } from '../animation/cncAnimationConfig'
import type {
  CncInspection,
  CncNodeChecks,
  CncNodes,
  DumanBadgeDiagnostic,
  MaterialDiagnostic,
  PbrMaterialDiagnostic,
  SceneAuditRow,
} from '../types/cnc'

const OPAQUE_BODY_NAMES = new Set([
  'CNC_StaticBody',
  'ControlConsole_Base',
  'ControlConsole_Panel',
  'FrontDoor_Body',
  'FrontDoor_FixedFrame',
  'MainChuck_Body',
  'Tailstock_Body',
  'Turret_Body',
])

const formatVector = (values: readonly number[]) =>
  `(${values.map((value) => value.toFixed(4)).join(', ')})`

const triangleCount = (geometry: BufferGeometry) => {
  const count = geometry.index?.count ?? geometry.getAttribute('position')?.count ?? 0
  return Math.floor(count / 3)
}

const materialList = (material: Material | Material[]) =>
  Array.isArray(material) ? material : [material]

const sideName = (side: number) => {
  if (side === DoubleSide) return 'DoubleSide'
  if (side === BackSide) return 'BackSide'
  if (side === FrontSide) return 'FrontSide'
  return String(side)
}

const isInOpaqueAssembly = (object: Object3D) => {
  let current: Object3D | null = object
  while (current) {
    if (OPAQUE_BODY_NAMES.has(current.name)) return true
    current = current.parent
  }
  return false
}

const isDescendantOf = (child: Object3D, expectedParent: Object3D) => {
  let current = child.parent
  while (current) {
    if (current === expectedParent) return true
    current = current.parent
  }
  return false
}

const createMaterialDiagnostics = (object: Object3D | null): MaterialDiagnostic[] => {
  if (!(object instanceof Mesh)) return []

  return materialList(object.material).map((material) => ({
    objectName: object.name || '(unnamed mesh)',
    materialName: material.name || '(unnamed material)',
    transparent: material.transparent,
    opacity: material.opacity,
    transmission:
      'transmission' in material && typeof material.transmission === 'number'
        ? material.transmission
        : 'n/a',
    depthWrite: material.depthWrite,
    side: sideName(material.side),
  }))
}

const createPbrMaterialDiagnostics = (object: Object3D | null): PbrMaterialDiagnostic[] => {
  if (!(object instanceof Mesh)) return []

  return materialList(object.material)
    .filter((material): material is MeshStandardMaterial => material instanceof MeshStandardMaterial)
    .map((material) => ({
      objectName: object.name || '(unnamed mesh)',
      materialName: material.name || '(unnamed material)',
      materialType: material.type,
      baseColor: `#${material.color.getHexString(SRGBColorSpace)}`,
      metalness: material.metalness,
      roughness: material.roughness,
      envMapPresent: material.envMap !== null,
      envMapIntensity: material.envMapIntensity,
      mapPresent: material.map !== null,
      normalMapPresent: material.normalMap !== null,
      roughnessMapPresent: material.roughnessMap !== null,
      metalnessMapPresent: material.metalnessMap !== null,
      vertexColors: material.vertexColors,
      toneMapped: material.toneMapped,
      transparent: material.transparent,
      opacity: material.opacity,
      side: sideName(material.side),
    }))
}

const findDumanBadge = (scene: Object3D) => {
  const exactMatch = scene.getObjectByName(CNC_NODE_NAMES.dumanBadge)
  if (exactMatch) return exactMatch

  let fallback: Object3D | null = null
  scene.traverse((object) => {
    if (!fallback && object.name.toLowerCase().includes('duman')) fallback = object
  })
  return fallback
}

const createBadgeDiagnostic = (
  badge: Object3D | null,
): { bounds: Box3 | null; diagnostic: DumanBadgeDiagnostic | null } => {
  if (!badge) return { bounds: null, diagnostic: null }

  badge.updateWorldMatrix(true, true)
  const bounds = new Box3().setFromObject(badge)
  const min = bounds.min.clone()
  const max = bounds.max.clone()
  const size = bounds.getSize(new Vector3())
  const worldPosition = badge.getWorldPosition(new Vector3())
  const materials: string[] = []

  badge.traverse((object) => {
    if (!(object instanceof Mesh)) return
    for (const material of materialList(object.material)) {
      materials.push(material.name || '(unnamed material)')
    }
  })

  return {
    bounds,
    diagnostic: {
      actualName: badge.name || '(unnamed)',
      parent: badge.parent?.name || badge.parent?.type || '(scene root)',
      material: [...new Set(materials)].join(', ') || '(none)',
      boundsMin: formatVector(min.toArray()),
      boundsMax: formatVector(max.toArray()),
      boundsSize: formatVector(size.toArray()),
      worldPosition: formatVector(worldPosition.toArray()),
    },
  }
}

const createTransformDiagnostic = (object: Object3D | null) => {
  if (!object) return null

  object.updateWorldMatrix(true, true)
  const worldPosition = object.getWorldPosition(new Vector3())
  const matrixWorldPosition = new Vector3().setFromMatrixPosition(object.matrixWorld)
  const bounds = new Box3().setFromObject(object)
  const boundsCenter = bounds.getCenter(new Vector3())

  return {
    name: object.name,
    uuid: object.uuid,
    parent: object.parent?.name || object.parent?.type || '(scene root)',
    localPosition: object.position.toArray().map((value) => Number(value.toFixed(6))),
    localEuler: [object.rotation.x, object.rotation.y, object.rotation.z, object.rotation.order],
    localQuaternion: object.quaternion.toArray().map((value) => Number(value.toFixed(6))),
    worldPosition: worldPosition.toArray().map((value) => Number(value.toFixed(6))),
    matrixWorldPosition: matrixWorldPosition.toArray().map((value) => Number(value.toFixed(6))),
    boundsCenter: boundsCenter.toArray().map((value) => Number(value.toFixed(6))),
    boundsSize: bounds.getSize(new Vector3()).toArray().map((value) => Number(value.toFixed(6))),
    pivotToBoundsCenter: boundsCenter
      .sub(worldPosition)
      .toArray()
      .map((value) => Number(value.toFixed(6))),
  }
}

const buildInspection = (scene: Object3D): CncInspection => {
  const findNode = (name: string) => scene.getObjectByName(name) ?? null
  const nodes: CncNodes = {
    staticBody: findNode(CNC_NODE_NAMES.staticBody),
    mainChuck: findNode(CNC_NODE_NAMES.mainChuck),
    mainChuckBody: findNode(CNC_NODE_NAMES.mainChuckBody),
    workpiece: findNode(CNC_NODE_NAMES.workpiece),
    finishedWorkpiece: findNode(CNC_NODE_NAMES.finishedWorkpiece),
    tailstock: findNode(CNC_NODE_NAMES.tailstock),
    tailstockQuill: findNode(CNC_NODE_NAMES.tailstockQuill),
    tailstockTip: findNode(CNC_NODE_NAMES.tailstockTip),
    turretCarriage: findNode(CNC_NODE_NAMES.turretCarriage),
    turretIndex: findNode(CNC_NODE_NAMES.turretIndex),
    turretLegacyAssembly: findNode(CNC_NODE_NAMES.turretLegacyAssembly),
    turretBody: findNode(CNC_NODE_NAMES.turretBody),
    turretToolBlocks: findNode(CNC_NODE_NAMES.turretToolBlocks),
    turretCenterHub: findNode(CNC_NODE_NAMES.turretCenterHub),
    door: findNode(CNC_NODE_NAMES.door),
    doorBody: findNode(CNC_NODE_NAMES.doorBody),
    doorGlass: findNode(CNC_NODE_NAMES.doorGlass),
    doorLowerStrip: findNode(CNC_NODE_NAMES.doorLowerStrip),
    doorFixedFrame: findNode(CNC_NODE_NAMES.doorFixedFrame),
    dumanBadge: findDumanBadge(scene),
  }

  const checks: CncNodeChecks = {
    mainChuck: nodes.mainChuck !== null,
    workpiece: nodes.workpiece !== null,
    tailstock: nodes.tailstock !== null,
    turretCarriage: nodes.turretCarriage !== null,
    turretIndex: nodes.turretIndex !== null,
    turretCenterHub: nodes.turretCenterHub !== null,
    door: nodes.door !== null,
    doorGlass: nodes.doorGlass !== null,
    doorLowerStrip: nodes.doorLowerStrip !== null,
  }

  const auditRows: SceneAuditRow[] = []
  const warnings: string[] = []
  const lineObjects: string[] = []

  scene.traverse((object) => {
    const mesh = object instanceof Mesh ? object : null
    const materials = mesh ? materialList(mesh.material) : []

    auditRows.push({
      name: object.name || '(unnamed)',
      type: object.type,
      parent: object.parent?.name || object.parent?.type || '(scene root)',
      position: formatVector(object.position.toArray()),
      rotation: formatVector([object.rotation.x, object.rotation.y, object.rotation.z]),
      scale: formatVector(object.scale.toArray()),
      visible: object.visible,
      material: materials.map((material) => material.name || '(unnamed)').join(', ') || '-',
      triangles: mesh ? triangleCount(mesh.geometry) : '-',
    })

    if (object.type === 'Line' || object.type === 'LineLoop' || object.type === 'LineSegments') {
      lineObjects.push(object.name || '(unnamed line object)')
    }

    if (mesh && isInOpaqueAssembly(mesh) && mesh.name !== CNC_NODE_NAMES.doorGlass) {
      for (const material of materials) {
        if (material.transparent || material.opacity < 0.99) {
          warnings.push(
            `${mesh.name || '(unnamed mesh)'} uses unexpectedly transparent material ${material.name || '(unnamed material)'} (transparent=${material.transparent}, opacity=${material.opacity}).`,
          )
        }
      }
    }
  })

  for (const [key, found] of Object.entries(checks)) {
    if (!found) {
      warnings.push(`Expected CNC node missing: ${CNC_NODE_NAMES[key as keyof CncNodeChecks]}`)
    }
  }

  if (nodes.mainChuck && nodes.mainChuckBody && !isDescendantOf(nodes.mainChuckBody, nodes.mainChuck)) {
    warnings.push('MainChuck_Body is not a descendant of MainChuck_Assembly.')
  }

  if (nodes.mainChuck && nodes.workpiece && !isDescendantOf(nodes.workpiece, nodes.mainChuck)) {
    warnings.push('Workpiece_Raw is not a descendant of MainChuck_Assembly.')
  }

  if (nodes.turretCarriage && nodes.turretIndex && !isDescendantOf(nodes.turretIndex, nodes.turretCarriage)) {
    warnings.push('Turret_IndexAssembly is not a descendant of Turret_CarriageAssembly.')
  }

  if (
    nodes.turretIndex &&
    nodes.turretLegacyAssembly &&
    !isDescendantOf(nodes.turretLegacyAssembly, nodes.turretIndex)
  ) {
    warnings.push('Turret_Assembly is not a descendant of Turret_IndexAssembly.')
  }

  if (
    nodes.turretCenterHub &&
    nodes.turretCarriage &&
    !isDescendantOf(nodes.turretCenterHub, nodes.turretCarriage)
  ) {
    warnings.push('Turret_CenterHub is not a descendant of Turret_CarriageAssembly.')
  }

  if (nodes.turretCenterHub && nodes.turretIndex && isDescendantOf(nodes.turretCenterHub, nodes.turretIndex)) {
    warnings.push('Turret_CenterHub is incorrectly inside Turret_IndexAssembly and would rotate during indexing.')
  }

  if (nodes.door && nodes.doorBody && !isDescendantOf(nodes.doorBody, nodes.door)) {
    warnings.push(
      `FrontDoor_Body hierarchy mismatch: exported under ${nodes.doorBody.parent?.name || '(scene root)'} instead of FrontDoor_Assembly.`,
    )
  }

  if (nodes.door && nodes.doorLowerStrip && !isDescendantOf(nodes.doorLowerStrip, nodes.door)) {
    warnings.push('FrontDoor_LowerStrip is not a descendant of FrontDoor_Assembly.')
  }

  if (nodes.door && nodes.doorFixedFrame && isDescendantOf(nodes.doorFixedFrame, nodes.door)) {
    warnings.push('FrontDoor_FixedFrame is incorrectly inside FrontDoor_Assembly and would move with the door.')
  }

  if (lineObjects.length > 0) {
    warnings.push(`Visible line geometry exists in the GLB: ${lineObjects.join(', ')}`)
  }

  const glassDiagnostics = createMaterialDiagnostics(nodes.doorGlass)
  const workpieceDiagnostics = createPbrMaterialDiagnostics(nodes.workpiece)
  const tailstockQuillDiagnostics = createPbrMaterialDiagnostics(nodes.tailstockQuill)
  const representativeMetalDiagnostics = [
    nodes.workpiece,
    nodes.tailstockQuill,
    nodes.dumanBadge,
    nodes.mainChuckBody,
    nodes.turretBody,
    nodes.turretToolBlocks,
  ].flatMap(createPbrMaterialDiagnostics)
  const { bounds: dumanBadgeBounds, diagnostic: dumanBadgeDiagnostic } =
    createBadgeDiagnostic(nodes.dumanBadge)
  const turretTransformDiagnostics = [
    nodes.turretCarriage,
    nodes.turretIndex,
    nodes.turretLegacyAssembly,
    nodes.turretBody,
    nodes.turretToolBlocks,
    nodes.turretCenterHub,
  ].map(createTransformDiagnostic)
  const printAudit = () => {
    console.groupCollapsed('[CNC] Complete GLB scene audit')
    console.table(auditRows)
    console.info(`[CNC] FrontDoor_Window material diagnostics ${JSON.stringify(glassDiagnostics)}`)
    console.info('[CNC] Workpiece_Raw material diagnostics', workpieceDiagnostics)
    console.info('[CNC] Tailstock_Quill material diagnostics', tailstockQuillDiagnostics)
    console.info(
      `[CNC] Representative metal diagnostics ${JSON.stringify(representativeMetalDiagnostics)}`,
    )
    console.info(`[CNC] Turret transform diagnostics ${JSON.stringify(turretTransformDiagnostics)}`)
    console.info(
      `[CNC] DUMAN badge diagnostics ${JSON.stringify(dumanBadgeDiagnostic ?? 'Badge not found')}`,
    )
    if (warnings.length > 0) {
      warnings.forEach((warning) => console.warn(`[CNC] ${warning}`))
    } else {
      console.info('[CNC] No hierarchy, line-geometry, or opaque-material warnings detected.')
    }
    console.groupEnd()
  }

  return {
    nodes,
    checks,
    bounds: new Box3().setFromObject(scene),
    dumanBadgeBounds,
    dumanBadgeDiagnostic,
    auditRows,
    glassDiagnostics,
    workpieceDiagnostics,
    tailstockQuillDiagnostics,
    representativeMetalDiagnostics,
    warnings,
    printAudit,
  }
}

export const useCncNodes = (scene: Object3D) =>
  useMemo(() => buildInspection(scene), [scene])
