const stack = [
  'BLENDER',
  'REACT',
  'TYPESCRIPT',
  'THREE.JS',
  'REACT THREE FIBER',
  'DREI',
  'GSAP',
  'LENIS',
  'VITE',
]

const engineeringIndex = [
  ['01', 'ASSET'],
  ['02', 'TIMELINE'],
  ['03', 'SCROLL'],
  ['04', 'STATE'],
  ['05', 'EFFECTS'],
  ['06', 'INTERACTION'],
]

export function EngineeringExperience() {
  return (
    <section className="engineering-experience" aria-labelledby="engineering-title">
      <div className="engineering-experience__frame">
        <header className="engineering-experience__header">
          <p>06 / ENGINEERING</p>
          <p>SYSTEM NOTES / REAL-TIME INTEGRATION</p>
        </header>

        <div className="engineering-experience__layout">
          <nav className="engineering-index" aria-label="Engineering topics">
            <p>CASE STUDY INDEX</p>
            {engineeringIndex.map(([number, label]) => (
              <a key={number} href={`#engineering-${number}`}>
                <span>{number}</span>
                {label}
              </a>
            ))}
          </nav>

          <div className="engineering-experience__content">
            <div className="engineering-intro">
              <p className="engineering-kicker">ENGINEERING THE EXPERIENCE</p>
              <h2 id="engineering-title">
                <span>Engineering</span>
                <span>the experience</span>
              </h2>
              <p>
                A single CNC scene coordinates cinematic playback, direct manipulation,
                machine state and procedural effects through one deterministic interaction
                architecture.
              </p>
              <div className="engineering-stack" aria-label="Project technology stack">
                {stack.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            </div>

            <dl className="engineering-metrics" aria-label="Verified project metrics">
              <div><dt>CANONICAL CINEMATIC</dt><dd>41.800s</dd></div>
              <div><dt>PRODUCTION CANVAS</dt><dd>01</dd></div>
              <div><dt>CNC SCENE INSTANCE</dt><dd>01</dd></div>
              <div><dt>INTERACTION MODES</dt><dd>04</dd></div>
              <div><dt>ANATOMY COMPONENTS</dt><dd>05</dd></div>
              <div><dt>TURRET INDEX</dt><dd>30°</dd></div>
            </dl>

            <article className="engineering-topic engineering-topic--asset" id="engineering-01">
              <div className="engineering-topic__heading">
                <p>01 / ASSET ARCHITECTURE</p>
                <h3>Movement starts in the hierarchy.</h3>
              </div>
              <div className="engineering-topic__body">
                <p>
                  The Blender-authored GLB exposes mechanical assemblies as named nodes.
                  The application resolves those nodes into independently controlled systems,
                  rather than treating the machine as one static object.
                </p>
                <div className="engineering-tree" role="img" aria-label="Turret hierarchy: Turret Carriage Assembly contains Turret Center Hub, Turret Index Assembly which contains Turret Assembly, and Turret Rear Sleeve.">
                  <p>Turret_CarriageAssembly</p>
                  <ul>
                    <li>Turret_CenterHub</li>
                    <li><strong>Turret_IndexAssembly</strong><ul><li>Turret_Assembly</li></ul></li>
                    <li>Turret_RearSleeve</li>
                  </ul>
                </div>
                <div className="engineering-fact-list" aria-label="Asset architecture facts">
                  <span>FrontDoor_Assembly</span><span>MainChuck_Assembly</span>
                  <span>Tailstock_MovingAssembly</span><span>Workpiece_Raw</span>
                  <span>Workpiece_Finished_Camshaft</span>
                </div>
                <p className="engineering-note">
                  The carriage receives home-relative X/Z offsets; the index assembly owns the
                  30° tool rotation. On return, X resolves before Z, keeping the two transforms
                  separate and predictable.
                </p>
              </div>
            </article>

            <article className="engineering-topic engineering-topic--timeline" id="engineering-02">
              <div className="engineering-topic__heading">
                <p>02 / CANONICAL TIMELINE</p>
                <h3>One sequence time, many ways to reach it.</h3>
              </div>
              <div className="engineering-topic__body engineering-topic__body--split">
                <p>
                  The 41.800-second GSAP timeline is the canonical source for the cinematic.
                  Autoplay, scroll scrub and direct seeking all resolve through the same
                  timeline time, so a frame has one defined camera, machine and effect state.
                </p>
                <div className="engineering-flow" role="img" aria-label="Canonical timeline branches to autoplay, scroll, development scrub, and state reconciliation.">
                  <div className="engineering-flow__origin">CANONICAL<br />TIMELINE<br /><b>41.800s</b></div>
                  <div className="engineering-flow__branches"><span>AUTOPLAY</span><span>SCROLL</span><span>DIRECT SEEK</span><span>STATE RECONCILIATION</span></div>
                </div>
                <div className="engineering-state-flow" role="img" aria-label="Sequence time resolves camera, spindle, turret, tailstock, coolant, and workpiece into a deterministic frame.">
                  <strong>SEQUENCE TIME</strong><i>↓</i><span>CAMERA</span><span>SPINDLE</span><span>TURRET</span><span>TAILSTOCK</span><span>COOLANT</span><span>WORKPIECE</span><i>↓</i><strong>DETERMINISTIC FRAME</strong>
                </div>
                <p className="engineering-note">
                  Reverse scrolling does not run a second reverse animation. The scene
                  reconciles the canonical time, including transforms, camera path, coolant and
                  the raw/finished workpiece state.
                </p>
              </div>
            </article>

            <article className="engineering-topic engineering-topic--scroll" id="engineering-03">
              <div className="engineering-topic__heading">
                <p>03 / SCROLL SYSTEM</p>
                <h3>Document geometry sets the destination.</h3>
              </div>
              <div className="engineering-topic__body engineering-topic__body--split">
                <div>
                  <p>
                    Native document geometry remains the source of truth. Lenis smooths page
                    motion, while the CNC driver normalizes the cinematic section’s scroll
                    distance and eases toward that target before it seeks the timeline.
                  </p>
                  <div className="engineering-scroll-flow" role="img" aria-label="User input flows through Lenis to document scroll, normalized cinematic progress, frame-rate-independent damping, and the canonical timeline.">
                    <span>USER INPUT</span><i>↓</i><span>LENIS</span><i>↓</i><span>DOCUMENT SCROLL</span><i>↓</i><span>NORMALIZED PROGRESS</span><i>↓</i><span>DAMPED TIMELINE SEEK</span>
                  </div>
                </div>
                <aside className="engineering-code" aria-label="Simplified source excerpt from useCncScrollDriver">
                  <p>SIMPLIFIED FROM / useCncScrollDriver.ts</p>
                  <pre><code>{`const difference = targetProgress - currentProgress
const alpha = 1 - Math.exp(-CNC_SCROLL.responsiveness * deltaSeconds)

applyProgress(currentProgress + difference * alpha)`}</code></pre>
                  <span>DEFAULT PACING / 0.40×</span>
                </aside>
              </div>
            </article>

            <article className="engineering-topic engineering-topic--state" id="engineering-04">
              <div className="engineering-topic__heading">
                <p>04 / MACHINE STATE</p>
                <h3>One scene, with explicit ownership.</h3>
              </div>
              <div className="engineering-topic__body engineering-topic__body--split">
                <p>
                  The production render path contains one Canvas and one CNC GLB scene instance.
                  Four modes take ownership in turn, pausing or resetting the systems they do
                  not own before camera and machine input are transferred.
                </p>
                <div className="engineering-mode-map" role="img" aria-label="One CNC scene is used by content cinematic, operator, process comparison, and anatomy modes.">
                  <strong>ONE CNC SCENE</strong>
                  <div><span>CONTENT<br />CINEMATIC</span><span>OPERATOR</span><span>PROCESS<br />COMPARISON</span><span>ANATOMY</span></div>
                </div>
                <p className="engineering-note">
                  Exclusive ownership prevents competing camera transitions, simultaneous scroll
                  control, transform drift and conflicting effect states.
                </p>
              </div>
            </article>

            <article className="engineering-topic engineering-topic--effects" id="engineering-05">
              <div className="engineering-topic__heading">
                <p>05 / PROCEDURAL EFFECTS</p>
                <h3>Effects describe the process without simulating the factory.</h3>
              </div>
              <div className="engineering-topic__body engineering-topic__body--split">
                <div>
                  <p>
                    Coolant, mist and hot chips are lightweight real-time procedural effects.
                    Their visibility and intensity are reconciled against sequence time, not
                    left behind by a prior interaction.
                  </p>
                  <div className="engineering-contact-flow" role="img" aria-label="Tailstock contact starts a spark window, coolant begins, then sparks stop.">
                    <span>TAILSTOCK CONTACT</span><i>↓</i><span>SPARK WINDOW</span><i>↓</i><span>COOLANT ONSET</span><i>↓</i><span>SPARK STOP</span>
                  </div>
                  <p className="engineering-note">
                    The spark emitter is derived from Tailstock_Tip bounds and the tailstock-facing
                    surface of the active workpiece—an authored contact relationship, not a fixed
                    world coordinate.
                  </p>
                </div>
                <aside className="engineering-code" aria-label="Simplified source excerpt from useCncChoreography">
                  <p>SIMPLIFIED FROM / useCncChoreography.ts</p>
                  <pre><code>{`timeline.progress(clampedProgress)
reconcileSequenceState(timeline.time())

setSequenceState(clampedProgress === 1 ? 'complete' : 'paused')`}</code></pre>
                  <span>COOLANT / MIST / HOT CHIPS</span>
                </aside>
              </div>
            </article>

            <article className="engineering-topic engineering-topic--workpiece" id="engineering-06">
              <div className="engineering-topic__heading">
                <p>06 / MULTI-MODE INTERACTION</p>
                <h3>Two geometry states, one controlled reveal.</h3>
              </div>
              <div className="engineering-topic__body engineering-topic__body--split">
                <p>
                  The stock and finished components are separate GLB geometry states:
                  <b> Workpiece_Raw</b> and <b>Workpiece_Finished_Camshaft</b>. Cinematic and
                  operator flows swap them deterministically. Process Comparison temporarily
                  gives both compatible clipping planes for a controlled longitudinal reveal;
                  it is not a mesh-cutting simulation.
                </p>
                <div className="engineering-workpiece-flow" role="img" aria-label="Raw workpiece transitions through deterministic state or process comparison clipping to finished camshaft.">
                  <span>Workpiece_Raw</span><i>→</i><span>STATE / CLIPPING REVEAL</span><i>→</i><span>Workpiece_Finished_Camshaft</span>
                </div>
                <p className="engineering-closing">
                  Scope: 3D integration, interaction architecture, motion choreography,
                  procedural effects and frontend implementation.
                </p>
              </div>
            </article>
          </div>
        </div>
      </div>
    </section>
  )
}
