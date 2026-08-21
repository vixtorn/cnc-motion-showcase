import { useEffect, useState, type RefObject } from 'react'

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

interface UsePlaygroundRevealOptions {
  sectionRef: RefObject<HTMLElement | null>
  presentationRef: RefObject<HTMLElement | null>
}

/** Keeps the reveal in document geometry, updating only CSS properties per frame. */
export function usePlaygroundReveal({
  sectionRef,
  presentationRef,
}: UsePlaygroundRevealOptions) {
  const [isPresenting, setIsPresenting] = useState(false)
  const [interactionEnabled, setInteractionEnabled] = useState(false)

  useEffect(() => {
    const section = sectionRef.current
    const presentation = presentationRef.current
    if (!section || !presentation) return

    let frame = 0
    let previousPresenting = false
    let previousInteractionEnabled = false

    const update = () => {
      frame = 0
      const viewportHeight = Math.max(window.innerHeight, 1)
      const bounds = section.getBoundingClientRect()
      const revealDistance = viewportHeight * 0.62
      const reveal = clamp01((viewportHeight - bounds.top) / revealDistance)
      const presenting = bounds.top < viewportHeight && bounds.bottom > viewportHeight * 0.35
      const canInteract = presenting && reveal >= 0.75

      section.style.setProperty('--playground-reveal', reveal.toFixed(4))
      presentation.style.setProperty('--playground-reveal', reveal.toFixed(4))

      if (presenting !== previousPresenting) {
        previousPresenting = presenting
        setIsPresenting(presenting)
      }
      if (canInteract !== previousInteractionEnabled) {
        previousInteractionEnabled = canInteract
        setInteractionEnabled(canInteract)
      }
    }

    const scheduleUpdate = () => {
      if (!frame) frame = window.requestAnimationFrame(update)
    }

    update()
    window.addEventListener('scroll', scheduleUpdate, { passive: true })
    window.addEventListener('resize', scheduleUpdate)
    return () => {
      window.removeEventListener('scroll', scheduleUpdate)
      window.removeEventListener('resize', scheduleUpdate)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [presentationRef, sectionRef])

  return { isPresenting, interactionEnabled }
}
