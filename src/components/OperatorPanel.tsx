import { useEffect, useRef } from 'react'
import type {
  CncOperatorAction,
  CncOperatorState,
  CncOperatorTelemetry,
} from '../types/cnc'

interface OperatorPanelProps {
  state: CncOperatorState
  telemetry: CncOperatorTelemetry
  onStartSpindle: () => void
  onEngageTailstock: () => void
  onIndexTool: () => void
  onApproachCut: () => void
  onStartCoolant: () => void
  onCompletePass: () => void
  onReset: () => void
  onExit: () => void
}

interface OperatorActionDefinition {
  id: CncOperatorAction
  number: string
  label: string
}

const OPERATOR_ACTIONS: readonly OperatorActionDefinition[] = [
  { id: 'start-spindle', number: '01', label: 'START SPINDLE' },
  { id: 'engage-tailstock', number: '02', label: 'ENGAGE TAILSTOCK' },
  { id: 'index-tool', number: '03', label: 'INDEX TOOL' },
  { id: 'approach-cut', number: '04', label: 'APPROACH CUT' },
  { id: 'start-coolant', number: '05', label: 'START COOLANT' },
  { id: 'complete-pass', number: '06', label: 'COMPLETE PASS' },
] as const

const STATE_PROGRESS: Record<CncOperatorState, number> = {
  inactive: 0,
  preparing: 0,
  ready: 0,
  'starting-spindle': 0,
  'spindle-running': 1,
  'engaging-tailstock': 1,
  'tailstock-engaged': 2,
  'indexing-tool': 2,
  'tool-indexed': 3,
  'approaching-cut': 3,
  'cut-position': 4,
  'starting-coolant': 4,
  'coolant-active': 5,
  'completing-pass': 5,
  'cycle-complete': 6,
  resetting: 0,
  exiting: 0,
}

const PENDING_STATES = new Set<CncOperatorState>([
  'starting-spindle',
  'engaging-tailstock',
  'indexing-tool',
  'approaching-cut',
  'starting-coolant',
  'completing-pass',
])

const STATUS_LABELS: Record<CncOperatorState, string> = {
  inactive: 'OFFLINE',
  preparing: 'PREPARING CELL',
  ready: 'READY',
  'starting-spindle': 'SPINDLE RAMPING',
  'spindle-running': 'SPINDLE RUNNING',
  'engaging-tailstock': 'TAILSTOCK MOVING',
  'tailstock-engaged': 'TAILSTOCK ENGAGED',
  'indexing-tool': 'TURRET INDEXING',
  'tool-indexed': 'TOOL INDEXED',
  'approaching-cut': 'TURRET APPROACHING',
  'cut-position': 'CUT POSITION',
  'starting-coolant': 'COOLANT STARTING',
  'coolant-active': 'COOLANT ACTIVE',
  'completing-pass': 'COMPLETING PASS',
  'cycle-complete': 'CYCLE COMPLETE',
  resetting: 'RESETTING CELL',
  exiting: 'RESTORING CINEMATIC',
}

export function OperatorPanel({
  state,
  telemetry,
  onStartSpindle,
  onEngageTailstock,
  onIndexTool,
  onApproachCut,
  onStartCoolant,
  onCompletePass,
  onReset,
  onExit,
}: OperatorPanelProps) {
  const firstActionRef = useRef<HTMLButtonElement>(null)
  const progress = STATE_PROGRESS[state]
  const unavailable = state === 'preparing' || state === 'resetting' || state === 'exiting'
  const handlers: Record<CncOperatorAction, () => void> = {
    'start-spindle': onStartSpindle,
    'engage-tailstock': onEngageTailstock,
    'index-tool': onIndexTool,
    'approach-cut': onApproachCut,
    'start-coolant': onStartCoolant,
    'complete-pass': onCompletePass,
  }

  useEffect(() => {
    if (state === 'ready') firstActionRef.current?.focus()
  }, [state])

  const nextAction =
    state === 'cycle-complete'
      ? 'RESULT READY'
      : unavailable
        ? STATUS_LABELS[state]
        : OPERATOR_ACTIONS[progress]?.label ?? 'RESET CELL'

  return (
    <div
      className="operator-workspace"
      role="dialog"
      aria-modal="true"
      aria-labelledby="operator-panel-title"
    >
      <div className="operator-workspace__identity" aria-hidden="true">
        <span>DUMAN / CNC</span>
        <span>MANUAL SIMULATION</span>
      </div>

      <section className="operator-panel">
        <header className="operator-panel__header">
          <div>
            <p>GUIDED CYCLE / SIMULATION</p>
            <h2 id="operator-panel-title">RUN THE MACHINE</h2>
          </div>
          <button type="button" className="operator-panel__exit" onClick={onExit}>
            [ EXIT ]
          </button>
        </header>

        <div className="operator-panel__status" aria-live="polite" aria-atomic="true">
          <div>
            <span>STATUS</span>
            <strong>{STATUS_LABELS[state]}</strong>
          </div>
          <div>
            <span>NEXT ACTION</span>
            <strong>{nextAction}</strong>
          </div>
        </div>

        <div className="operator-panel__telemetry" aria-label="Operator telemetry">
          <div><span>SPINDLE</span><strong>{telemetry.spindleVisualRpm.toFixed(1)} RPM</strong></div>
          <div><span>TAILSTOCK</span><strong>{telemetry.tailstock.toUpperCase()}</strong></div>
          <div><span>TURRET</span><strong>{telemetry.turret.replace('-', ' ').toUpperCase()}</strong></div>
          <div><span>COOLANT</span><strong>{telemetry.coolantActive ? 'ACTIVE' : 'OFF'}</strong></div>
          <div><span>WORKPIECE</span><strong>{telemetry.workpieceState.toUpperCase()}</strong></div>
        </div>

        <ol className="operator-actions">
          {OPERATOR_ACTIONS.map((action, index) => {
            const isComplete = index < progress || state === 'cycle-complete'
            const isCurrent = index === progress && PENDING_STATES.has(state)
            const isAvailable = index === progress && !unavailable && !isCurrent
            const controlState = isComplete
              ? 'complete'
              : isCurrent
                ? 'in-progress'
                : isAvailable
                  ? 'available'
                  : 'locked'
            return (
              <li key={action.id} data-control-state={controlState}>
                <button
                  ref={index === 0 ? firstActionRef : undefined}
                  type="button"
                  data-action={action.id}
                  disabled={!isAvailable}
                  onClick={handlers[action.id]}
                >
                  <span>{action.number}</span>
                  <strong>{action.label}</strong>
                  <em>{controlState.replace('-', ' ')}</em>
                </button>
              </li>
            )
          })}
        </ol>

        <footer className="operator-panel__footer">
          <button
            type="button"
            disabled={state === 'preparing' || state === 'resetting' || state === 'exiting'}
            onClick={onReset}
          >
            [ RESET CELL ]
          </button>
          <span>ESC / EXIT CONTROL MODE</span>
        </footer>
      </section>
    </div>
  )
}
