"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { authFetch } from "@/lib/auth-fetch";
import { resolveErrorMessage } from "@/lib/i18n/resolve-error";
import type {
  BandwidthSettings,
  BandwidthStatus,
  BandwidthDependencies,
  BandwidthSettingsResponse,
} from "@/types/bandwidth-monitor";

// =============================================================================
// useBandwidthSettings — HTTP-only hook for Bandwidth Monitor config
// =============================================================================
// Used by System Settings page to read/save bandwidth monitor settings.
// Does NOT manage WebSocket connections (see use-bandwidth-monitor.ts).
//
// Backend: GET/POST /cgi-bin/quecmanager/monitoring/bandwidth.sh
// =============================================================================

const CGI_ENDPOINT = "/cgi-bin/quecmanager/monitoring/bandwidth.sh";

// ─── Save Payload Types ─────────────────────────────────────────────────────

export interface SaveBandwidthPayload {
  action: "save_settings";
  enabled?: boolean;
  refresh_rate_ms?: number;
  ws_port?: number;
  interfaces?: string;
}

export interface UseBandwidthSettingsReturn {
  settings: BandwidthSettings | null;
  status: BandwidthStatus | null;
  dependencies: BandwidthDependencies | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  saveSettings: (payload: SaveBandwidthPayload) => Promise<boolean>;
  refresh: () => void;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useBandwidthSettings(): UseBandwidthSettingsReturn {
  const { t } = useTranslation("errors");
  const [isSaving, setIsSaving] = useState(false);

  const query = useQuery<BandwidthSettingsResponse>({
    queryKey: ["bandwidth-settings"],
    queryFn: async () => {
      const resp = await authFetch(CGI_ENDPOINT);
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      }
      return resp.json();
    },
  });

  const settings = query.data?.settings ?? null;
  const status = query.data?.status ?? null;
  const dependencies = query.data?.dependencies ?? null;

  const error = query.error
    ? query.error instanceof Error
      ? query.error.message
      : "Failed to fetch bandwidth settings"
    : null;

  // ─── Generic POST helper (mutation) ───────────────────────────────────────

  const postMutation = useMutation({
    mutationFn: async (payload: SaveBandwidthPayload): Promise<boolean> => {
      const resp = await authFetch(CGI_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      }

      const json = await resp.json();
      if (!json.success) {
        throw new Error(
          resolveErrorMessage(
            t,
            json.error,
            json.detail,
            "Failed to save settings",
          ),
        );
      }
      return true;
    },
    onSuccess: () => {
      void query.refetch();
    },
  });

  // ─── Action wrappers ──────────────────────────────────────────────────────

  const saveSettings = async (
    payload: SaveBandwidthPayload,
  ): Promise<boolean> => {
    setIsSaving(true);
    try {
      const ok = await postMutation.mutateAsync(payload);
      return ok;
    } catch (err) {
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const refresh = () => {
    void query.refetch();
  };

  return {
    settings,
    status,
    dependencies,
    isLoading: query.isLoading || query.isPending,
    isSaving,
    error,
    saveSettings,
    refresh,
  };
}
