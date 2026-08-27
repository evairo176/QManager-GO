"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { authFetch } from "@/lib/auth-fetch";
import { resolveErrorMessage } from "@/lib/i18n/resolve-error";
import type {
  CellularSettings,
  AmbrData,
  CellularSettingsResponse,
  CellularSettingsApplyResponse,
} from "@/types/cellular-settings";

// =============================================================================
// useCellularSettings — One-Shot Settings + AMBR Fetch & Save Hook
// =============================================================================
// Fetches current cellular settings and AMBR data on mount.
// Provides a saveSettings function for applying changes via POST.
//
// The CGI endpoint queries the modem via qcmd (6 AT commands), so the
// initial fetch may take a few seconds.
//
// Usage:
//   const { settings, ambr, isLoading, isSaving, error, saveSettings, refresh }
//     = useCellularSettings();
//
// Backend endpoint:
//   GET/POST /cgi-bin/quecmanager/cellular/settings.sh
// =============================================================================

const CGI_ENDPOINT = "/cgi-bin/quecmanager/cellular/settings.sh";

export interface UseCellularSettingsReturn {
  /** Current modem settings (null before first fetch) */
  settings: CellularSettings | null;
  /** AMBR data (null before first fetch) */
  ambr: AmbrData | null;
  /** True while initial fetch is in progress */
  isLoading: boolean;
  /** True while a save operation is in progress */
  isSaving: boolean;
  /** Error message if fetch or save failed */
  error: string | null;
  /** Apply settings changes to the modem. Returns true on full success. */
  saveSettings: (changes: Partial<CellularSettings>) => Promise<boolean>;
  /** Re-fetch all settings from the modem */
  refresh: () => void;
}

export function useCellularSettings(): UseCellularSettingsReturn {
  const { t } = useTranslation("errors");

  const query = useQuery<CellularSettingsResponse>({
    queryKey: ["cellular-settings"],
    queryFn: async () => {
      const resp = await authFetch(CGI_ENDPOINT);
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      }

      const data: CellularSettingsResponse = await resp.json();

      if (!data.success) {
        throw new Error(
          resolveErrorMessage(t, data.error, undefined, "Failed to fetch cellular settings")
        );
      }

      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (changes: Partial<CellularSettings>): Promise<boolean> => {
      const resp = await authFetch(CGI_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changes),
      });

      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      }

      const data: CellularSettingsApplyResponse = await resp.json();

      if (!data.success) {
        const detail = data.failed_fields
          ? `Failed to apply: ${data.failed_fields.join(", ")}`
          : resolveErrorMessage(t, data.error, undefined, "Failed to apply settings");
        throw new Error(detail);
      }

      // Wait for modem to recover after disruptive changes.
      // SIM slot: backend already takes ~4s (CFUN=0, sleep 2, QUIMSLOT, sleep 2,
      // CFUN=1), then modem needs ~8s more to re-register on the network.
      // CFUN / mode_pref: executes instantly but network recovery takes ~3-5s.
      let recoveryMs = 0;
      if (changes.sim_slot !== undefined) {
        recoveryMs = 8000;
      } else if (
        changes.cfun !== undefined ||
        changes.mode_pref !== undefined
      ) {
        recoveryMs = 3000;
      }
      if (recoveryMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, recoveryMs));
      }

      return true;
    },
    onSuccess: () => {
      // Re-fetch to show actual modem state after recovery wait.
      void query.refetch();
    },
  });

  const saveSettings = async (changes: Partial<CellularSettings>): Promise<boolean> => {
    try {
      return await saveMutation.mutateAsync(changes);
    } catch {
      return false;
    }
  };

  return {
    settings: query.data?.settings ?? null,
    ambr: query.data?.ambr ?? null,
    isLoading: query.isLoading || query.isPending,
    isSaving: saveMutation.isPending,
    error:
      query.error?.message ?? saveMutation.error?.message ?? null,
    saveSettings,
    refresh: () => {
      void query.refetch();
    },
  };
}
