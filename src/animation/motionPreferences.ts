export const prefersReducedMotion = () => {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
    (import.meta.env.DEV && new URLSearchParams(window.location.search).has('reduce-motion'))
  )
}
