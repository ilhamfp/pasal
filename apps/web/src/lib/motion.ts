/**
 * Shared framer-motion constants used across landing page components.
 * Centralises repeated easing curves and transition presets.
 */

/** Standard ease-out curve used for fade/slide reveals. */
export const EASE_OUT = [0.25, 0.1, 0.25, 1] as const;

/** Fade-up variant pair for staggered children. */
export const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: EASE_OUT },
  },
};

/** Parent variant that staggers its children. */
export const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12 } },
};
