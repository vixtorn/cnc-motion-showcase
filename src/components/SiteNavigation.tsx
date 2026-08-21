import { useEffect, useState } from 'react'
import { SITE_SECTIONS, type SiteSectionId } from '../config/siteSections'

interface SiteNavigationProps {
  activeSectionId: SiteSectionId
  visible: boolean
  onNavigate: (id: SiteSectionId) => void
}

export function SiteNavigation({ activeSectionId, visible, onNavigate }: SiteNavigationProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const isEngineering = activeSectionId === 'engineering'

  useEffect(() => {
    if (!menuOpen) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [menuOpen])

  useEffect(() => {
    if (!visible) setMenuOpen(false)
  }, [visible])

  const handleNavigate = (id: SiteSectionId) => {
    setMenuOpen(false)
    onNavigate(id)
  }

  return (
    <nav
      className={`site-navigation${visible ? ' is-visible' : ''}${
        isEngineering ? ' is-on-dark' : ''
      }`}
      aria-label="Primary"
    >
      <div className="site-navigation__bar">
        <a
          className="site-navigation__brand"
          href="https://github.com/vixtorn/cnc-motion-showcase"
          target="_blank"
          rel="noreferrer"
          aria-label="Emir Duman on GitHub"
        >
          EMİR DUMAN
        </a>
        <div className="site-navigation__desktop-links">
          {SITE_SECTIONS.map((section) => (
            <button
              key={section.id}
              type="button"
              className={activeSectionId === section.id ? 'is-active' : undefined}
              aria-current={activeSectionId === section.id ? 'location' : undefined}
              onClick={() => handleNavigate(section.id)}
            >
              <span>{section.number}</span>{section.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="site-navigation__menu-toggle"
          aria-expanded={menuOpen}
          aria-controls="site-navigation-mobile-menu"
          onClick={() => setMenuOpen((open) => !open)}
        >
          [ INDEX ]
        </button>
      </div>
      <div
        id="site-navigation-mobile-menu"
        className={`site-navigation__mobile-menu${menuOpen ? ' is-open' : ''}`}
      >
        {SITE_SECTIONS.map((section) => (
          <button
            key={section.id}
            type="button"
            className={activeSectionId === section.id ? 'is-active' : undefined}
            aria-current={activeSectionId === section.id ? 'location' : undefined}
            onClick={() => handleNavigate(section.id)}
          >
            <span>{section.number}</span>{section.label}
          </button>
        ))}
      </div>
    </nav>
  )
}
