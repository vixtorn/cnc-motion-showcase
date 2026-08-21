interface RunTheMachineProps {
  ready: boolean
  onEnter: () => void
}

const OPERATOR_SYSTEMS = ['SPINDLE', 'TAILSTOCK', 'TURRET', 'COOLANT'] as const

export function RunTheMachine({ ready, onEnter }: RunTheMachineProps) {
  return (
    <section id="operator" className="run-machine" aria-labelledby="run-machine-title">
      <div className="run-machine__frame">
        <header className="run-machine__header">
          <p>03 / OPERATOR MODE</p>
          <p>GUIDED MANUAL CYCLE / SIMULATION</p>
        </header>

        <div className="run-machine__body">
          <div>
            <h2 id="run-machine-title">
              <span>Run</span>
              <span>the machine</span>
            </h2>
            <p className="run-machine__statement">
              Operate the same spindle, tailstock and turret used in the
              cinematic machining cycle.
            </p>
          </div>

          <div className="run-machine__systems">
            <p>SYSTEMS AVAILABLE</p>
            <ul>
              {OPERATOR_SYSTEMS.map((system, index) => (
                <li key={system}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  {system}
                </li>
              ))}
            </ul>
            <button type="button" disabled={!ready} onClick={onEnter}>
              {ready ? '[ ENTER CONTROL MODE ]' : '[ INITIALIZING MACHINE ]'}
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
