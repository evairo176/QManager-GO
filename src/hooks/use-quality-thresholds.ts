"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
import { authFetch } from "@/lib/auth-fetch";
import type { QualityThresholdsSettings } from "@/types/modem-status";

// =============================================================================
// useQualityThresholds — read/write latency + loss tolerance presets
// =============================================================================
// CGI: /cgi-bin/quecmanager/system/quality_thresholds.sh
// =============================================================================

const ENDPOINT = "/cgi-bin/quecmanager/system/quality_thresholds.sh";

interface QualityThresholdsGetResponse {
  success: boolean;
  thresholds?: QualityThresholdsSettings;
  isDefault?: boolean;
  error?: string;
  detail?: string;
}

interface QualityThresholdsSaveResponse {
  success: boolean;
  error?: string;
  detail?: string;
}

export interface UseQualityThresholdsReturn {
  thresholds: QualityThresholdsSettings | undefined;
  isDefault: boolean;
  isLoading: boolean;
  error: string | null;
  isSaving: boolean;
  saveError: string | null;
  save: (settings: QualityThresholdsSettings) => Promise<void>;
}

export function useQualityThresholds(): UseQualityThresholdsReturn {
  const query = useQuery<QualityThresholdsGetResponse>({
    queryKey: ["quality-thresholds"],
    queryFn: async () => {
      const response = await authFetch(ENDPOINT);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response.json();
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (settings: QualityThresholdsSettings) => {
      // Flatten the nested client shape to the flat wire keys the CGI parses.
      const body: Record<string, string | number> = {
        action: "save",
        latency_preset: settings.latency.preset,
        loss_preset: settings.loss.preset,
      };
      if (
        settings.latency.preset === "custom" &&
        settings.latency.custom_ms != null
      ) {
        body.latency_custom_ms = settings.latency.custom_ms;
      }
      if (settings.loss.preset === "custom" && settings.loss.custom_pct != null) {
        body.loss_custom_pct = settings.loss.custom_pct;
      }

      const response = await authFetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const json: QualityThresholdsSaveResponse = await response.json();
      if (!json.success) {
        throw new Error(json.detail || json.error || "Failed to save");
      }
    },
    onSuccess: () => {
      void query.refetch();
    },
  });

  const save = async (settings: QualityThresholdsSettings) => {
    await saveMutation.mutateAsync(settings);
  };

  return {
    thresholds: query.data?.thresholds,
    isDefault: query.data?.isDefault ?? false,
    isLoading: query.isLoading || query.isPending,
    error: query.error ? query.error.message : null,
    isSaving: saveMutation.isPending,
    saveError: saveMutation.error ? saveMutation.error.message : null,
    save,
  };
}
