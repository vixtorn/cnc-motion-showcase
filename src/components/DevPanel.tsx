import { CNC_AXIS_OPTIONS, type CncAxis } from '../animation/cncAnimationConfig'
import type { CalibrationDirection, CncInspection, NodeCheckKey } from '../types/cnc'

interface DevPanelProps {
  inspection: CncInspection | null
  isChuckTesting: boolean
  onPrintAudit: () => void
  onResetCamera: () => void
  onTestDumanCamera: () => void
  onToggleChuck: () => void
  onSetTailstockContact: (contact: boolean) => void
  onResetTailstock: () => void
  onTestTurretCarriage: (axis: CncAxis, direction: CalibrationDirection) => void
  onResetTurretCarriage: () => void
  onTestTurretIndex: (direction: CalibrationDirection) => void
  onResetTurretIndex: () => void
  onSetDoorOpen: (open: boolean) => void
  onResetDoor: () => void
}

const NODE_LABELS: Array<[NodeCheckKey, string]> = [
  ['mainChuck', 'MAIN CHUCK'],
  ['workpiece', 'WORKPIECE'],
  ['tailstock', 'TAILSTOCK'],
  ['turretCarriage', 'TURRET CARRIAGE'],
  ['turretIndex', 'TURRET INDEX'],
  ['turretCenterHub', 'TURRET CENTER HUB'],
  ['door', 'DOOR'],
  ['doorGlass', 'DOOR GLASS'],
  ['doorLowerStrip', 'DOOR LOWER STRIP'],
]

export function DevPanel({
  inspection,
  isChuckTesting,
  onPrintAudit,
  onResetCamera,
  onTestDumanCamera,
  onToggleChuck,
  onSetTailstockContact,
  onResetTailstock,
  onTestTurretCarriage,
  onResetTurretCarriage,
  onTestTurretIndex,
  onResetTurretIndex,
  onSetDoorOpen,
  onResetDoor,
}: DevPanelProps) {
  const checks = inspection?.checks

  return (
    <aside className="dev-panel" aria-label="CNC development controls">
      <div className="dev-panel__header">
        <span>SCENE DIAGNOSTICS</span>
        <span className="dev-panel__mode">DEV ONLY</span>
      </div>

      <ul className="node-list">
        {NODE_LABELS.map(([key, label]) => {
          const state = checks ? (checks[key] ? 'found' : 'missing') : 'pending'
          return (
            <li key={key}>
              <span>{label}</span>
              <span className={`node-state is-${state}`}>{state.toUpperCase()}</span>
            </li>
          )
        })}
      </ul>

      <div className="dev-panel__utility">
        <button type="button" disabled={!inspection} onClick={onPrintAudit}>
          [ PRINT SCENE AUDIT ]
        </button>
      </div>

      <div className="calibration-panel">
        <section className="calibration-group">
          <h2>VISUAL</h2>
          <div className="calibration-actions">
            <button type="button" disabled={!inspection} onClick={onResetCamera}>
              [ RESET VIEW ]
            </button>
            <button
              type="button"
              disabled={!inspection?.dumanBadgeBounds}
              onClick={onTestDumanCamera}
            >
              [ TEST DUMAN CAMERA ]
            </button>
          </div>
        </section>

        <section className="calibration-group calibration-group--chuck">
          <h2>CHUCK - LOCAL Z</h2>
          <button
            type="button"
            className={isChuckTesting ? 'is-active' : ''}
            disabled={!checks?.mainChuck}
            aria-pressed={isChuckTesting}
            onClick={onToggleChuck}
          >
            {isChuckTesting ? '[ STOP + RESET Z ]' : '[ Z ROTATION TEST ]'}
          </button>
        </section>

        <section className="calibration-group">
          <h2>TAILSTOCK</h2>
          <div className="calibration-actions">
            <button type="button" disabled={!checks?.tailstock} onClick={() => onSetTailstockContact(false)}>
              [ HOME ]
            </button>
            <button type="button" disabled={!checks?.tailstock} onClick={() => onSetTailstockContact(true)}>
              [ CONTACT ]
            </button>
            <button type="button" disabled={!checks?.tailstock} onClick={onResetTailstock}>
              [ RESET ]
            </button>
          </div>
        </section>

        <section className="calibration-group">
          <h2>TURRET CARRIAGE</h2>
          <div className="translation-controls">
            {CNC_AXIS_OPTIONS.map((axis) => (
              <div className="translation-axis" key={axis}>
                <span>{axis.toUpperCase()}</span>
                <button
                  type="button"
                  disabled={!checks?.turretCarriage}
                  aria-label={`Turret carriage local ${axis.toUpperCase()} negative`}
                  onClick={() => onTestTurretCarriage(axis, -1)}
                >
                  {axis.toUpperCase()}-
                </button>
                <button
                  type="button"
                  disabled={!checks?.turretCarriage}
                  aria-label={`Turret carriage local ${axis.toUpperCase()} positive`}
                  onClick={() => onTestTurretCarriage(axis, 1)}
                >
                  {axis.toUpperCase()}+
                </button>
              </div>
            ))}
          </div>
          <button
            className="calibration-reset"
            type="button"
            disabled={!checks?.turretCarriage}
            onClick={onResetTurretCarriage}
          >
            [ RESET TURRET CARRIAGE ]
          </button>
        </section>

        <section className="calibration-group">
          <h2>TURRET INDEX - LOCAL Z</h2>
          <div className="calibration-actions">
            <button
              type="button"
              disabled={!checks?.turretIndex}
              aria-label="Turret index local Z negative"
              onClick={() => onTestTurretIndex(-1)}
            >
              [ Z- ]
            </button>
            <button
              type="button"
              disabled={!checks?.turretIndex}
              aria-label="Turret index local Z positive"
              onClick={() => onTestTurretIndex(1)}
            >
              [ Z+ ]
            </button>
          </div>
          <button
            className="calibration-reset"
            type="button"
            disabled={!checks?.turretIndex}
            onClick={onResetTurretIndex}
          >
            [ RESET TURRET INDEX ]
          </button>
        </section>

        <section className="calibration-group">
          <h2>DOOR - LOCAL Z</h2>
          <div className="calibration-actions">
            <button type="button" disabled={!checks?.door} onClick={() => onSetDoorOpen(true)}>
              [ OPEN ]
            </button>
            <button type="button" disabled={!checks?.door} onClick={() => onSetDoorOpen(false)}>
              [ CLOSE ]
            </button>
            <button type="button" disabled={!checks?.door} onClick={onResetDoor}>
              [ RESET ]
            </button>
          </div>
        </section>
      </div>
    </aside>
  )
}
