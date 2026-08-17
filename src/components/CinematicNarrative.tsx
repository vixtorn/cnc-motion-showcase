import { memo, type CSSProperties } from 'react'
import type { CncSequenceTelemetry } from '../types/cnc'

interface CinematicNarrativeProps {
  progress: number
  telemetry: CncSequenceTelemetry
}

interface Chapter {
  number: string
  eyebrow: string
  title: string
  start: number
  fadeInEnd: number
  fadeOutStart: number
  end: number
}

const CHAPTERS: readonly Chapter[] = [
  {
    number: '01',
    eyebrow: 'INITIALIZATION',
    title: 'SPINDLE STARTUP',
    start: 0.165,
    fadeInEnd: 0.178,
    fadeOutStart: 0.246,
    end: 0.256,
  },
  {
    number: '02',
    eyebrow: 'WORKHOLDING',
    title: 'TAILSTOCK ENGAGED',
    start: 0.258,
    fadeInEnd: 0.27,
    fadeOutStart: 0.322,
    end: 0.332,
  },
  {
    number: '03',
    eyebrow: 'MACHINING',
    title: 'MATERIAL REMOVAL',
    start: 0.334,
    fadeInEnd: 0.347,
    fadeOutStart: 0.49,
    end: 0.502,
  },
  {
    number: '04',
    eyebrow: 'FINISHED COMPONENT',
    title: 'CAMSHAFT / INSPECTION',
    start: 0.504,
    fadeInEnd: 0.52,
    fadeOutStart: 0.686,
    end: 0.705,
  },
] as const

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value))
}

function chapterOpacity(progress: number, chapter: Chapter) {
  if (progress <= chapter.start || progress >= chapter.end) return 0
  if (progress < chapter.fadeInEnd) {
    return clamp01(
      (progress - chapter.start) / (chapter.fadeInEnd - chapter.start),
    )
  }
  if (progress > chapter.fadeOutStart) {
    return clamp01(
      (chapter.end - progress) / (chapter.end - chapter.fadeOutStart),
    )
  }
  return 1
}

function signedOffset(value: number) {
  const normalized = Math.abs(value) < 0.005 ? 0 : value
  return `${normalized >= 0 ? '+' : '−'}${Math.abs(normalized).toFixed(2)}`
}

const TelemetryReadout = memo(function TelemetryReadout({
  telemetry,
  opacity,
}: {
  telemetry: CncSequenceTelemetry
  opacity: number
}) {
  return (
    <aside
      className="cinematic-telemetry"
      aria-label="Live simulation telemetry"
      aria-hidden={opacity <= 0}
      style={{ '--telemetry-opacity': opacity } as CSSProperties}
    >
      <div className="telemetry-item telemetry-item--primary">
        <span>SPINDLE</span>
        <strong>{telemetry.spindleVisualRpm.toFixed(1)} RPM</strong>
      </div>
      <div className="telemetry-item telemetry-item--secondary">
        <span>TURRET POSITION</span>
        <strong>
          X {signedOffset(telemetry.turretOffsetX)} / Z{' '}
          {signedOffset(telemetry.turretOffsetZ)}
        </strong>
      </div>
      <div className="telemetry-item telemetry-item--secondary">
        <span>COOLANT</span>
        <strong>{telemetry.coolantActive ? 'ACTIVE' : 'OFF'}</strong>
      </div>
      <div className="telemetry-item telemetry-item--primary">
        <span>WORKPIECE</span>
        <strong>
          {telemetry.workpieceState === 'finished' ? 'FINISHED' : 'RAW STOCK'}
        </strong>
      </div>
    </aside>
  )
})

export const CinematicNarrative = memo(function CinematicNarrative({
  progress,
  telemetry,
}: CinematicNarrativeProps) {
  const opacities = CHAPTERS.map((chapter) =>
    chapterOpacity(progress, chapter),
  )
  const narrativeOpacity = Math.max(...opacities)

  return (
    <div className="cinematic-narrative" data-testid="cinematic-narrative">
      <div
        className="cinematic-chapters"
        aria-label="Manufacturing sequence chapter"
      >
        {CHAPTERS.map((chapter, index) => {
          const opacity = opacities[index]
          return (
            <section
              className="cinematic-chapter"
              key={chapter.number}
              aria-hidden={opacity <= 0}
              style={{ '--chapter-opacity': opacity } as CSSProperties}
            >
              <div className="chapter-index">{chapter.number}</div>
              <div className="chapter-copy">
                <p>{chapter.eyebrow}</p>
                <h2>{chapter.title}</h2>
              </div>
            </section>
          )
        })}
      </div>
      <TelemetryReadout telemetry={telemetry} opacity={narrativeOpacity} />
    </div>
  )
})
