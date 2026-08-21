import { useEffect, useRef } from 'react'
import { prefersReducedMotion } from '../animation/motionPreferences'

export const CNC_SCROLL = {
  baseViewportHeights: 8,
  defaultPacing: 0.4,
  minimumPacing: 0.25,
  maximumPacing: 1,
  pacingStep: 0.05,
  responsiveness: 10,
  convergenceEpsilon: 0.0001,
  endpointEpsilon: 0.0001,
  diagnosticsIntervalMs: 100,
} as const

export const getCinematicViewportHeights = (pacing: number) => {
  const clampedPacing = Math.min(
    CNC_SCROLL.maximumPacing,
    Math.max(CNC_SCROLL.minimumPacing, pacing),
  )
  const baseScrollTravel = CNC_SCROLL.baseViewportHeights - 1

  return 1 + baseScrollTravel / clampedPacing
}

export interface CncScrollDiagnostics {
  raw: number
  target: number
  sequence: number
}

interface UseCncScrollDriverOptions {
  containerRef: React.RefObject<HTMLElement | null>
  enabled: boolean
  onProgress: (progress: number) => void
  onDiagnostics?: (diagnostics: CncScrollDiagnostics) => void
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

const snapEndpoint = (progress: number) => {
  if (progress <= CNC_SCROLL.endpointEpsilon) return 0
  if (progress >= 1 - CNC_SCROLL.endpointEpsilon) return 1
  return progress
}

export function useCncScrollDriver({
  containerRef,
  enabled,
  onProgress,
  onDiagnostics,
}: UseCncScrollDriverOptions) {
  const onProgressRef = useRef(onProgress)
  const onDiagnosticsRef = useRef(onDiagnostics)

  useEffect(() => {
    onProgressRef.current = onProgress
    onDiagnosticsRef.current = onDiagnostics
  }, [onDiagnostics, onProgress])

  useEffect(() => {
    const section = containerRef.current
    if (!enabled || !section) return

    let rawProgress = 0
    let targetProgress = 0
    let currentProgress = 0
    let animationFrame = 0
    let lastFrameTime = 0
    let lastDiagnosticsTime = -Infinity
    const reduceMotion = prefersReducedMotion()

    const publishDiagnostics = (timestamp: number, force = false) => {
      if (
        !onDiagnosticsRef.current ||
        (!force && timestamp - lastDiagnosticsTime < CNC_SCROLL.diagnosticsIntervalMs)
      ) {
        return
      }

      lastDiagnosticsTime = timestamp
      onDiagnosticsRef.current({
        raw: rawProgress,
        target: targetProgress,
        sequence: currentProgress,
      })
    }

    const applyProgress = (progress: number) => {
      currentProgress = progress
      onProgressRef.current(progress)
    }

    const runFrame = (timestamp: number) => {
      animationFrame = 0
      const deltaSeconds = Math.min(Math.max((timestamp - lastFrameTime) / 1000, 0), 0.1)
      lastFrameTime = timestamp
      const difference = targetProgress - currentProgress

      if (reduceMotion || Math.abs(difference) <= CNC_SCROLL.convergenceEpsilon) {
        applyProgress(targetProgress)
        publishDiagnostics(timestamp, true)
        return
      }

      const alpha = 1 - Math.exp(-CNC_SCROLL.responsiveness * deltaSeconds)
      applyProgress(currentProgress + difference * alpha)
      publishDiagnostics(timestamp)
      animationFrame = window.requestAnimationFrame(runFrame)
    }

    const ensureAnimationFrame = () => {
      if (animationFrame) return
      lastFrameTime = performance.now()
      animationFrame = window.requestAnimationFrame(runFrame)
    }

    const measureTarget = () => {
      const sectionStart = section.getBoundingClientRect().top + window.scrollY
      const viewportHeight = window.innerHeight
      const scrollDistance = Math.max(section.offsetHeight - viewportHeight, 1)
      rawProgress = clamp01((window.scrollY - sectionStart) / scrollDistance)
      targetProgress = snapEndpoint(rawProgress)

      if (reduceMotion) {
        applyProgress(targetProgress)
        publishDiagnostics(performance.now(), true)
        return
      }

      ensureAnimationFrame()
    }

    const syncInitialProgress = () => {
      const sectionStart = section.getBoundingClientRect().top + window.scrollY
      const viewportHeight = window.innerHeight
      const scrollDistance = Math.max(section.offsetHeight - viewportHeight, 1)
      rawProgress = clamp01((window.scrollY - sectionStart) / scrollDistance)
      targetProgress = snapEndpoint(rawProgress)
      applyProgress(targetProgress)
      publishDiagnostics(performance.now(), true)
    }

    syncInitialProgress()
    window.addEventListener('scroll', measureTarget, { passive: true })
    window.addEventListener('resize', measureTarget, { passive: true })
    window.addEventListener('pageshow', measureTarget)

    return () => {
      window.removeEventListener('scroll', measureTarget)
      window.removeEventListener('resize', measureTarget)
      window.removeEventListener('pageshow', measureTarget)
      if (animationFrame) window.cancelAnimationFrame(animationFrame)
    }
  }, [containerRef, enabled])
}
