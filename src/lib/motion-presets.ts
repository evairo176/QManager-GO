// =============================================================================
// motion-presets.ts — friendly aliases over the canonical motion system
// =============================================================================
// `lib/motion.ts` is the single source of truth for motion in QManager: every
// curve and duration is defined there on the EASE_OUT_EXPO / DUR tokens. This
// module only re-exports the shared stagger variants under the names some
// surfaces prefer (`staggerContainer` / `staggerItem`). It deliberately does
// NOT re-derive any easing curve or duration — change motion in `lib/motion.ts`
// and the whole app, including these aliases, retunes at once.
//
// Both variants expose the `hidden` / `visible` keys, so consumers drive them
// with `initial="hidden" animate="visible"`.
// =============================================================================

export {
  containerVariants as staggerContainer,
  itemVariants as staggerItem,
} from "./motion";
