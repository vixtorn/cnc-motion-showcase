export function PostCinematicIntro() {
  return (
    <section
      className="project-introduction"
      aria-labelledby="project-introduction-title"
    >
      <div className="project-introduction__frame">
        <header className="project-introduction__header">
          <p>02 / SYSTEM STUDY</p>
          <p>DUMAN / CNC 01</p>
        </header>

        <div className="project-introduction__body">
          <h2 id="project-introduction-title">
            <span>The machine</span>
            <span>beyond the cycle</span>
          </h2>
          <p className="project-introduction__statement">
            Explore the process, mechanics and control systems behind the
            universal turning center.
          </p>
        </div>

        <footer className="project-introduction__footer">
          <p>PROCESS / MECHANICS / CONTROL</p>
          <div className="project-introduction__continuation" aria-hidden="true">
            <span>CONTINUE</span>
            <i />
          </div>
        </footer>
      </div>
    </section>
  )
}
