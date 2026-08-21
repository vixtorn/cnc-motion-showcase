import type { CncProcessComparisonState } from '../types/cnc'

interface ProcessComparisonPanelProps {
  state: CncProcessComparisonState
  progress: number
  onProgressChange: (progress: number) => void
  onReset: () => void
  onExit: () => void
}

export function ProcessComparisonPanel({
  state,
  progress,
  onProgressChange,
  onReset,
  onExit,
}: ProcessComparisonPanelProps) {
  const percentage = Math.round(progress * 100)
  const ready = state === 'ready'

  return (
    <section
      className="comparison-workspace"
      aria-labelledby="comparison-workspace-title"
    >
      <header className="comparison-workspace__header">
        <div>
          <p>04 / PROCESS COMPARISON</p>
          <h2 id="comparison-workspace-title">
            FROM STOCK <span>TO FINISHED</span>
          </h2>
        </div>
        <button type="button" onClick={onExit}>
          [ EXIT COMPARISON ]
        </button>
      </header>

      <div className="comparison-control">
        <div className="comparison-control__readout" aria-hidden="true">
          <span>RAW STOCK</span>
          <strong>{ready ? `${percentage}% REVEAL` : 'PREPARING VIEW'}</strong>
          <span>FINISHED CAMSHAFT</span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          step="1"
          value={percentage}
          disabled={!ready}
          aria-label="Compare raw stock and finished camshaft"
          onInput={(event) => onProgressChange(Number(event.currentTarget.value) / 100)}
          onKeyDown={(event) => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
            event.preventDefault()
            const nextPercentage =
              event.key === 'Home'
                ? 0
                : event.key === 'End'
                  ? 100
                  : Math.min(
                      Math.max(percentage + (event.key === 'ArrowLeft' ? -1 : 1), 0),
                      100,
                    )
            onProgressChange(nextPercentage / 100)
          }}
        />
        <div className="comparison-control__scale" aria-hidden="true">
          <span>0% / RAW</span>
          <span>DRAG TO COMPARE</span>
          <span>100% / FINISHED</span>
        </div>
        <button type="button" disabled={!ready || percentage === 0} onClick={onReset}>
          [ RESET TO RAW ]
        </button>
      </div>
    </section>
  )
}
