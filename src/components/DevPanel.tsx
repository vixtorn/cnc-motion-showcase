import { CNC_AXIS_OPTIONS, type CncAxis } from '../animation/cncAnimationConfig'
import { CNC_CHOREOGRAPHY } from '../animation/cncChoreographyConfig'
import type {
  CalibrationDirection,
  CncInspection,
  CncSequenceState,
  NodeCheckKey,
} from '../types/cnc'
import type { CameraWaypointName } from '../scene/CameraRig'
import type { CncScrollDiagnostics } from '../hooks/useCncScrollDriver'
import { CNC_SCROLL } from '../hooks/useCncScrollDriver'

interface DevPanelProps {
  inspection: CncInspection | null
  isChuckTesting: boolean
  sequenceState: CncSequenceState
  sequenceProgress: number
  scrollDriverEnabled: boolean
  scrollDiagnostics: CncScrollDiagnostics
  scrollPacing: number
  scrollLength: number
  smoothScrollEnabled: boolean
  smoothScrollActive: boolean
  cameraSpeedMultiplier: number
  onCameraSpeedMultiplierChange: (multiplier: number) => void
  onPrintAudit: () => void
  onResetCamera: () => void
  onTestCameraWaypoint: (name: CameraWaypointName) => void
  onTestInteriorCamera: () => void
  onTestDumanCamera: () => void
  onTestInteriorToDumanPath: () => void
  onTestFinishedPartCamera: () => void
  onStartCoolant: () => void
  onStopCoolant: () => void
  onTestWorkpieceTransition: () => void
  onResetMachining: () => void
  onStartSparks: () => void
  onStopSparks: () => void
  onResetSparks: () => void
  onToggleChuck: () => void
  onSetTailstockContact: (contact: boolean) => void
  onResetTailstock: () => void
  onTestTurretCarriage: (axis: CncAxis, direction: CalibrationDirection) => void
  onResetTurretCarriage: () => void
  onTestTurretIndex: (direction: CalibrationDirection) => void
  onResetTurretIndex: () => void
  onSetDoorOpen: (open: boolean) => void
  onResetDoor: () => void
  onPlaySequence: () => void
  onPauseSequence: () => void
  onResumeSequence: () => void
  onResetSequence: () => void
  onSequenceProgressChange: (progress: number) => void
  onScrollDriverEnabledChange: (enabled: boolean) => void
  onScrollPacingChange: (pacing: number) => void
  onSmoothScrollEnabledChange: (enabled: boolean) => void
}

const NODE_LABELS: Array<[NodeCheckKey, string]> = [
  ['mainChuck', 'MAIN CHUCK'],
  ['workpiece', 'WORKPIECE'],
  ['finishedWorkpiece', 'FINISHED WORKPIECE'],
  ['tailstock', 'TAILSTOCK'],
  ['turretCarriage', 'TURRET CARRIAGE'],
  ['turretIndex', 'TURRET INDEX'],
  ['turretRearSleeve', 'TURRET REAR SLEEVE'],
  ['turretCenterHub', 'TURRET CENTER HUB'],
  ['door', 'DOOR'],
  ['doorGlass', 'DOOR GLASS'],
  ['doorLowerStrip', 'DOOR LOWER STRIP'],
]

