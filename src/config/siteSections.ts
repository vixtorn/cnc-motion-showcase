export const SITE_NAVIGATION_HEIGHT_PX = 52

export const SITE_SECTIONS = [
  { id: 'cycle', number: '01', label: 'CYCLE', title: 'The Cycle' },
  { id: 'system', number: '02', label: 'SYSTEM', title: 'System Study' },
  { id: 'operator', number: '03', label: 'OPERATE', title: 'Run the Machine' },
  { id: 'process', number: '04', label: 'PROCESS', title: 'From Stock to Finished' },
  { id: 'anatomy', number: '05', label: 'ANATOMY', title: 'Machine Anatomy' },
  { id: 'engineering', number: '06', label: 'ENGINEERING', title: 'Engineering the Experience' },
] as const

export type SiteSectionId = (typeof SITE_SECTIONS)[number]['id']

export const isSiteSectionId = (value: string): value is SiteSectionId =>
  SITE_SECTIONS.some((section) => section.id === value)
