import { useEffect, useState, type CSSProperties } from 'react'
import { useProgress } from '@react-three/drei'

type LoadingStyle = CSSProperties & { '--loading-progress': number }

export function LoadingScreen() {
  const { active, errors, progress } = useProgress()
  const [complete, setComplete] = useState(false)
  const safeProgress = Math.min(100, Math.max(0, Math.round(progress)))

  useEffect(() => {
    if (active || progress < 100 || errors.length > 0) return
    const timeout = window.setTimeout(() => setComplete(true), 280)
    return () => window.clearTimeout(timeout)
  }, [active, errors.length, progress])

  return (
    <div
      className={`loading-screen${complete ? ' is-complete' : ''}`}
      aria-live="polite"
      aria-hidden={complete}
    >
      <div className="loading-module">
        <p className="loading-title">Loading CNC system</p>
        <p className="loading-value">{safeProgress.toString().padStart(2, '0')}%</p>
        <div
          className="loading-track"
          role="progressbar"
          aria-label="CNC model loading progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={safeProgress}
          style={{ '--loading-progress': safeProgress / 100 } as LoadingStyle}
        >
          <span />
        </div>
        {errors.length > 0 ? (
          <p className="loading-error">Model transfer failed. Check the asset path and try again.</p>
        ) : null}
      </div>
    </div>
  )
}
