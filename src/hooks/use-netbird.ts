"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { authFetch } from "@/lib/auth-fetch";
import { resolveErrorMessage } from "@/lib/i18n/resolve-error";
import type { InstallResult } from "@/types/video-optimizer";

// =============================================================================
// useNetBird — Fetch & Action Hook for NetBird VPN Management
// =============================================================================
// Fetches NetBird status on mount (tiered: not installed → stopped → full).
// Provides action methods for connect, disconnect, service, boot toggle.
// Fixed 10s polling (no adaptive auth-wait like Tailscale).
//
// Backend: GET/POST /cgi-bin/quecmanager/vpn/netbird.sh
// =============================================================================

const CGI_ENDPOINT = "/cgi-bin/quecmanager/vpn/netbird.sh";

const POLL_INTERVAL_MS = 10_000;

// ─── Types ─────────────────────────────────────────────────────────────────

export interface NetBirdPeer {
  hostname: string;
  netbird_ip: string;
  status: string;
  connection_type: string;
  direct: string;
  last_seen: string;
  transfer_received: string;
  transfer_sent: string;
}

export interface NetBirdStatus {
  installed: boolean;
  daemon_running?: boolean;
  enabled_on_boot?: boolean;
  version?: string;
  backend_state?: string;
  management?: string;
  signal?: string;
  fqdn?: string;
  netbird_ip?: string;
  interface_type?: string;
  peers_connected?: number;
  peers_total?: number;
  peers?: NetBirdPeer[];
  install_hint?: string;
  error_detail?: string;
  other_vpn_installed?: boolean;
  other_vpn_name?: string;
}

export interface UseNetBirdReturn {
  status: NetBirdStatus | null;
  isLoading: boolean;
  isConnecting: boolean;
  isDisconnecting: boolean;
  isTogglingService: boolean;
  isUninstalling: boolean;
  installResult: InstallResult;
  error: string | null;
  connect: (setupKey?: string) => Promise<boolean>;
  disconnect: () => Promise<boolean>;
  startService: () => Promise<boolean>;
  stopService: () => Promise<boolean>;
  setBootEnabled: (enabled: boolean) => Promise<boolean>;
  uninstall: () => Promise<boolean>;
  runInstall: () => Promise<void>;
  refresh: () => void;
}

// ─── Hook ──────────────────────────────────────────────────────────────────

