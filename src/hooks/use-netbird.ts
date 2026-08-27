"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { authFetch } from "@/lib/auth-fetch";
import { resolveErrorMessage } from "@/lib/i18n/resolve-error";

// =============================================================================
// useNetBird — NetBird VPN status + actions
// =============================================================================
// Backend: GET/POST /cgi-bin/quecmanager/vpn/netbird.sh
// =============================================================================

const CGI_ENDPOINT = "/cgi-bin/quecmanager/vpn/netbird.sh";
const POLL_INTERVAL_MS = 10_000;

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

export interface InstallResult {
  success: boolean;
  status: "idle" | "running" | "complete" | "error";
  message?: string;
  detail?: string;
  error?: string;
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

interface PostResponse {
  success: boolean;
  error?: string;
  detail?: string;
}

export function useNetBird(): UseNetBirdReturn {
  const { t } = useTranslation("errors");
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isTogglingService, setIsTogglingService] = useState(false);
  const [isUninstalling, setIsUninstalling] = useState(false);
  const [installResult, setInstallResult] = useState<InstallResult>({
    success: true,
    status: "idle",
  });

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
  // Fetch current status (polled)
  // ---------------------------------------------------------------------------

  const query = useQuery<NetBirdStatus>({
    queryKey: ["netbird-status"],
    queryFn: async () => {
      const resp = await authFetch(CGI_ENDPOINT);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const json = await resp.json();
      if (!json.success) {
        throw new Error(json.error || "Failed to fetch NetBird status");
      }
      return json as NetBirdStatus;
    },
    refetchInterval: POLL_INTERVAL_MS,
  });

  const status = query.data ?? null;
  const isLoading = query.isLoading || query.isPending;
  const error = query.error ? query.error.message : null;

  // ---------------------------------------------------------------------------
  // POST helper
  // ---------------------------------------------------------------------------

  const postAction = useCallback(
    async (body: Record<string, unknown>): Promise<PostResponse> => {
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
      try {
        const json = await postAction(
          setupKey
            ? { action: "connect", setup_key: setupKey }
            : { action: "connect" },
        );
        if (!json.success) {
          setInstallResult({
            success: false,
            status: "error",
            message: resolveErrorMessage(t, json.error, json.detail, "Failed to connect"),
          });
          return false;
        }
        await query.refetch();
        return true;
      } catch (err) {
        setInstallResult({
          success: false,
          status: "error",
          message: err instanceof Error ? err.message : "Failed to connect",
        });
        return false;
      } finally {
        if (mountedRef.current) setIsConnecting(false);
      }
    },
    [postAction, query, t],
  );

  const disconnect = useCallback(async (): Promise<boolean> => {
    setIsDisconnecting(true);
    try {
      const json = await postAction({ action: "disconnect" });
      if (!json.success) {
        setInstallResult({
          success: false,
          status: "error",
          message: resolveErrorMessage(t, json.error, json.detail, "Failed to disconnect"),
        });
        return false;
      }
      await new Promise((r) => setTimeout(r, 2000));
      await query.refetch();
      return true;
    } catch (err) {
      setInstallResult({
        success: false,
        status: "error",
        message: err instanceof Error ? err.message : "Failed to disconnect",
      });
      return false;
    } finally {
      if (mountedRef.current) setIsDisconnecting(false);
    }
  }, [postAction, query, t]);

  const startService = useCallback(async (): Promise<boolean> => {
    setIsTogglingService(true);
    try {
      const json = await postAction({ action: "start_service" });
      if (!json.success) {
        setInstallResult({
          success: false,
          status: "error",
          message: resolveErrorMessage(t, json.error, json.detail, "Failed to start service"),
        });
        return false;
      }
      await new Promise((r) => setTimeout(r, 2000));
      await query.refetch();
      return true;
    } catch (err) {
      setInstallResult({
        success: false,
        status: "error",
        message: err instanceof Error ? err.message : "Failed to start service",
      });
      return false;
    } finally {
      if (mountedRef.current) setIsTogglingService(false);
    }
  }, [postAction, query, t]);

  const stopService = useCallback(async (): Promise<boolean> => {
    setIsTogglingService(true);
    try {
      const json = await postAction({ action: "stop_service" });
      if (!json.success) {
        setInstallResult({
          success: false,
          status: "error",
          message: resolveErrorMessage(t, json.error, json.detail, "Failed to stop service"),
        });
        return false;
      }
      await new Promise((r) => setTimeout(r, 2000));
      await query.refetch();
      return true;
    } catch (err) {
      setInstallResult({
        success: false,
        status: "error",
        message: err instanceof Error ? err.message : "Failed to stop service",
      });
      return false;
    } finally {
      if (mountedRef.current) setIsTogglingService(false);
    }
  }, [postAction, query, t]);

  const setBootEnabled = useCallback(
    async (enabled: boolean): Promise<boolean> => {
      try {
        const json = await postAction({ action: "set_boot_enabled", enabled });
        if (!json.success) {
          setInstallResult({
            success: false,
            status: "error",
            message: resolveErrorMessage(t, json.error, json.detail, "Failed to update boot setting"),
          });
          return false;
        }
        await query.refetch();
        return true;
      } catch (err) {
        setInstallResult({
          success: false,
          status: "error",
          message: err instanceof Error ? err.message : "Failed to update boot setting",
        });
        return false;
      }
    },
    [postAction, query, t],
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
        await query.refetch();
      }
    } catch {
      // Silently retry on next poll
    }
  }, [postAction, stopInstallPolling, query]);

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
        setInstallResult({
          success: false,
          status: "error",
          message: resolveErrorMessage(t, json.error, json.detail, "Failed to uninstall"),
        });
        return false;
      }
      await query.refetch();
      return true;
    } catch (err) {
      if (mountedRef.current) {
        setInstallResult({
          success: false,
          status: "error",
          message: err instanceof Error ? err.message : "Failed to uninstall",
        });
      }
      return false;
    } finally {
      if (mountedRef.current) setIsUninstalling(false);
    }
  }, [postAction, query, t]);

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
    refresh: () => void query.refetch(),
  };
}
