"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { authFetch } from "@/lib/auth-fetch";
import { resolveErrorMessage } from "@/lib/i18n/resolve-error";
import type {
  IpaOffloadState,
  IpaOffloadGetResponse,
  IpaOffloadPostResponse,
} from "@/types/ipa-offload";

// =============================================================================
// useIpaOffload: read/toggle IPA hardware offload.
// =============================================================================
// Backend: /cgi-bin/quecmanager/system/ipa_offload.sh
//   GET                                  → { available, enabled }
//   POST {"action":"enable"|"disable"}   → { enabled, pending_reboot_required }
//
// PESSIMISTIC: the toggle never optimistically flips local state. On a
// successful POST we silently re-fetch the authoritative {available,enabled}
// so the Switch reflects what the device actually wrote. The toggle takes
// effect only after a reboot, so the component is responsible for the
// deferred-reboot affordance.
// =============================================================================

const CGI_ENDPOINT = "/cgi-bin/quecmanager/system/ipa_offload.sh";

export interface UseIpaOffloadReturn {
  state: IpaOffloadState | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  setEnabled: (enabled: boolean) => Promise<boolean>;
  refresh: () => void;
}

export function useIpaOffload(): UseIpaOffloadReturn {
  const { t } = useTranslation("errors");

  const query = useQuery<IpaOffloadState>({
    queryKey: ["ipa-offload"],
    queryFn: async () => {
      const resp = await authFetch(CGI_ENDPOINT);
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      }

      const json: IpaOffloadGetResponse = await resp.json();

      if (!json.success) {
        throw new Error(
          resolveErrorMessage(t, json.error, json.detail, "Failed to read offload state")
        );
      }

      return { available: json.available, enabled: json.enabled };
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (enabled: boolean): Promise<boolean> => {
      const resp = await authFetch(CGI_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: enabled ? "enable" : "disable" }),
      });

      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      }

      const json: IpaOffloadPostResponse = await resp.json();

      if (!json.success) {
        throw new Error(
          resolveErrorMessage(t, json.error, json.detail, "Failed to update offload")
        );
      }

      return true;
    },
    onSuccess: () => {
      // Pessimistic: re-read authoritative state instead of flipping locally.
      void query.refetch();
    },
  });

  const setEnabled = async (enabled: boolean): Promise<boolean> => {
    try {
      return await toggleMutation.mutateAsync(enabled);
    } catch {
      return false;
    }
  };

  return {
    state: query.data ?? null,
    isLoading: query.isLoading || query.isPending,
    isSaving: toggleMutation.isPending,
    error: query.error?.message ?? toggleMutation.error?.message ?? null,
    setEnabled,
    refresh: () => {
      void query.refetch();
    },
  };
}
