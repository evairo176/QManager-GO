"use client";

import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";

interface EngineEnableRowProps {
  /** Localized "Enable {mode}" label. */
  label: string;
  /** Whether THIS mode currently owns the engine. */
  running: boolean;
  /** False when the binary or kernel module is missing. */
  canEnable: boolean;
  /** True while a save is in flight. */
  busy: boolean;
  /** True when the OTHER mode owns the engine (enabling will take over). */
  otherOwns: boolean;
  /** Other mode's display name, for the takeover hint. */
  otherModeLabel: string;
  onToggle: (next: boolean) => void;
  ariaLabel: string;
}

/**
 * The single enable affordance shared by both mode panels. The Switch reflects
 * whether THIS mode is running; flipping it on while the other mode owns the
 * engine routes through the composer's takeover-confirm dialog. Identical markup
 * on both panels keeps the two surfaces from drifting.
 */
export function EngineEnableRow({
  label,
  running,
  canEnable,
  busy,
  otherOwns,
  otherModeLabel,
  onToggle,
  ariaLabel,
}: EngineEnableRowProps) {
  const { t } = useTranslation("local-network");

  // Keep a description in every state. While running, surface the mutex
  // relationship so the "enabling this stops the other mode" context never
  // vanishes the moment the engine turns on.
  const helper = running
    ? t("traffic_engine.hero_running_prompt", { mode: otherModeLabel })
    : otherOwns
      ? t("traffic_engine.hero_takeover_prompt", { mode: otherModeLabel })
      : t("traffic_engine.hero_idle_prompt");

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0 space-y-0.5">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {helper && (
          <p className="text-xs text-muted-foreground">{helper}</p>
        )}
      </div>
      <div className="flex items-center gap-2.5">
        {/* While a toggle is in flight the spinner stands in for the on/off
            label — the disabled Switch alone reads as "did my click land?". */}
        {busy ? (
          <Loader2
            className="size-4 animate-spin text-muted-foreground"
            aria-hidden="true"
          />
        ) : (
          running && (
            <span className="text-sm font-medium text-foreground">
              {t("traffic_engine.hero_toggle_on")}
            </span>
          )
        )}
        <Switch
          checked={running}
          disabled={!canEnable || busy}
          onCheckedChange={onToggle}
          aria-label={ariaLabel}
        />
      </div>
    </div>
  );
}
