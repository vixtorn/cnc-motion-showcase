import { useMemo } from 'react'
import {
  BackSide,
  Box3,
  DoubleSide,
  FrontSide,
  Mesh,
  type BufferGeometry,
  type Material,
  type Object3D,
} from 'three'
import { CNC_NODE_NAMES } from '../animation/cncAnimationConfig'
import type {
  CncInspection,
  CncNodeChecks,
  CncNodes,
  MaterialDiagnostic,
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
  (Array.isArray(material) ? material : [material])

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

const buildInspection = (scene: Object3D): CncInspection => {
  const findNode = (name: string) => scene.getObjectByName(name) ?? null
  const nodes: CncNodes = {
    staticBody: findNode(CNC_NODE_NAMES.staticBody),
    mainChuck: findNode(CNC_NODE_NAMES.mainChuck),
    mainChuckBody: findNode(CNC_NODE_NAMES.mainChuckBody),
    workpiece: findNode(CNC_NODE_NAMES.workpiece),
    tailstock: findNode(CNC_NODE_NAMES.tailstock),
    tailstockQuill: findNode(CNC_NODE_NAMES.tailstockQuill),
    tailstockTip: findNode(CNC_NODE_NAMES.tailstockTip),
    turret: findNode(CNC_NODE_NAMES.turret),
    turretBody: findNode(CNC_NODE_NAMES.turretBody),
    turretToolBlocks: findNode(CNC_NODE_NAMES.turretToolBlocks),
    door: findNode(CNC_NODE_NAMES.door),
    doorGlass: findNode(CNC_NODE_NAMES.doorGlass),
  }

  const checks: CncNodeChecks = {
    mainChuck: nodes.mainChuck !== null,
    workpiece: nodes.workpiece !== null,
    tailstock: nodes.tailstock !== null,
    turret: nodes.turret !== null,
    door: nodes.door !== null,
    doorGlass: nodes.doorGlass !== null,
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
      material: materials.map((material) => material.name || '(unnamed)').join(', ') || '—',
      triangles: mesh ? triangleCount(mesh.geometry) : '—',
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

  for (const [key, node] of Object.entries(nodes)) {
    if (!node) warnings.push(`Expected CNC node missing: ${CNC_NODE_NAMES[key as keyof CncNodes]}`)
  }

  if (nodes.mainChuck && nodes.mainChuckBody && !isDescendantOf(nodes.mainChuckBody, nodes.mainChuck)) {
    warnings.push('MainChuck_Body is not a descendant of MainChuck_Assembly.')
  }

  if (nodes.mainChuck && nodes.workpiece && !isDescendantOf(nodes.workpiece, nodes.mainChuck)) {
    warnings.push('Workpiece_Raw is not a descendant of MainChuck_Assembly.')
  }

  if (lineObjects.length > 0) {
    warnings.push(`Visible line geometry exists in the GLB: ${lineObjects.join(', ')}`)
  }

  const glassDiagnostics = createMaterialDiagnostics(nodes.doorGlass)
  const printAudit = () => {
    console.groupCollapsed('[CNC] Complete GLB scene audit')
    console.table(auditRows)
    console.info('[CNC] FrontDoor_Window material diagnostics', glassDiagnostics)
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
    auditRows,
    glassDiagnostics,
    warnings,
    printAudit,
  }
}

export const useCncNodes = (scene: Object3D) =>
  useMemo(() => buildInspection(scene), [scene])
