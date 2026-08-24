"use client";

import { motion } from "motion/react";
import { useTranslation } from "react-i18next";

// =============================================================================
// StepWelcome — Onboarding step 1: brand intro, staggered entrance
// =============================================================================

const STAGGER = 0.09;
const EASE = [0.25, 1, 0.5, 1] as const;

function fadeUp(i: number) {
  return {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.38, delay: i * STAGGER, ease: EASE },
  };
}

export function StepWelcome() {
  const { t } = useTranslation("onboarding");
  return (
    <div className="flex flex-col gap-7">
      {/* Brand lockup */}
      <motion.div {...fadeUp(0)} className="flex items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 p-1.5">
          <img
            src="/qmanager-logo.svg"
            alt=""
            aria-hidden="true"
            className="size-full"
          />
        </div>
        <span className="text-sm font-semibold tracking-tight text-muted-foreground">
          QManager
        </span>
      </motion.div>

      {/* Main message */}
      <motion.div {...fadeUp(1)} className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold tracking-tight leading-tight whitespace-pre-line">
          {t("welcome.main_title")}
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {t("welcome.subtitle")}
        </p>
      </motion.div>

      {/* Step preview */}
      <motion.div
        {...fadeUp(2)}
        className="flex flex-col gap-1.5 border-l-2 border-border pl-4"
      >
        <StepPreviewItem label={t("welcome.step_preview_password")} required />
        <StepPreviewItem label={t("welcome.step_preview_network_mode")} />
        <StepPreviewItem label={t("welcome.step_preview_apn_sim")} />
        <StepPreviewItem label={t("welcome.step_preview_band_preferences")} />
      </motion.div>
    </div>
  );
}

function StepPreviewItem({
  label,
  required,
}: {
  label: string;
  required?: boolean;
}) {
  const { t } = useTranslation("onboarding");
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <span className="size-1.5 rounded-full bg-muted-foreground/40 shrink-0" />
      <span>{label}</span>
      {required && (
        <span className="text-xs font-medium text-foreground">{t("shell.label_required")}</span>
      )}
    </div>
  );
}
