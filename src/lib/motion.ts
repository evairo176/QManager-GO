import type { Variants, Transition } from "motion/react";

// =============================================================================
// QManager Motion System — the project's single source of truth for motion.
// =============================================================================
// Every animation in the app settles on the same curve, drawn from the same
// duration scale, so the whole product feels like one instrument. This is the
// reference layer: reach for these tokens before writing a bespoke transition,
// and add new shared motion here rather than re-deriving a curve locally.
//
// Character (per DESIGN.md): Apple instrument-class. Silky, exponential
// ease-out; never bouncy, never springy, never Material-pop. Motion conveys
// state — entrance, feedback, settle — not decoration.
//
// Reduced motion is handled globally by `<MotionConfig reducedMotion="user">`
// at the app root, so every motion/react component below automatically
// collapses transform/layout movement (keeping opacity) for users who ask for
// it. Variants here stay pure transform + opacity so that global switch is all
// that's ever needed.
// =============================================================================

// -----------------------------------------------------------------------------
// Easing
// -----------------------------------------------------------------------------

/**
 * The reference curve. ease-out-expo: a fast departure and a long, gentle
 * settle that never overshoots — the feel of a Control Center toggle or a
 * macOS window coming to rest. Default to this for any state change.
 */
export const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

/**
 * A slightly gentler tail for short, frequent moves (button presses, small
 * swaps, exits) where the long expo settle would feel sluggish.
 */
export const EASE_OUT_QUART = [0.25, 1, 0.5, 1] as const;

/** CSS-string equivalents for Tailwind arbitrary values and plain transitions. */
export const EASE_OUT_EXPO_CSS = "cubic-bezier(0.16, 1, 0.3, 1)";
export const EASE_OUT_QUART_CSS = "cubic-bezier(0.25, 1, 0.5, 1)";

// -----------------------------------------------------------------------------
// Duration scale (seconds)
// -----------------------------------------------------------------------------

/**
 * Product motion lives between 150ms and 500ms. These four steps are the only
 * durations the system should use; anything slower reads as choreography the
 * user has to wait through, anything faster reads as a snap.
 */
export const DUR = {
  /** Presses, micro-feedback, live value swaps. */
  fast: 0.16,
  /** Most state transitions: hover, color shifts, toggles. */
  base: 0.24,
  /** Entrances and the page-content rise. */
  slow: 0.34,
  /** Determinate fills and the circular signal-meter arc. */
  slower: 0.5,
} as const;

// -----------------------------------------------------------------------------
// Prebuilt transitions
// -----------------------------------------------------------------------------

/** The everyday transition: reference curve at the base duration. */
export const transitionBase: Transition = {
  duration: DUR.base,
  ease: EASE_OUT_EXPO,
};

/** The entrance transition: reference curve at the slow duration. */
export const transitionSlow: Transition = {
  duration: DUR.slow,
  ease: EASE_OUT_EXPO,
};

// -----------------------------------------------------------------------------
// Variants
// -----------------------------------------------------------------------------

/**
 * Stagger container — the parent of a card's content groups or a list. Children
 * settle in sequence at a calm cadence. Pair with `itemVariants` on each child.
 */
export const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.045, delayChildren: 0.02 },
  },
};

/**
 * Fade-up entrance — content lifts 10px into place on the GSAP reference curve
 * with subtle optical deblur.
 */
export const itemVariants: Variants = {
  hidden: { opacity: 0, y: 10, filter: "blur(2px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: DUR.slow, ease: EASE_OUT_EXPO },
  },
};

/**
 * Route transition — smooth upward glide with subtle deblur on entrance
 * and quick fade on departure (mode="wait").
 */
export const pageVariants: Variants = {
  hidden: { opacity: 0, y: 12, filter: "blur(4px)" },
  enter: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: DUR.slow, ease: EASE_OUT_EXPO },
  },
  exit: {
    opacity: 0,
    y: -6,
    filter: "blur(2px)",
    transition: { duration: 0.14, ease: EASE_OUT_QUART },
  },
};
