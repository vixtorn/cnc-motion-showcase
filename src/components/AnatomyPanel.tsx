import { CNC_ANATOMY_COMPONENTS, getAnatomyComponent } from '../config/cncAnatomyConfig'
import type { CncAnatomyComponentId } from '../types/cnc'

interface AnatomyPanelProps {
  selectedId: CncAnatomyComponentId | null
  onSelect: (id: CncAnatomyComponentId) => void
  onOverview: () => void
  onExit: () => void
}

export function AnatomyPanel({ selectedId, onSelect, onOverview, onExit }: AnatomyPanelProps) {
  const selected = selectedId ? getAnatomyComponent(selectedId) : null

  return (
    <section className="anatomy-workspace" aria-label="Machine anatomy inspection">
      <header className="anatomy-workspace__header">
        <div>
          <p>05 / MACHINE ANATOMY</p>
          <h2>Inside the <span>turning center</span></h2>
        </div>
        <button type="button" onClick={onExit}>[ ESC / EXIT ]</button>
      </header>

      <nav className="anatomy-index" aria-label="Machine component index">
        <p>COMPONENT INDEX</p>
        {CNC_ANATOMY_COMPONENTS.map((component) => (
          <button
            key={component.id}
            type="button"
            className={component.id === selectedId ? 'is-selected' : ''}
            aria-pressed={component.id === selectedId}
            onClick={() => onSelect(component.id)}
          >
            <span>{component.number}</span>
            {component.label}
          </button>
        ))}
      </nav>

      <aside className="anatomy-info" aria-live="polite">
        {selected ? (
          <>
            <p>{selected.number} / COMPONENT</p>
            <h3>{selected.label}</h3>
            <p className="anatomy-info__description">{selected.description}</p>
            <dl>
              {selected.facts.map((fact) => (
                <div key={fact.label}>
                  <dt>{fact.label}</dt>
                  <dd>{fact.value}</dd>
                </div>
              ))}
            </dl>
            <button type="button" onClick={onOverview}>[ OVERVIEW ]</button>
          </>
        ) : (
          <>
            <p>OVERVIEW</p>
            <h3>Major assemblies</h3>
            <p className="anatomy-info__description">
              Select a locator in the machine or choose a component from the index.
            </p>
          </>
        )}
      </aside>
    </section>
  )
}