export function useNetBird(): UseNetBirdReturn {
  const { t } = useTranslation("errors");
  const [status, setStatus] = useState<NetBirdStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isTogglingService, setIsTogglingService] = useState(false);
  const [isUninstalling, setIsUninstalling] = useState(false);
  const [installResult, setInstallResult] = useState<InstallResult>({
    success: true,
    status: "idle",
  });
  const installPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (installPollRef.current) clearInterval(installPollRef.current);
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Fetch current status
  // ---------------------------------------------------------------------------
  const fetchStatus = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    setError(null);

    try {
      const resp = await authFetch(CGI_ENDPOINT);
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      }

      const json = await resp.json();
      if (!mountedRef.current) return;

      if (!json.success) {
        setError(resolveErrorMessage(t, json.error, undefined, "Failed to fetch NetBird status"));
        return;
      }

      setStatus(json);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(
        err instanceof Error ? err.message : "Failed to fetch NetBird status",
      );
    } finally {
      if (mountedRef.current && !silent) {
        setIsLoading(false);
      }
    }
  }, [t]);

  // ---------------------------------------------------------------------------
  // Fixed-interval polling
  // ---------------------------------------------------------------------------
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => fetchStatus(true), POLL_INTERVAL_MS);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchStatus]);

  // ---------------------------------------------------------------------------
  // POST helper
  // ---------------------------------------------------------------------------
  const postAction = useCallback(
    async (body: Record<string, unknown>): Promise<{
      success: boolean;
      error?: string;
      detail?: string;
    }> => {
      const resp = await authFetch(CGI_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      }

      return resp.json();
    },
    [],
  );

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------
  const connect = useCallback(
    async (setupKey?: string): Promise<boolean> => {
      setIsConnecting(true);
      setError(null);

      try {
        const body: Record<string, unknown> = { action: "connect" };
        if (setupKey) body.setup_key = setupKey;

        const json = await postAction(body);
        if (!mountedRef.current) return false;

        if (!json.success) {
          setError(resolveErrorMessage(t, json.error, json.detail, "Failed to connect"));
          return false;
        }

        // Brief delay for daemon state to propagate before refetch
        await new Promise((r) => setTimeout(r, 2000));
        if (!mountedRef.current) return false;
        await fetchStatus(true);
        return true;
      } catch (err) {
        if (!mountedRef.current) return false;
        setError(err instanceof Error ? err.message : "Failed to connect");
        return false;
      } finally {
        if (mountedRef.current) setIsConnecting(false);
      }
    },
    [postAction, fetchStatus, t],
  );

  const disconnect = useCallback(async (): Promise<boolean> => {
    setIsDisconnecting(true);
    setError(null);

    try {
      const json = await postAction({ action: "disconnect" });
      if (!mountedRef.current) return false;

      if (!json.success) {
        setError(resolveErrorMessage(t, json.error, json.detail, "Failed to disconnect"));
        return false;
      }

      await new Promise((r) => setTimeout(r, 2000));
      if (!mountedRef.current) return false;
      await fetchStatus(true);
      return true;
    } catch (err) {
      if (!mountedRef.current) return false;
      setError(err instanceof Error ? err.message : "Failed to disconnect");
      return false;
    } finally {
      if (mountedRef.current) setIsDisconnecting(false);
    }
  }, [postAction, fetchStatus, t]);

  const startService = useCallback(async (): Promise<boolean> => {
    setIsTogglingService(true);
    setError(null);

    try {
      const json = await postAction({ action: "start_service" });
      if (!mountedRef.current) return false;

      if (!json.success) {
        setError(resolveErrorMessage(t, json.error, json.detail, "Failed to start service"));
        return false;
      }

      await new Promise((r) => setTimeout(r, 2000));
      if (!mountedRef.current) return false;
      await fetchStatus(true);
      return true;
    } catch (err) {
      if (!mountedRef.current) return false;
      setError(err instanceof Error ? err.message : "Failed to start service");
      return false;
    } finally {
      if (mountedRef.current) setIsTogglingService(false);
    }
  }, [postAction, fetchStatus, t]);

  const stopService = useCallback(async (): Promise<boolean> => {
    setIsTogglingService(true);
    setError(null);

    try {
      const json = await postAction({ action: "stop_service" });
      if (!mountedRef.current) return false;

      if (!json.success) {
        setError(resolveErrorMessage(t, json.error, json.detail, "Failed to stop service"));
        return false;
      }

      await new Promise((r) => setTimeout(r, 2000));
      if (!mountedRef.current) return false;
      await fetchStatus(true);
      return true;
    } catch (err) {
      if (!mountedRef.current) return false;
      setError(err instanceof Error ? err.message : "Failed to stop service");
      return false;
    } finally {
      if (mountedRef.current) setIsTogglingService(false);
    }
  }, [postAction, fetchStatus, t]);

  const setBootEnabled = useCallback(
    async (enabled: boolean): Promise<boolean> => {
      setError(null);

      try {
        const json = await postAction({
          action: "set_boot_enabled",
          enabled,
        });
        if (!mountedRef.current) return false;

        if (!json.success) {
          setError(resolveErrorMessage(t, json.error, json.detail, "Failed to update boot setting"));
          return false;
        }

        await fetchStatus(true);
        return true;
      } catch (err) {
        if (!mountedRef.current) return false;
        setError(
          err instanceof Error ? err.message : "Failed to update boot setting",
        );
        return false;
      }
    },
    [postAction, fetchStatus, t],
  );

  // ---------------------------------------------------------------------------
  // Install via opkg
  // ---------------------------------------------------------------------------
  const stopInstallPolling = useCallback(() => {
    if (installPollRef.current) {
      clearInterval(installPollRef.current);
      installPollRef.current = null;
    }
  }, []);

  const pollInstallStatus = useCallback(async () => {
    try {
      const json = await postAction({ action: "install_status" });
      if (!mountedRef.current) return;
      setInstallResult(json as unknown as InstallResult);
      const r = json as unknown as InstallResult;
      if (r.status === "complete" || r.status === "error") {
        stopInstallPolling();
        await fetchStatus(true);
      }
    } catch {
      // Silently retry on next poll
    }
  }, [postAction, stopInstallPolling, fetchStatus]);

  const runInstall = useCallback(async () => {
    setInstallResult({ success: true, status: "running", message: "Starting installation..." });
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
          message: err instanceof Error ? err.message : "Failed to start installation",
        });
      }
    }
  }, [pollInstallStatus]);

  const uninstall = useCallback(async (): Promise<boolean> => {
    setIsUninstalling(true);
    try {
      const json = await postAction({ action: "uninstall" });
      if (!mountedRef.current) return false;
      if (!json.success) {
        setError(resolveErrorMessage(t, json.error, json.detail, "Failed to uninstall"));
        return false;
      }
      await fetchStatus(true);
      return true;
    } catch (err) {
      if (mountedRef.current) {
        setError(
          err instanceof Error ? err.message : "Failed to uninstall",
        );
      }
      return false;
    } finally {
      if (mountedRef.current) setIsUninstalling(false);
    }
  }, [postAction, fetchStatus, t]);

  return {
    status,
    isLoading,
    isConnecting,
    isDisconnecting,
    isTogglingService,
    isUninstalling,
    installResult,
    error,
    connect,
    disconnect,
    startService,
    stopService,
    setBootEnabled,
    uninstall,
    runInstall,
    refresh: fetchStatus,
  };
}
