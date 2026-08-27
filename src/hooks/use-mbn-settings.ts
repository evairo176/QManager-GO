"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { authFetch } from "@/lib/auth-fetch";
import { enterRebootFlow } from "@/lib/reboot";
import { resolveErrorMessage } from "@/lib/i18n/resolve-error";
import type {
  MbnProfile,
  MbnSettingsResponse,
  MbnSaveRequest,
  MbnSaveResponse,
} from "@/types/mbn-settings";

// =============================================================================
// useMbnSettings — One-Shot MBN Fetch & Save Hook
// =============================================================================
// Fetches MBN auto-select status and profile list on mount.
// Provides saveMbn for applying changes and rebootDevice for triggering reboot.
//
// Backend endpoint:
//   GET/POST /cgi-bin/quecmanager/cellular/mbn.sh
// =============================================================================

const CGI_ENDPOINT = "/cgi-bin/quecmanager/cellular/mbn.sh";

export interface UseMbnSettingsReturn {
  /** All MBN profiles (null before first fetch) */
  profiles: MbnProfile[] | null;
  /** Auto-select status: 1 = enabled, 0 = disabled (null before first fetch) */
  autoSel: number | null;
  /** True while initial fetch is in progress */
  isLoading: boolean;
  /** True while a save operation is in progress */
  isSaving: boolean;
  /** Error message if fetch or save failed */
  error: string | null;
  /** Apply MBN changes. Returns true on success. */
  saveMbn: (request: MbnSaveRequest) => Promise<boolean>;
  /** Trigger device reboot. Returns true if command was sent. */
  rebootDevice: () => Promise<boolean>;
  /** Re-fetch MBN data from the modem */
  refresh: () => void;
}

export function useMbnSettings(): UseMbnSettingsReturn {
  const { t } = useTranslation("errors");

  const query = useQuery<MbnSettingsResponse>({
    queryKey: ["mbn-settings"],
    queryFn: async () => {
      const resp = await authFetch(CGI_ENDPOINT);
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      }

      const data: MbnSettingsResponse = await resp.json();

      if (!data.success) {
        throw new Error(
          resolveErrorMessage(t, data.error, undefined, "Failed to fetch MBN settings")
        );
      }

      return data;
    },
  });

  const saveMbnMutation = useMutation({
    mutationFn: async (request: MbnSaveRequest): Promise<boolean> => {
      const resp = await authFetch(CGI_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });

      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      }

      const data: MbnSaveResponse = await resp.json();

      if (!data.success) {
        throw new Error(
          resolveErrorMessage(t, data.error, data.detail, "Failed to apply MBN settings")
        );
      }

      return true;
    },
    onSuccess: () => {
      // Silent re-fetch to update local state (no skeleton)
      void query.refetch();
    },
  });

  const rebootMutation = useMutation({
    mutationFn: async (): Promise<boolean> => {
      const resp = await authFetch(CGI_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reboot" }),
      });

      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      }

      const data: MbnSaveResponse = await resp.json();
      if (data.success) {
        enterRebootFlow("mbn");
      }
      return data.success;
    },
  });

  const saveMbn = async (request: MbnSaveRequest): Promise<boolean> => {
    try {
      return await saveMbnMutation.mutateAsync(request);
    } catch {
      return false;
    }
  };

  const rebootDevice = async (): Promise<boolean> => {
    try {
      return await rebootMutation.mutateAsync();
    } catch {
      return false;
    }
  };

  return {
    profiles: query.data?.profiles ?? null,
    autoSel: query.data?.auto_sel ?? null,
    isLoading: query.isLoading || query.isPending,
    isSaving: saveMbnMutation.isPending,
    error: query.error?.message ?? saveMbnMutation.error?.message ?? null,
    saveMbn,
    rebootDevice,
    refresh: () => {
      void query.refetch();
    },
  };
}
