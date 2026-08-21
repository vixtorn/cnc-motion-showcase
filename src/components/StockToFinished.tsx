interface StockToFinishedProps {
  ready: boolean
  onEnter: () => void
}

export function StockToFinished({ ready, onEnter }: StockToFinishedProps) {
  return (
    <section className="stock-finished" aria-labelledby="stock-finished-title">
      <div className="stock-finished__frame">
        <header className="stock-finished__header">
          <p>04 / PROCESS</p>
          <p>ONE WORKPIECE / TWO MANUFACTURING STATES</p>
        </header>

        <div className="stock-finished__body">
          <div>
            <h2 id="stock-finished-title">
              <span>From stock</span>
              <span>to finished</span>
            </h2>
          </div>

          <div className="stock-finished__action">
            <p>
              Compare the cylindrical starting stock with the finished camshaft
              geometry.
            </p>
            <span>GEOMETRY STATE REVEAL / USER CONTROLLED</span>
            <button type="button" disabled={!ready} onClick={onEnter}>
              {ready ? '[ COMPARE MATERIAL STATES ]' : '[ INITIALIZING MACHINE ]'}
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
