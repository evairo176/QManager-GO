"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTranslation, Trans } from "react-i18next";
import { toast } from "sonner";
import { authFetch } from "@/lib/auth-fetch";
import { useModemStatus } from "@/hooks/use-modem-status";

const CGI_ENDPOINT = "/cgi-bin/quecmanager/monitoring/watchdog.sh";
// Stable id so repeated status polls update the same toast instead of stacking.
const TOAST_ID = "sim-swap-detected";

// Surfaces the watchdog's "New SIM card detected" signal as a Sonner toast
// (bottom-right) instead of an inline banner. Renders nothing — it only fires
// the toast as a side effect when the modem reports a swap. Apply is the primary
// action (jumps to Custom Profiles); Dismiss clears the flag on the device.
export function SimSwapBanner() {
  const { t } = useTranslation("monitoring");
  const { data: modemStatus } = useModemStatus();
  const router = useRouter();
  // Signature of the swap we've already surfaced, so the toast fires once per
  // distinct detection rather than on every status poll. Reset when it clears.
  const shownKeyRef = useRef<string | null>(null);

  const dismissSwap = useCallback(async () => {
    try {
      await authFetch(CGI_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "dismiss_sim_swap" }),
      });
    } catch {
      // Silently fail — the next poll re-surfaces it if the flag is still set.
    }
  }, []);

  const simSwap = modemStatus?.sim_swap;
  const detected = !!simSwap?.detected;
  const matchingId = simSwap?.matching_profile_id ?? "";
  const matchingName = simSwap?.matching_profile_name ?? "";

  useEffect(() => {
    if (!detected) {
      // Detection cleared (dismissed / applied / resolved) — drop any lingering
      // toast and re-arm so a future swap fires again.
      if (shownKeyRef.current !== null) {
        toast.dismiss(TOAST_ID);
        shownKeyRef.current = null;
      }
      return;
    }

    const key = `${matchingId}|${matchingName}`;
    if (shownKeyRef.current === key) return; // already surfaced this swap
    shownKeyRef.current = key;

    const hasMatchingProfile = matchingId !== "";

    toast(t("watchdog.sim_swap_title"), {
      id: TOAST_ID,
      position: "bottom-right",
      duration: Infinity,
      description: hasMatchingProfile ? (
        <Trans
          i18nKey="watchdog.sim_swap_with_profile"
          ns="monitoring"
          values={{ profile_name: matchingName }}
          components={{ strong: <strong className="break-all font-medium" /> }}
        />
      ) : (
        t("watchdog.sim_swap_no_profile")
      ),
      action: hasMatchingProfile
        ? {
            label: t("watchdog.sim_swap_apply_button"),
            onClick: () => router.push("/cellular/custom-profiles"),
          }
        : undefined,
      cancel: {
        label: t("watchdog.sim_swap_dismiss_button"),
        onClick: () => {
          void dismissSwap();
        },
      },
    });
  }, [detected, matchingId, matchingName, t, router, dismissSwap]);

  return null;
}
