"use client";

import { useCallback, useId } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import type { UseTtlSettingsReturn } from "@/hooks/use-ttl-settings";

// =============================================================================
// BypassHotspotRow — Hotspot-bypass shortcut for the Traffic Engine panels
// =============================================================================
// A friendly one-tap alias over the global TTL/HL state: enabling pins both
// the IPv4 TTL and the IPv6 hop-limit to 64 on egress (rmnet+), which masks the
// per-hop decrement carriers use to detect tethering. It reuses the existing
// TTL/HL machinery — no new backend.
//
// PRESENTATIONAL. The `useTtlSettings` instance lives in the composer
// (`TrafficEngine`), which persists across tab switches, so the row never
// remounts/refetches when you flip Video <-> Masquerade and its first load is
// covered by the page's single skeleton (spinner here only ever means "saving").
//
// The same canonical file (`/etc/firewall.user.ttl`) is written by the
// standalone TTL page AND by Custom SIM Profile apply, so the global value we
// read already reflects a profile-set TTL. We can't tell WHO set it, only the
// value — so ownership is value-based:
//
//   TTL/HL = 0/0      -> OFF, interactive   -> toggle on  => saveTtlHl(64, 64)
//   TTL/HL = 64/64    -> ON,  interactive   -> toggle off => saveTtlHl(0, 0)
//   TTL/HL = other    -> ON,  DISABLED      (external owner: TTL page / profile)
//
// Rendered identically beneath the enable switch in both mode panels. Mirrors
// EngineEnableRow's markup + micro-states exactly so the two adjacent switch
// rows in one card never read as inconsistent.
// =============================================================================

const BYPASS_TTL = 64;
const BYPASS_HL = 64;

interface BypassHotspotRowProps {
  /** The composer-owned TTL/HL hook (shared global state). */
  ttl: UseTtlSettingsReturn;
}

export function BypassHotspotRow({ ttl }: BypassHotspotRowProps) {
  const { t } = useTranslation("local-network");
  const { data, isLoading, isSaving, saveTtlHl } = ttl;
  const helperId = useId();

  const active = data?.isEnabled ?? false;
  const ttlValue = data?.ttl ?? 0;
  const hlValue = data?.hl ?? 0;
  const isBypassValues = ttlValue === BYPASS_TTL && hlValue === BYPASS_HL;

  // Switch reads ON whenever TTL/HL is active (bypass effectively in force),
  // regardless of who set it. It's only interactive when idle or bypass-owned.
  const checked = active;
  const externallyOwned = active && !isBypassValues;
  // isLoading is covered by the page skeleton (hook lives in the composer), so
  // in practice this spinner only shows while a user-initiated save is in
  // flight — which is the correct "your toggle landed" feedback.
  const busy = isLoading || isSaving;
  const disabled = busy || externallyOwned;

  const handleToggle = useCallback(
    async (next: boolean) => {
      const ok = next
        ? await saveTtlHl(BYPASS_TTL, BYPASS_HL)
        : await saveTtlHl(0, 0);
      if (ok) {
        toast.success(
          next
            ? t("traffic_engine.bypass_toast_enabled")
            : t("traffic_engine.bypass_toast_disabled"),
        );
      } else {
        toast.error(t("traffic_engine.bypass_toast_error"));
      }
    },
    [saveTtlHl, t],
  );

  const helper = externallyOwned
    ? t("traffic_engine.bypass_helper_external", { ttl: ttlValue, hl: hlValue })
    : active
      ? t("traffic_engine.bypass_helper_active")
      : t("traffic_engine.bypass_helper_idle");

  return (
    <div className="flex items-center justify-between gap-4 border-t pt-5">
      <div className="min-w-0 space-y-0.5">
        <p className="text-sm font-medium text-foreground">
          {t("traffic_engine.bypass_label")}
        </p>
        <p id={helperId} className="text-xs text-muted-foreground">
          {helper}
        </p>
      </div>
      <div className="flex items-center gap-2.5">
        {/* Spinner stands in for the on/off label while a save is in flight —
            the disabled Switch alone reads as "did my click land?". Matches
            EngineEnableRow exactly so the two rows behave identically. */}
        {busy ? (
          <Loader2
            className="size-4 animate-spin text-muted-foreground"
            aria-hidden="true"
          />
        ) : (
          checked && (
            <span className="text-sm font-medium text-foreground">
              {t("traffic_engine.bypass_state_on")}
            </span>
          )
        )}
        <Switch
          checked={checked}
          disabled={disabled}
          onCheckedChange={handleToggle}
          aria-label={t("traffic_engine.bypass_aria")}
          aria-describedby={helperId}
        />
      </div>
    </div>
  );
}
