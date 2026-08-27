"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { authFetch } from "@/lib/auth-fetch";
import { resolveErrorMessage } from "@/lib/i18n/resolve-error";
import type {
  SystemSettings,
  ScheduleConfig,
  LowPowerConfig,
  SystemSettingsResponse,
} from "@/types/system-settings";

// =============================================================================
// useSystemSettings — Fetch & Save Hook for System Settings
// =============================================================================
// Fetches all system settings on mount (preferences + schedules).
// Provides separate save functions for each settings group.
//
// Backend: GET/POST /cgi-bin/quecmanager/system/settings.sh
// =============================================================================

const CGI_ENDPOINT = "/cgi-bin/quecmanager/system/settings.sh";

// ─── Save Payload Types ───────────────────────────────────────────────────

export interface SaveSettingsPayload {
  action: "save_settings";
  force_tailscale_fixes?: boolean;
  hostname?: string;
  temp_unit?: "celsius" | "fahrenheit";
  distance_unit?: "km" | "miles";
  timezone?: string;
  zonename?: string;
}

export interface SaveScheduledRebootPayload {
  action: "save_scheduled_reboot";
  enabled: boolean;
  time: string;
  days: number[];
}

export interface SaveLowPowerPayload {
  action: "save_low_power";
  enabled: boolean;
  start_time: string;
  end_time: string;
  days: number[];
}

export interface UseSystemSettingsReturn {
  settings: SystemSettings | null;
  scheduledReboot: ScheduleConfig | null;
  lowPower: LowPowerConfig | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  saveSettings: (payload: SaveSettingsPayload) => Promise<boolean>;
  saveScheduledReboot: (payload: SaveScheduledRebootPayload) => Promise<boolean>;
  saveLowPower: (payload: SaveLowPowerPayload) => Promise<boolean>;
  refresh: () => void;
}

// ─── Hook ──────────────────────────────────────────────────────────────────

export function useSystemSettings(): UseSystemSettingsReturn {
  const { t } = useTranslation("errors");
  const [isSaving, setIsSaving] = useState(false);

  const query = useQuery<SystemSettingsResponse>({
    queryKey: ["system-settings"],
    queryFn: async () => {
      const resp = await authFetch(CGI_ENDPOINT);
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      }
      return resp.json();
    },
  });

  const json = query.data;

  const error = query.error
    ? query.error instanceof Error
      ? query.error.message
      : "Failed to fetch system settings"
    : json && !json.success
      ? "Failed to fetch system settings"
      : null;

  // ─── Save (generic POST helper) ──────────────────────────────────────────

  const saveMutation = useMutation({
    mutationFn: async (
      payload:
        | SaveSettingsPayload
        | SaveScheduledRebootPayload
        | SaveLowPowerPayload,
    ): Promise<boolean> => {
      const resp = await authFetch(CGI_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      }

      const body = await resp.json();
      if (!body.success) {
        throw new Error(
          resolveErrorMessage(t, body.error, body.detail, "Failed to save settings"),
        );
      }
      return true;
    },
    onSuccess: () => {
      // Silent re-fetch to sync all state
      void query.refetch();
    },
  });

  const postAction = async (
    payload:
      | SaveSettingsPayload
      | SaveScheduledRebootPayload
      | SaveLowPowerPayload,
  ): Promise<boolean> => {
    setIsSaving(true);
    try {
      return await saveMutation.mutateAsync(payload);
    } catch {
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const saveSettings = (payload: SaveSettingsPayload) => postAction(payload);
  const saveScheduledReboot = (payload: SaveScheduledRebootPayload) =>
    postAction(payload);
  const saveLowPower = (payload: SaveLowPowerPayload) => postAction(payload);

  return {
    settings: json?.success ? json.settings : null,
    scheduledReboot: json?.success ? json.scheduled_reboot : null,
    lowPower: json?.success ? json.low_power : null,
    isLoading: query.isLoading || query.isPending,
    isSaving,
    error,
    saveSettings,
    saveScheduledReboot,
    saveLowPower,
    refresh: () => {
      void query.refetch();
    },
  };
}

// =============================================================================
// useUnitPreferences — Lightweight hook for dashboard unit display
// =============================================================================
// Fetches unit preferences on mount. Used by device-metrics.tsx to display
// temperature in °F and distance in miles when configured.
// =============================================================================

interface UnitPreferences {
  tempUnit: "celsius" | "fahrenheit";
  distanceUnit: "km" | "miles";
}

export function useUnitPreferences(): UnitPreferences | null {
  const query = useQuery<SystemSettingsResponse | null>({
    queryKey: ["system-settings", "unit-preferences"],
    queryFn: async () => {
      // Plain fetch, NOT authFetch: this is a best-effort display-preference read
      // that also runs on the public Overview splash ("/"), where the visitor is
      // logged out and this endpoint returns 401. authFetch turns any 401 into a
      // global `window.location = "/login/"` redirect — which would bounce the
      // public splash straight to the login form the instant it mounts. A display
      // preference must never drive session-loss routing. Cookies still ride along
      // (same-origin default credentials), so the logged-in dashboard keeps
      // getting the user's real °F/miles prefs; logged-out simply falls through to
      // the celsius/km defaults below.
      const resp = await fetch(CGI_ENDPOINT, { cache: "no-store" });
      if (!resp.ok) return null;
      return resp.json();
    },
    staleTime: Infinity,
  });

  const json = query.data;
  if (json?.success && json.settings) {
    return {
      tempUnit: json.settings.temp_unit || "celsius",
      distanceUnit: json.settings.distance_unit || "km",
    };
  }
  return null;
}
