"use client";

import { ScanSearchIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

interface ScanningViewProps {
  elapsedSeconds: number;
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function ScanningView({ elapsedSeconds }: ScanningViewProps) {
  const { t } = useTranslation("cellular");

  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-label={t("cell_scanner.scanner.scanning_loading_aria")}
      className="flex flex-col items-center justify-center py-16 text-center gap-4"
    >
      {/* Animated icon — pulse is opacity-only (GPU composited, low power) */}
      <div className="relative flex items-center justify-center">
        <div className="absolute size-16 motion-safe:animate-pulse rounded-full bg-primary/10" />
        <div className="relative flex size-12 items-center justify-center rounded-full bg-primary/15">
          <ScanSearchIcon className="size-5 text-primary" />
        </div>
      </div>

      {/* Elapsed time */}
      <p
        className="text-2xl font-semibold tabular-nums tracking-tight text-foreground"
        role="timer"
        aria-live="off"
        aria-label={t("cell_scanner.scanner.scanning_elapsed_aria", { time: formatElapsed(elapsedSeconds) })}
      >
        {formatElapsed(elapsedSeconds)}
      </p>

      {/* Status copy */}
      <div className="max-w-xs space-y-1">
        <p className="text-sm font-medium text-foreground">
          {t("cell_scanner.scanner.scanning_title")}
        </p>
        <p className="text-xs text-muted-foreground">
          {t("cell_scanner.scanner.scanning_hint")}
        </p>
      </div>

      {/* Navigation warning */}
      <p className="text-xs text-muted-foreground/60">
        {t("cell_scanner.scanner.scanning_nav_warning")}
      </p>
    </div>
  );
}
