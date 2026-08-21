export type RendererDpr = [number, number]

export const RENDER_QUALITY = {
  mobileBreakpoint: 700,
  desktopDpr: [1, 1.75] as RendererDpr,
  mobileDpr: [1, 1.25] as RendererDpr,
} as const

export function getRendererDprProfile(viewportWidth: number): RendererDpr {
  return viewportWidth <= RENDER_QUALITY.mobileBreakpoint
    ? RENDER_QUALITY.mobileDpr
    : RENDER_QUALITY.desktopDpr
}
