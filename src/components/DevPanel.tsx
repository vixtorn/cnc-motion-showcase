import { CHUCK_AXIS_OPTIONS, type ChuckAxis } from '../animation/cncAnimationConfig'
import type { CncInspection, NodeCheckKey } from '../types/cnc'

interface DevPanelProps {
  inspection: CncInspection | null
  chuckAxis: ChuckAxis
  isChuckTesting: boolean
  onAxisChange: (axis: ChuckAxis) => void
  onPrintAudit: () => void
  onResetCamera: () => void
  onToggleChuck: () => void
}

const NODE_LABELS: Array<[NodeCheckKey, string]> = [
  ['mainChuck', 'MAIN CHUCK'],
  ['workpiece', 'WORKPIECE'],
  ['tailstock', 'TAILSTOCK'],
  ['turret', 'TURRET'],
  ['door', 'DOOR'],
  ['doorGlass', 'DOOR GLASS'],
]

export function DevPanel({
  inspection,
  chuckAxis,
  isChuckTesting,
  onAxisChange,
  onPrintAudit,
  onResetCamera,
  onToggleChuck,
}: DevPanelProps) {
  const chuckAvailable = inspection?.checks.mainChuck ?? false

  return (
    <aside className="dev-panel" aria-label="CNC development controls">
      <div className="dev-panel__header">
        <span>SCENE DIAGNOSTICS</span>
        <span className="dev-panel__mode">DEV ONLY</span>
      </div>

      <ul className="node-list">
        {NODE_LABELS.map(([key, label]) => {
          const state = inspection ? (inspection.checks[key] ? 'found' : 'missing') : 'pending'
          return (
            <li key={key}>
              <span>{label}</span>
              <span className={`node-state is-${state}`}>{state.toUpperCase()}</span>
            </li>
          )
        })}
      </ul>

      <div className="dev-panel__controls">
        <div className="axis-control" aria-label="Chuck local rotation axis">
          <span>LOCAL AXIS</span>
          {CHUCK_AXIS_OPTIONS.map((axis) => (
            <button
              key={axis}
              type="button"
              className={chuckAxis === axis ? 'is-active' : ''}
              aria-pressed={chuckAxis === axis}
              onClick={() => onAxisChange(axis)}
            >
              {axis.toUpperCase()}
            </button>
          ))}
        </div>

        <button
          type="button"
          className={isChuckTesting ? 'is-active' : ''}
          disabled={!chuckAvailable}
          aria-pressed={isChuckTesting}
          onClick={onToggleChuck}
        >
          {isChuckTesting ? '[ STOP + RESET CHUCK ]' : '[ TEST CHUCK ROTATION ]'}
        </button>

        <div className="dev-panel__dual">
          <button type="button" disabled={!inspection} onClick={onPrintAudit}>
            [ PRINT SCENE AUDIT ]
          </button>
          <button type="button" disabled={!inspection} onClick={onResetCamera}>
            [ RESET CAMERA ]
          </button>
        </div>
      </div>
    </aside>
  )
}
