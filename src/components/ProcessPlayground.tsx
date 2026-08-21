import type { RefObject } from 'react'

interface ProcessPlaygroundProps {
  sectionRef: RefObject<HTMLElement | null>
  isActive: boolean
}

export function ProcessPlayground({
  sectionRef,
  isActive,
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
      </div>
    </section>
  )
}
