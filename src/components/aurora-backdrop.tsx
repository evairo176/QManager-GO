"use client";

import React from "react";

// =============================================================================
// AuroraBackdrop — animated aurora gradient field for auth/onboarding views.
// =============================================================================
// GSAP-web style "living gradient": three oversized blurred blobs drifting on
// independent easing curves, over a subtle dot-grid + vignette. Pure CSS
// keyframes (cheap on the modem's browser), respects reduced motion.
// =============================================================================

export function AuroraBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      {/* Base wash */}
      <div className="absolute inset-0 bg-background" />

      {/* Drifting blobs */}
      <div className="absolute -top-48 -left-32 h-[36rem] w-[36rem] rounded-full bg-primary/25 blur-3xl animate-aurora-1 will-change-transform" />
      <div className="absolute -bottom-56 -right-24 h-[40rem] w-[40rem] rounded-full bg-blue-500/20 blur-3xl animate-aurora-2 will-change-transform" />
      <div className="absolute top-1/3 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-purple-500/15 blur-3xl animate-aurora-3 will-change-transform" />

      {/* Dot grid texture */}
      <div
        className="absolute inset-0 opacity-[0.35] dark:opacity-25"
        style={{
          backgroundImage:
            "radial-gradient(circle, oklch(0.5 0.1 264 / 0.18) 1px, transparent 1px)",
          backgroundSize: "26px 26px",
        }}
      />

      {/* Bottom vignette */}
      <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-background/80 to-transparent" />
    </div>
  );
}