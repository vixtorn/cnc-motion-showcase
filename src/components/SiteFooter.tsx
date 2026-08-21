interface SiteFooterProps {
  onBackToTop: () => void
}

export function SiteFooter({ onBackToTop }: SiteFooterProps) {
  return (
    <footer className="site-footer">
      <div className="site-footer__identity">
        <p>DUMAN / CNC 01</p>
        <h2>Interactive manufacturing study</h2>
      </div>
      <p className="site-footer__stack">BLENDER / R3F / THREE.JS / GSAP / LENIS</p>
      <div className="site-footer__actions">
        <a href="https://github.com/vixtorn/cnc-motion-showcase" target="_blank" rel="noreferrer">
          GITHUB ↗
        </a>
        <button type="button" onClick={onBackToTop}>BACK TO TOP ↑</button>
      </div>
      <p className="site-footer__meta">2026 / INTERACTIVE WEBGL STUDY</p>
    </footer>
  )
}
