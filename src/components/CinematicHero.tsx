import type { CSSProperties } from 'react'

const HERO_PRESENTATION = {
  fadeStart: 0.035,
  fadeEnd: 0.105,
} as const

type HeroStyle = CSSProperties & {
  '--hero-exit': number
  '--hero-visibility': number
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

const normalizedRange = (value: number, start: number, end: number) =>
  clamp01((value - start) / (end - start))

interface CinematicHeroProps {
  progress: number
}

export function CinematicHero({ progress }: CinematicHeroProps) {
  const exitProgress = normalizedRange(
    progress,
    HERO_PRESENTATION.fadeStart,
    HERO_PRESENTATION.fadeEnd,
  )
  const visibility = 1 - exitProgress
  const isHidden = visibility === 0
  const style = {
    '--hero-exit': exitProgress,
    '--hero-visibility': visibility,
  } as HeroStyle

  return (
    <div
      className={`cinematic-hero${isHidden ? ' is-hidden' : ''}`}
      style={style}
      aria-hidden={isHidden}
    >
      <div className="hero-masthead">
        <p className="hero-identity">DUMAN / CNC 01</p>
        <p className="hero-study-label" aria-hidden="true">
          Interactive manufacturing study
        </p>
      </div>

      <div className="hero-title-block">
        <p className="hero-eyebrow" aria-hidden="true">
          Precision in motion
        </p>
        <h1>
          <span>Universal</span>
          <span>Turning center</span>
        </h1>
      </div>

      <p className="hero-description">
        An interactive study of precision,
        <br />
        motion and manufacturing.
      </p>

      <div className="hero-scroll-cue" aria-hidden="true">
        <span>Scroll to begin</span>
        <i />
      </div>
    </div>
  )
}
