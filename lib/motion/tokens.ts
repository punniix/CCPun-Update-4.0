export const MOTION = {
  duration: { instant: 0.12, micro: 0.18, reveal: 0.32, explain: 0.65 },
  stagger: { compact: 0.04, standard: 0.064 },
  distance: { micro: 4, reveal: 12 },
  easing: {
    standard: [0.2, 0.8, 0.2, 1] as [number, number, number, number],
    emphasized: [0.16, 1, 0.3, 1] as [number, number, number, number],
  },
} as const;