export function DevPanel({
  inspection,
  isChuckTesting,
  sequenceState,
  sequenceProgress,
  scrollDriverEnabled,
  scrollDiagnostics,
  scrollPacing,
  scrollLength,
  smoothScrollEnabled,
  smoothScrollActive,
  cameraSpeedMultiplier,
  onCameraSpeedMultiplierChange,
  onPrintAudit,
  onResetCamera,
  onTestCameraWaypoint,
  onTestInteriorCamera,
  onTestDumanCamera,
  onTestInteriorToDumanPath,
  onTestFinishedPartCamera,
  onStartCoolant,
  onStopCoolant,
  onTestWorkpieceTransition,
  onResetMachining,
  onStartSparks,
  onStopSparks,
  onResetSparks,
  onToggleChuck,
  onSetTailstockContact,
  onResetTailstock,
  onTestTurretCarriage,
  onResetTurretCarriage,
  onTestTurretIndex,
  onResetTurretIndex,
  onSetDoorOpen,
  onResetDoor,
  onPlaySequence,
  onPauseSequence,
  onResumeSequence,
  onResetSequence,
  onSequenceProgressChange,
  onScrollDriverEnabledChange,
  onScrollPacingChange,
  onSmoothScrollEnabledChange,
}: DevPanelProps) {
  const checks = inspection?.checks
  const diagnosticsDisabled = sequenceState === 'playing' || sequenceState === 'paused'
  const cameraSpeed = CNC_CHOREOGRAPHY.cameraSpeed
  const updateCameraSpeed = (direction: -1 | 1) => {
    const nextMultiplier = Math.min(
      cameraSpeed.maximumMultiplier,
      Math.max(
        cameraSpeed.minimumMultiplier,
        cameraSpeedMultiplier + direction * cameraSpeed.step,
      ),
    )
    onCameraSpeedMultiplierChange(Number(nextMultiplier.toFixed(2)))
  }
  const updateScrollPacing = (direction: -1 | 1) => {
    onScrollPacingChange(
      Number((scrollPacing + direction * CNC_SCROLL.pacingStep).toFixed(2)),
    )
  }

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
        <section className="calibration-group choreography-controls">
          <div className="choreography-heading">
            <h2>PHASE 2D CHOREOGRAPHY</h2>
            <span className={`sequence-state is-${sequenceState}`}>
              STATE: {sequenceState.toUpperCase()}
            </span>
          </div>
          <button
            type="button"
            className={scrollDriverEnabled ? 'is-active' : ''}
            aria-pressed={scrollDriverEnabled}
            onClick={() => onScrollDriverEnabledChange(!scrollDriverEnabled)}
          >
            [ SCROLL DRIVER: {scrollDriverEnabled ? 'ON' : 'OFF'} ]
          </button>
          <button
            type="button"
            className={smoothScrollActive ? 'is-active' : ''}
            aria-pressed={smoothScrollEnabled}
            onClick={() => onSmoothScrollEnabledChange(!smoothScrollEnabled)}
          >
            [ SMOOTH SCROLL: {smoothScrollEnabled ? 'ON' : 'OFF'} ]
          </button>
          <dl className="scroll-diagnostics">
            <div>
              <dt>RAW SCROLL</dt>
              <dd>{(scrollDiagnostics.raw * 100).toFixed(1)}%</dd>
            </div>
            <div>
              <dt>TARGET</dt>
              <dd>{(scrollDiagnostics.target * 100).toFixed(1)}%</dd>
            </div>
            <div>
              <dt>SEQUENCE</dt>
              <dd>{(sequenceProgress * 100).toFixed(1)}%</dd>
            </div>
            <div>
              <dt>SCROLL PACING</dt>
              <dd>{scrollPacing.toFixed(2)}x</dd>
            </div>
            <div>
              <dt>SCROLL LENGTH</dt>
              <dd>{scrollLength.toFixed(1)} VIEWPORTS</dd>
            </div>
          </dl>
          <div className="scroll-pacing-control">
            <span>SCROLL PACING</span>
            <button
              type="button"
              aria-label="Decrease scroll pacing"
              disabled={scrollPacing <= CNC_SCROLL.minimumPacing}
              onClick={() => updateScrollPacing(-1)}
            >
              [ - ]
            </button>
            <output aria-live="polite">{scrollPacing.toFixed(2)}x</output>
            <button
              type="button"
              aria-label="Increase scroll pacing"
              disabled={scrollPacing >= CNC_SCROLL.maximumPacing}
              onClick={() => updateScrollPacing(1)}
            >
              [ + ]
            </button>
          </div>
          <label className="scroll-pacing-range">
            <span className="sr-only">Scroll pacing multiplier</span>
            <input
              type="range"
              min={CNC_SCROLL.minimumPacing}
              max={CNC_SCROLL.maximumPacing}
              step={CNC_SCROLL.pacingStep}
              value={scrollPacing}
              onInput={(event) => onScrollPacingChange(Number(event.currentTarget.value))}
            />
          </label>
          <div className="calibration-actions">
            <button
              type="button"
              disabled={
                scrollDriverEnabled ||
                !inspection ||
                sequenceState === 'playing' ||
                sequenceState === 'paused'
              }
              onClick={onPlaySequence}
            >
              [ PLAY SEQUENCE ]
            </button>
            <button
              type="button"
              disabled={scrollDriverEnabled || sequenceState !== 'playing'}
              onClick={onPauseSequence}
            >
              [ PAUSE ]
            </button>
            <button
              type="button"
              disabled={scrollDriverEnabled || sequenceState !== 'paused'}
              onClick={onResumeSequence}
            >
              [ RESUME ]
            </button>
            <button
              type="button"
              disabled={scrollDriverEnabled || !inspection}
              onClick={onResetSequence}
            >
              [ RESET SEQUENCE ]
            </button>
          </div>
          <label className="sequence-scrub-control">
            <span>SEQUENCE SCRUB</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.001"
              value={sequenceProgress}
              disabled={scrollDriverEnabled || !inspection}
              aria-label="Sequence scrub progress"
              onInput={(event) => onSequenceProgressChange(Number(event.currentTarget.value))}
            />
            <output>{Math.round(sequenceProgress * 100)}%</output>
          </label>
        </section>

        <fieldset className="calibration-diagnostics" disabled={diagnosticsDisabled}>
        <section className="calibration-group">
          <h2>PHASE 2D MACHINING</h2>
          <div className="calibration-actions">
            <button type="button" disabled={!inspection} onClick={onStartCoolant}>
              [ START COOLANT ]
            </button>
            <button type="button" disabled={!inspection} onClick={onStopCoolant}>
              [ STOP COOLANT ]
            </button>
            <button
              type="button"
              disabled={!checks?.workpiece || !checks.finishedWorkpiece}
              onClick={onTestWorkpieceTransition}
            >
              [ TEST RAW TO FINISHED ]
            </button>
            <button
              type="button"
              disabled={!inspection?.finishedWorkpieceBounds}
              onClick={onTestFinishedPartCamera}
            >
              [ TEST FINISHED PART CAMERA ]
            </button>
            <button type="button" disabled={!inspection} onClick={onResetMachining}>
              [ RESET MACHINING ]
            </button>
            <button type="button" disabled={!checks?.workpiece} onClick={onStartSparks}>
              [ START SPARK TEST ]
            </button>
            <button type="button" disabled={!checks?.workpiece} onClick={onStopSparks}>
              [ STOP SPARK TEST ]
            </button>
            <button type="button" disabled={!checks?.workpiece} onClick={onResetSparks}>
              [ RESET SPARK TEST ]
            </button>
          </div>
        </section>

        <section className="calibration-group">
          <h2>CAMERA PATH CALIBRATION</h2>
          <div className="camera-speed-control">
            <span>CAMERA SPEED</span>
            <button
              type="button"
              aria-label="Decrease camera speed"
              disabled={cameraSpeedMultiplier <= cameraSpeed.minimumMultiplier}
              onClick={() => updateCameraSpeed(-1)}
            >
              [ - ]
            </button>
            <output aria-live="polite">{cameraSpeedMultiplier.toFixed(2)}x</output>
            <button
              type="button"
              aria-label="Increase camera speed"
              disabled={cameraSpeedMultiplier >= cameraSpeed.maximumMultiplier}
              onClick={() => updateCameraSpeed(1)}
            >
              [ + ]
            </button>
          </div>
          <div className="calibration-actions">
            <button type="button" disabled={!inspection} onClick={onResetCamera}>
              [ RESET VIEW ]
            </button>
            <button
              type="button"
              disabled={!inspection}
              onClick={() => onTestCameraWaypoint('doorApproach')}
            >
              [ TEST DOOR APPROACH CAMERA ]
            </button>
            <button
              type="button"
              disabled={!inspection}
              onClick={() => onTestCameraWaypoint('doorThreshold')}
            >
              [ TEST DOOR THRESHOLD CAMERA ]
            </button>
            <button
              type="button"
              disabled={!inspection?.interiorBounds}
              onClick={onTestInteriorCamera}
            >
              [ TEST INTERIOR CAMERA ]
            </button>
            <button
              type="button"
              disabled={!inspection}
              onClick={() => onTestCameraWaypoint('exitThreshold')}
            >
              [ TEST EXIT THRESHOLD CAMERA ]
            </button>
            <button
              type="button"
              disabled={!inspection?.dumanBadgeBounds}
              onClick={onTestDumanCamera}
            >
              [ TEST DUMAN CAMERA ]
            </button>
            <button
              type="button"
              disabled={!inspection?.interiorBounds || !inspection?.dumanBadgeBounds}
              onClick={onTestInteriorToDumanPath}
            >
              [ TEST INTERIOR TO DUMAN PATH ]
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
        </fieldset>
      </div>
    </aside>
  )
}
