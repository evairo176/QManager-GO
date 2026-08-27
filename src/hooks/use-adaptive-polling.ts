"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
import { authFetch } from "@/lib/auth-fetch";
import type { AdaptivePollingSettings, PollerTier } from "@/types/modem-status";

// =============================================================================
// useAdaptivePolling — read/write the UI-aware poller backoff settings
// =============================================================================
// CGI: /cgi-bin/quecmanager/system/adaptive_polling.sh
// A light 10 s refetch keeps the live-tier badge fresh while the card is open.
// =============================================================================

const ENDPOINT = "/cgi-bin/quecmanager/system/adaptive_polling.sh";
const TIER_REFRESH_MS = 10_000;

interface AdaptivePollingGetResponse {
  success: boolean;
  settings?: AdaptivePollingSettings;
  isDefault?: boolean;
  tier?: PollerTier;
  error?: string;
  detail?: string;
}

interface AdaptivePollingSaveResponse {
  success: boolean;
  error?: string;
  detail?: string;
}

export interface UseAdaptivePollingReturn {
  settings: AdaptivePollingSettings | undefined;
  isDefault: boolean;
  tier: PollerTier | undefined;
  isLoading: boolean;
  error: string | null;
  isSaving: boolean;
  saveError: string | null;
  save: (next: AdaptivePollingSettings) => Promise<void>;
  refresh: () => void;
}

export function useAdaptivePolling(): UseAdaptivePollingReturn {
  const query = useQuery<AdaptivePollingGetResponse>({
    queryKey: ["adaptive-polling"],
    queryFn: async () => {
      const response = await authFetch(ENDPOINT);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const json: AdaptivePollingGetResponse = await response.json();
      if (!json.success || !json.settings) {
        throw new Error(json.detail || json.error || "Failed to load adaptive polling");
      }
      return json;
    },
    refetchInterval: TIER_REFRESH_MS,
  });

  const saveMutation = useMutation({
    mutationFn: async (next: AdaptivePollingSettings) => {
      const response = await authFetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save",
          enabled: next.enabled,
          active_grace: next.active_grace,
          idle_interval: next.idle_interval,
          idle_threshold: next.idle_threshold,
          deep_idle_interval: next.deep_idle_interval,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const json: AdaptivePollingSaveResponse = await response.json();
      if (!json.success) {
        throw new Error(json.detail || json.error || "Failed to save");
      }
    },
    onSuccess: () => {
      void query.refetch();
    },
  });

  const save = async (next: AdaptivePollingSettings) => {
    await saveMutation.mutateAsync(next);
  };

  return {
    settings: query.data?.settings,
    isDefault: query.data?.isDefault ?? false,
    tier: query.data?.tier,
    isLoading: query.isLoading || query.isPending,
    error: query.error ? query.error.message : null,
    isSaving: saveMutation.isPending,
    saveError: saveMutation.error ? saveMutation.error.message : null,
    save,
    refresh: () => {
      void query.refetch();
    },
  };
}
