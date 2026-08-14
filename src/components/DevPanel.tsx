import { CNC_AXIS_OPTIONS, type CncAxis } from '../animation/cncAnimationConfig'
import type {
  CalibrationAssembly,
  CalibrationDirection,
  CncInspection,
  NodeCheckKey,
} from '../types/cnc'

interface DevPanelProps {
  inspection: CncInspection | null
  isChuckTesting: boolean
  onPrintAudit: () => void
  onResetCamera: () => void
  onToggleChuck: () => void
  onTestTranslation: (
    assembly: CalibrationAssembly,
    axis: CncAxis,
    direction: CalibrationDirection,
  ) => void
  onResetAssembly: (assembly: CalibrationAssembly) => void
}

interface TranslationCalibrationProps {
  assembly: CalibrationAssembly
  label: string
  available: boolean
  onTest: DevPanelProps['onTestTranslation']
  onReset: DevPanelProps['onResetAssembly']
}

const NODE_LABELS: Array<[NodeCheckKey, string]> = [
  ['mainChuck', 'MAIN CHUCK'],
  ['workpiece', 'WORKPIECE'],
  ['tailstock', 'TAILSTOCK'],
  ['turret', 'TURRET'],
  ['door', 'DOOR'],
  ['doorGlass', 'DOOR GLASS'],
]

function TranslationCalibration({
  assembly,
  label,
  available,
  onTest,
  onReset,
}: TranslationCalibrationProps) {
  return (
    <section className="calibration-group">
      <h2>{label}</h2>
      <div className="translation-controls">
        {CNC_AXIS_OPTIONS.map((axis) => (
          <div className="translation-axis" key={axis}>
            <span>{axis.toUpperCase()}</span>
            <button
              type="button"
              disabled={!available}
              aria-label={`${label} local ${axis.toUpperCase()} negative`}
              onClick={() => onTest(assembly, axis, -1)}
            >
              {axis.toUpperCase()}−
            </button>
            <button
              type="button"
              disabled={!available}
              aria-label={`${label} local ${axis.toUpperCase()} positive`}
              onClick={() => onTest(assembly, axis, 1)}
            >
              {axis.toUpperCase()}+
            </button>
          </div>
        ))}
      </div>
      <button
        className="calibration-reset"
        type="button"
        disabled={!available}
        onClick={() => onReset(assembly)}
      >
        [ RESET {label} ]
      </button>
    </section>
  )
}

export function DevPanel({
  inspection,
  isChuckTesting,
  onPrintAudit,
  onResetCamera,
  onToggleChuck,
  onTestTranslation,
  onResetAssembly,
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
        <div className="calibration-panel__heading">
          <h2>VISUAL CALIBRATION</h2>
          <button type="button" disabled={!inspection} onClick={onResetCamera}>
            [ RESET VIEW ]
          </button>
        </div>

        <section className="calibration-group calibration-group--chuck">
          <h2>CHUCK ROTATION · LOCAL Z</h2>
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

        <TranslationCalibration
          assembly="tailstock"
          label="TAILSTOCK TRANSLATION"
          available={checks?.tailstock ?? false}
          onTest={onTestTranslation}
          onReset={onResetAssembly}
        />
        <TranslationCalibration
          assembly="turret"
          label="TURRET TRANSLATION"
          available={checks?.turret ?? false}
          onTest={onTestTranslation}
          onReset={onResetAssembly}
        />
        <TranslationCalibration
          assembly="door"
          label="DOOR MOTION"
          available={checks?.door ?? false}
          onTest={onTestTranslation}
          onReset={onResetAssembly}
        />
      </div>
    </aside>
  )
}
