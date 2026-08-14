export const VISUAL_CALIBRATION = {
  background: '#d8d7d1',
  renderer: {
    dpr: [1, 1.75] as [number, number],
    toneMappingExposure: 0.95,
  },
  camera: {
    fov: 34,
    direction: [1.15, 0.62, 1.3] as [number, number, number],
    desktopDistanceScale: 0.8,
    mobileDistanceScale: 1.08,
    mobileAspectThreshold: 0.85,
    nearDistanceDivisor: 100,
    farRadiusMultiplier: 8,
  },
  environment: {
    resolution: 256,
    intensity: 0.9,
    hemisphereIntensity: 0.72,
    keyLightIntensity: 1.35,
    fillLightIntensity: 0.62,
    rimLightIntensity: 0.48,
    directionalLights: [
      { position: [5, 8, 7] as [number, number, number], color: '#fffdf5' },
      { position: [-6, 3, 4] as [number, number, number], color: '#ecece5' },
      { position: [1, 5, -7] as [number, number, number], color: '#f5f4ef' },
    ],
    softboxes: [
      {
        name: 'vertical-key',
        color: '#fffdf7',
        intensity: 5.2,
        position: [4, 1, 3] as [number, number, number],
        scale: [2.1, 5.5] as [number, number],
      },
      {
        name: 'vertical-contrast',
        color: '#9fa29c',
        intensity: 1.4,
        position: [-4, 0.5, 2] as [number, number, number],
        scale: [1.2, 4.5] as [number, number],
      },
      {
        name: 'overhead-fill',
        color: '#f2f1eb',
        intensity: 3.1,
        position: [0, 5, -1] as [number, number, number],
        scale: [4, 2] as [number, number],
      },
      {
        name: 'rear-strip',
        color: '#d7d9d4',
        intensity: 2.2,
        position: [0, 0, -5] as [number, number, number],
        scale: [3.5, 1.1] as [number, number],
      },
    ],
  },
  motionCalibration: {
    translationDistance: 12,
    translationDuration: 0.55,
    resetDuration: 0.45,
  },
}
