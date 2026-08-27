"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { authFetch } from "@/lib/auth-fetch";
import { resolveErrorMessage } from "@/lib/i18n/resolve-error";
import type { InstallResult } from "@/types/video-optimizer";
import type {
  AlertsState,
  AlertsSavePayload,
  AlertChannel,
} from "@/types/alerts";

// =============================================================================
// useAlerts — one hook for the whole centralized Alerts surface
// =============================================================================
// Fetches the combined {channels, routing, capabilities} state, saves it in a
// single atomic POST, sends per-channel tests against the real send path, and
// drives the msmtp mailer install/uninstall lifecycle for the email channel.
//
// Backend: GET/POST /cgi-bin/quecmanager/monitoring/alerts.sh
// =============================================================================

const CGI_ENDPOINT = "/cgi-bin/quecmanager/monitoring/alerts.sh";

export interface UseAlertsReturn {
  state: AlertsState | null;
  isLoading: boolean;
  isSaving: boolean;
  testingChannel: AlertChannel | null;
  isUninstalling: boolean;
  installResult: InstallResult;
  error: string | null;
  saveSettings: (payload: AlertsSavePayload) => Promise<boolean>;
  sendTest: (channel: AlertChannel) => Promise<boolean>;
  runInstall: () => Promise<void>;
  uninstall: () => Promise<boolean>;
  refresh: () => void;
}

export function useAlerts(): UseAlertsReturn {
  const { t } = useTranslation("errors");
  const [isSaving, setIsSaving] = useState(false);
  const [testingChannel, setTestingChannel] = useState<AlertChannel | null>(
    null,
  );
  const [isUninstalling, setIsUninstalling] = useState(false);
  const [installResult, setInstallResult] = useState<InstallResult>({
    success: true,
    status: "idle",
  });
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const installPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (installPollRef.current) clearInterval(installPollRef.current);
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Fetch combined state
  // ---------------------------------------------------------------------------

  const query = useQuery<{
    success: boolean;
    channels: AlertsState["channels"];
    routing: AlertsState["routing"];
    capabilities: AlertsState["capabilities"];
    reboots?: AlertsState["reboots"];
    error?: string;
  }>({
    queryKey: ["alerts-state"],
    queryFn: async () => {
      const resp = await authFetch(CGI_ENDPOINT);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      return resp.json();
    },
  });

  const json = query.data;

  const state: AlertsState | null =
    json && json.success
      ? {
          channels: json.channels,
          routing: json.routing,
          capabilities: json.capabilities,
          reboots: Array.isArray(json.reboots) ? json.reboots : [],
        }
      : null;

  const queryError = query.error
    ? query.error instanceof Error
      ? query.error.message
      : "Failed to load alert settings"
    : json && !json.success
      ? resolveErrorMessage(
          t,
          json.error,
          undefined,
          "Failed to load alert settings",
        )
      : null;

  const effectiveError = queryError ?? error;

  // ---------------------------------------------------------------------------
  // Save (one atomic POST covering both channels + routing)
  // ---------------------------------------------------------------------------

  const saveSettings = useCallback(
    async (payload: AlertsSavePayload): Promise<boolean> => {
      setError(null);
      setIsSaving(true);
      try {
        const resp = await authFetch(CGI_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);

        const json = await resp.json();
        if (!mountedRef.current) return false;

        if (!json.success) {
          setError(
            resolveErrorMessage(
              t,
              json.error,
              json.detail,
              "Failed to save settings",
            ),
          );
          return false;
        }

        await query.refetch();
        return true;
      } catch (err) {
        if (!mountedRef.current) return false;
        setError(err instanceof Error ? err.message : "Failed to save settings");
        return false;
      } finally {
        if (mountedRef.current) setIsSaving(false);
      }
    },
    [query, t],
  );

  // ---------------------------------------------------------------------------
  // Per-channel test send (real path, gated on saved config by the caller)
  // ---------------------------------------------------------------------------

  const sendTest = useCallback(
    async (channel: AlertChannel): Promise<boolean> => {
      setError(null);
      setTestingChannel(channel);
      try {
        const resp = await authFetch(CGI_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "send_test", channel }),
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

        const json = await resp.json();
        if (!mountedRef.current) return false;

        if (!json.success) {
          setError(
            resolveErrorMessage(
              t,
              json.error,
              json.detail,
              "Failed to send test",
            ),
          );
          return false;
        }
        return true;
      } catch (err) {
        if (!mountedRef.current) return false;
        setError(err instanceof Error ? err.message : "Failed to send test");
        return false;
      } finally {
        if (mountedRef.current) setTestingChannel(null);
      }
    },
    [t],
  );

  // ---------------------------------------------------------------------------
  // msmtp install lifecycle (email channel only)
  // ---------------------------------------------------------------------------

  const stopInstallPolling = useCallback(() => {
    if (installPollRef.current) {
      clearInterval(installPollRef.current);
      installPollRef.current = null;
    }
  }, []);

  const pollInstallStatus = useCallback(async () => {
    try {
      const resp = await authFetch(CGI_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "install_status" }),
      });
      if (!resp.ok) return;
      const data: InstallResult = await resp.json();
      if (!mountedRef.current) return;
      setInstallResult(data);
      if (data.status === "complete" || data.status === "error") {
        stopInstallPolling();
        await query.refetch();
      }
    } catch {
      // Silently retry on the next poll tick.
    }
  }, [stopInstallPolling, query]);

  const runInstall = useCallback(async () => {
    setInstallResult({
      success: true,
      status: "running",
      message: "Starting installation...",
    });
    try {
      await authFetch(CGI_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "install" }),
      });
      installPollRef.current = setInterval(pollInstallStatus, 2000);
    } catch (err) {
      if (mountedRef.current) {
        setInstallResult({
          success: false,
          status: "error",
          message:
            err instanceof Error ? err.message : "Failed to start installation",
        });
      }
    }
  }, [pollInstallStatus]);

  const uninstall = useCallback(async (): Promise<boolean> => {
    setIsUninstalling(true);
    try {
      const resp = await authFetch(CGI_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "uninstall" }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const json = await resp.json();
      if (!json.success) {
        setError(
          resolveErrorMessage(t, json.error, json.detail, "Failed to uninstall"),
        );
        return false;
      }
      await query.refetch();
      return true;
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : "Failed to uninstall");
      }
      return false;
    } finally {
      if (mountedRef.current) setIsUninstalling(false);
    }
  }, [query, t]);

  return {
    state,
    isLoading: query.isLoading || query.isPending,
    isSaving,
    testingChannel,
    isUninstalling,
    installResult,
    error: effectiveError,
    saveSettings,
    sendTest,
    runInstall,
    uninstall,
    refresh: () => {
      void query.refetch();
    },
  };
}
