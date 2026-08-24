"use client";

import { useState, useCallback, useRef, useEffect } from "react";
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
  const [settings, setSettings] = useState<BandwidthSettings | null>(null);
  const [status, setStatus] = useState<BandwidthStatus | null>(null);
  const [dependencies, setDependencies] =
    useState<BandwidthDependencies | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ─── Fetch current settings ────────────────────────────────────────────────

  const fetchSettings = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    setError(null);

    try {
      const resp = await authFetch(CGI_ENDPOINT);
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      }

      const json: BandwidthSettingsResponse = await resp.json();
      if (!mountedRef.current) return;

      if (!json.success) {
        setError("Failed to fetch bandwidth settings");
        return;
      }

      setSettings(json.settings);
      setStatus(json.status);
      setDependencies(json.dependencies);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(
        err instanceof Error ? err.message : "Failed to fetch bandwidth settings",
      );
    } finally {
      if (mountedRef.current && !silent) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // ─── Generic POST helper ───────────────────────────────────────────────────

  const postAction = useCallback(
    async (
      payload: SaveBandwidthPayload,
    ): Promise<boolean> => {
      setError(null);
      setIsSaving(true);

      try {
        const resp = await authFetch(CGI_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
        }

        const json = await resp.json();
        if (!mountedRef.current) return false;

        if (!json.success) {
          setError(resolveErrorMessage(t, json.error, json.detail, "Failed to save settings"));
          return false;
        }

        // Silent re-fetch to sync all state
        await fetchSettings(true);
        return true;
      } catch (err) {
        if (!mountedRef.current) return false;
        setError(
          err instanceof Error ? err.message : "Failed to save settings",
        );
        return false;
      } finally {
        if (mountedRef.current) {
          setIsSaving(false);
        }
      }
    },
    [fetchSettings, t],
  );

  // ─── Action wrappers ──────────────────────────────────────────────────────

  const saveSettings = useCallback(
    (payload: SaveBandwidthPayload) => postAction(payload),
    [postAction],
  );

  const refresh = useCallback(() => {
    fetchSettings();
  }, [fetchSettings]);

  return {
    settings,
    status,
    dependencies,
    isLoading,
    isSaving,
    error,
    saveSettings,
    refresh,
  };
}
