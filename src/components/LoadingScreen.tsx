import { useEffect, useState, type CSSProperties } from 'react'
import { useProgress } from '@react-three/drei'

type LoadingStyle = CSSProperties & { '--loading-progress': number }

export function LoadingScreen() {
  const { active, errors, progress } = useProgress()
  const [complete, setComplete] = useState(false)
  const safeProgress = Math.min(100, Math.max(0, Math.round(progress)))
  const hasErrors = errors.length > 0
  const ready = !active && progress >= 100 && !hasErrors

  useEffect(() => {
    if (!ready) return
    const timeout = window.setTimeout(() => setComplete(true), 360)
    return () => window.clearTimeout(timeout)
  }, [ready])

  const statusLabel = hasErrors
    ? 'Machine loading failed'
    : ready
      ? 'CNC machine ready'
      : 'Loading CNC machine'

  return (
    <div
      className={`loading-screen${ready ? ' is-ready' : ''}${complete ? ' is-complete' : ''}`}
      aria-hidden={complete}
      aria-busy={!ready && !hasErrors}
      data-loading-progress={safeProgress}
      data-loading-state={hasErrors ? 'error' : ready ? 'ready' : 'loading'}
    >
      <div className="loading-module">
        <div className="loading-identity" aria-hidden="true">
          <span>DUMAN / CNC</span>
          <span>01 — UNIVERSAL TURNING CENTER</span>
        </div>

        <div className="loading-readout">
          <p className="loading-title">{ready ? 'Machine ready' : 'Loading machine'}</p>
          <p className="loading-value" aria-hidden="true">
            {safeProgress.toString().padStart(2, '0')}%
          </p>
        </div>

        <div
          className="loading-track"
          role="progressbar"
          aria-label={statusLabel}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={safeProgress}
          aria-valuetext={ready ? 'Ready' : `${safeProgress}%`}
          style={{ '--loading-progress': safeProgress / 100 } as LoadingStyle}
        >
          <span />
        </div>

        <p className="loading-footnote" aria-hidden="true">
          Precision motion / system initialization
        </p>
        <span className="sr-only" role="status" aria-live="polite">
          {statusLabel}
        </span>

        {hasErrors ? (
          <p className="loading-error">Model transfer failed. Check the asset path and try again.</p>
        ) : null}
      </div>
    </div>
  )
}
