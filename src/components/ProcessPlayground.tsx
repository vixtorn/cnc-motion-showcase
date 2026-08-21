import type { RefObject } from 'react'

interface ProcessPlaygroundProps {
  sectionRef: RefObject<HTMLElement | null>
  isActive: boolean
  interactionEnabled: boolean
  status: string
  onReset: () => void
}

export function ProcessPlayground({
  sectionRef,
  isActive,
  interactionEnabled,
  status,
  onReset,
}: ProcessPlaygroundProps) {
  return (
    <section
      ref={sectionRef}
      id="process"
      className={`process-playground${isActive ? ' is-active' : ''}`}
      aria-labelledby="process-playground-title"
    >
      <div className="process-playground__overlay">
        <header>
          <p>04 / PROCESS</p>
          <h2 id="process-playground-title">Interior playground</h2>
        </header>
        <div className="process-playground__status" aria-live="polite">
          <p>{interactionEnabled ? status : 'Interior inspection'}</p>
          <button type="button" onClick={onReset}>
            [ RESET PROCESS ]
          </button>
        </div>
      </div>
    </section>
  )
}
