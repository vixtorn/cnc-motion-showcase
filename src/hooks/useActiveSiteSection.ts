import { useEffect, useState } from 'react'
import { SITE_SECTIONS, isSiteSectionId, type SiteSectionId } from '../config/siteSections'

const getInitialSection = (): SiteSectionId => {
  const hash = window.location.hash.slice(1)
  if (isSiteSectionId(hash)) return hash
  if (hash.startsWith('engineering-')) return 'engineering'
  return 'cycle'
}

export function useActiveSiteSection() {
  const [activeSectionId, setActiveSectionId] = useState<SiteSectionId>(getInitialSection)

  useEffect(() => {
    const sections = SITE_SECTIONS.map((section) => document.getElementById(section.id)).filter(
      (section): section is HTMLElement => Boolean(section),
    )
    if (!sections.length) return

    const resolveActiveSection = () => {
      const readingLine = window.innerHeight * 0.325
      const containingSection = sections.find((section) => {
        const { top, bottom } = section.getBoundingClientRect()
        return top <= readingLine && bottom >= readingLine
      })
      const upcomingSection = sections.find(
        (section) => section.getBoundingClientRect().top > readingLine,
      )
      const nextId =
        containingSection?.id ?? upcomingSection?.id ?? sections.at(-1)?.id ?? 'cycle'
      if (isSiteSectionId(nextId)) setActiveSectionId(nextId)
    }

    const observer = new IntersectionObserver(resolveActiveSection, {
      rootMargin: '-25% 0px -60% 0px',
      threshold: 0,
    })

    sections.forEach((section) => observer.observe(section))
    resolveActiveSection()
    return () => observer.disconnect()
  }, [])

  return activeSectionId
}
