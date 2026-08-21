import { CNC_ANATOMY_COMPONENTS } from '../config/cncAnatomyConfig'

interface MachineAnatomyProps {
  ready: boolean
  onEnter: () => void
}

export function MachineAnatomy({ ready, onEnter }: MachineAnatomyProps) {
  return (
    <section id="anatomy" className="machine-anatomy" aria-labelledby="machine-anatomy-title">
      <div className="machine-anatomy__frame">
        <header className="machine-anatomy__header">
          <p>05 / MACHINE ANATOMY</p>
          <p>MAJOR ASSEMBLIES / INTERACTIVE INDEX</p>
        </header>
        <div className="machine-anatomy__body">
          <div>
            <h2 id="machine-anatomy-title">
              <span>Inside the</span>
              <span>turning center</span>
            </h2>
            <p>
              Explore the major assemblies that hold, position, support and machine
              the workpiece.
            </p>
          </div>
          <div className="machine-anatomy__systems" aria-label="Available machine assemblies">
            {CNC_ANATOMY_COMPONENTS.map((component) => (
              <span key={component.id}>
                {component.number} / {component.label}
              </span>
            ))}
          </div>
          <div className="machine-anatomy__action">
            <button type="button" disabled={!ready} onClick={onEnter}>
              {ready ? '[ INSPECT THE MACHINE ]' : '[ INITIALIZING MACHINE ]'}
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
