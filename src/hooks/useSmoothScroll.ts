import Lenis from 'lenis'
import 'lenis/dist/lenis.css'
import { useCallback, useEffect, useRef, useState } from 'react'
import { prefersReducedMotion } from '../animation/motionPreferences'

interface UseSmoothScrollOptions {
  enabled: boolean
  suspended: boolean
}

export interface SmoothScrollController {
  isActive: boolean
  isReducedMotion: boolean
  scrollToImmediate: (top: number) => void
}

/**
 * Owns the single document-level Lenis instance. CNC progress continues to be
 * derived independently from the browser's actual scroll position.
 */
export function useSmoothScroll({
  enabled,
  suspended,
}: UseSmoothScrollOptions): SmoothScrollController {
  const lenisRef = useRef<Lenis | null>(null)
  const suspendedRef = useRef(suspended)
  const [isReducedMotion, setIsReducedMotion] = useState(prefersReducedMotion)

  useEffect(() => {
    suspendedRef.current = suspended
  }, [suspended])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updatePreference = () => setIsReducedMotion(prefersReducedMotion())

    mediaQuery.addEventListener('change', updatePreference)
    return () => mediaQuery.removeEventListener('change', updatePreference)
  }, [])

  useEffect(() => {
    if (!enabled || isReducedMotion) return

    const lenis = new Lenis({
      autoRaf: true,
      smoothWheel: true,
      syncTouch: false,
      lerp: 0.1,
      anchors: true,
      respectReducedMotion: true,
    })

    lenisRef.current = lenis
    if (suspendedRef.current) lenis.stop()

    return () => {
      if (lenisRef.current === lenis) lenisRef.current = null
      lenis.destroy()
    }
  }, [enabled, isReducedMotion])

  useEffect(() => {
    const lenis = lenisRef.current
    if (!lenis) return

    if (suspended) {
      lenis.stop()
    } else {
      lenis.start()
    }
  }, [suspended])

  const scrollToImmediate = useCallback((top: number) => {
    const lenis = lenisRef.current
    if (lenis) {
      lenis.scrollTo(top, { immediate: true, force: true })
      return
    }

    window.scrollTo({ top, behavior: 'auto' })
  }, [])

  return {
    isActive: enabled && !isReducedMotion && !suspended,
    isReducedMotion,
    scrollToImmediate,
  }
}
