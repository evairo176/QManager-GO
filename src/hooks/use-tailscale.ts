"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { authFetch } from "@/lib/auth-fetch";
import { resolveErrorMessage } from "@/lib/i18n/resolve-error";
import { useLiveInterval } from "@/components/realtime-provider";
import type { InstallResult } from "@/types/video-optimizer";

// =============================================================================
// useTailscale — Fetch & Action Hook for Tailscale VPN Management
// =============================================================================
// Fetches Tailscale status on mount (tiered: not installed → stopped → full).
// Provides action methods for connect, disconnect, logout, service, boot toggle.
// Adaptive polling: 10s normal, 3s during auth wait.
//
// Backend: GET/POST /cgi-bin/quecmanager/vpn/tailscale.sh
// =============================================================================

const CGI_ENDPOINT = "/cgi-bin/quecmanager/vpn/tailscale.sh";

const POLL_NORMAL_MS = 10_000;
const POLL_AUTH_MS = 3_000;

// ─── Types ─────────────────────────────────────────────────────────────────

export interface TailscaleSelf {
  hostname: string;
  dns_name: string;
  tailscale_ips: string[];
  online: boolean;
  os: string;
  relay: string;
}

export interface TailscaleTailnet {
  name: string;
  magic_dns_suffix: string;
  magic_dns_enabled: boolean;
}

export interface TailscalePeer {
  hostname: string;
  dns_name: string;
  tailscale_ips: string[];
  os: string;
  online: boolean;
  last_seen: string;
  relay: string;
  exit_node: boolean;
}

export interface TailscaleStatus {
  installed: boolean;
  daemon_running?: boolean;
  enabled_on_boot?: boolean;
  version?: string;
  backend_state?: string;
  auth_url?: string;
  self?: TailscaleSelf;
  tailnet?: TailscaleTailnet;
  peers?: TailscalePeer[];
  health?: string[];
  install_hint?: string;
  install_variant?: "official" | "tiny" | "opkg";
  exit_node_advertised?: boolean;
  error_detail?: string;
  other_vpn_installed?: boolean;
  other_vpn_name?: string;
}

export interface UseTailscaleReturn {
  status: TailscaleStatus | null;
  isLoading: boolean;
  isConnecting: boolean;
  isDisconnecting: boolean;
  isTogglingService: boolean;
  isTogglingExitNode: boolean;
  isUninstalling: boolean;
  installResult: InstallResult;
  error: string | null;
  connect: () => Promise<boolean>;
  disconnect: () => Promise<boolean>;
  logout: () => Promise<boolean>;
  startService: () => Promise<boolean>;
  stopService: () => Promise<boolean>;
  setBootEnabled: (enabled: boolean) => Promise<boolean>;
  setExitNodeAdvertised: (enabled: boolean) => Promise<boolean>;
  uninstall: () => Promise<boolean>;
  runInstall: (variant: "official" | "tiny") => Promise<void>;
  refresh: () => void;
}

// ─── Hook ──────────────────────────────────────────────────────────────────

export function useTailscale(): UseTailscaleReturn {
  const { t } = useTranslation("errors");
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isTogglingService, setIsTogglingService] = useState(false);
  const [isTogglingExitNode, setIsTogglingExitNode] = useState(false);
  const [isUninstalling, setIsUninstalling] = useState(false);
  const [installResult, setInstallResult] = useState<InstallResult>({
    success: true,
    status: "idle",
  });
  const installPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const livePollNormal = useLiveInterval(POLL_NORMAL_MS);
  const livePollAuth = useLiveInterval(POLL_AUTH_MS);

  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (installPollRef.current) clearInterval(installPollRef.current);
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Fetch current status — adaptive polling, faster during auth wait
  // ---------------------------------------------------------------------------

  const query = useQuery<TailscaleStatus>({
    queryKey: ["tailscale-status"],
    queryFn: async () => {
      const resp = await authFetch(CGI_ENDPOINT);
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      }

      const json = await resp.json();
      if (!json.success) {
        throw new Error(
          resolveErrorMessage(t, json.error, undefined, "Failed to fetch Tailscale status"),
        );
      }

      return json as TailscaleStatus;
    },
    refetchInterval: (q) => {
      const isAuthWaiting =
        q.state.data?.backend_state === "NeedsLogin" && !!q.state.data?.auth_url;
      return isAuthWaiting ? livePollAuth : livePollNormal;
    },
  });

  const status = query.data ?? null;

  const errorMessage = query.error
    ? query.error instanceof Error
      ? query.error.message
      : "Failed to fetch Tailscale status"
    : error;

  // ---------------------------------------------------------------------------
  // POST helper
  // ---------------------------------------------------------------------------

  const postAction = useCallback(
    async (body: Record<string, unknown>): Promise<{
      success: boolean;
      auth_url?: string;
      already_authenticated?: boolean;
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

  const connect = useCallback(async (): Promise<boolean> => {
    setIsConnecting(true);
    setError(null);

    try {
      const json = await postAction({ action: "connect" });
      if (!mountedRef.current) return false;

      if (!json.success) {
        setError(resolveErrorMessage(t, json.error, json.detail, "Failed to connect"));
        return false;
      }

      // Refetch to pick up auth_url or Running state
      await query.refetch();
      return true;
    } catch (err) {
      if (!mountedRef.current) return false;
      setError(err instanceof Error ? err.message : "Failed to connect");
      return false;
    } finally {
      if (mountedRef.current) setIsConnecting(false);
    }
  }, [postAction, query, t]);

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

      await query.refetch();
      return true;
    } catch (err) {
      if (!mountedRef.current) return false;
      setError(err instanceof Error ? err.message : "Failed to disconnect");
      return false;
    } finally {
      if (mountedRef.current) setIsDisconnecting(false);
    }
  }, [postAction, query, t]);

  const logout = useCallback(async (): Promise<boolean> => {
    setIsDisconnecting(true);
    setError(null);

    try {
      const json = await postAction({ action: "logout" });
      if (!mountedRef.current) return false;

      if (!json.success) {
        setError(resolveErrorMessage(t, json.error, json.detail, "Failed to logout"));
        return false;
      }

      await query.refetch();
      return true;
    } catch (err) {
      if (!mountedRef.current) return false;
      setError(err instanceof Error ? err.message : "Failed to logout");
      return false;
    } finally {
      if (mountedRef.current) setIsDisconnecting(false);
    }
  }, [postAction, query, t]);

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

      await query.refetch();
      return true;
    } catch (err) {
      if (!mountedRef.current) return false;
      setError(err instanceof Error ? err.message : "Failed to start service");
      return false;
    } finally {
      if (mountedRef.current) setIsTogglingService(false);
    }
  }, [postAction, query, t]);

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

      await query.refetch();
      return true;
    } catch (err) {
      if (!mountedRef.current) return false;
      setError(err instanceof Error ? err.message : "Failed to stop service");
      return false;
    } finally {
      if (mountedRef.current) setIsTogglingService(false);
    }
  }, [postAction, query, t]);

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

        await query.refetch();
        return true;
      } catch (err) {
        if (!mountedRef.current) return false;
        setError(
          err instanceof Error ? err.message : "Failed to update boot setting",
        );
        return false;
      }
    },
    [postAction, query, t],
  );

  const setExitNodeAdvertised = useCallback(
    async (enabled: boolean): Promise<boolean> => {
      setIsTogglingExitNode(true);
      setError(null);

      try {
        const json = await postAction({
          action: "set_exit_node",
          enabled,
        });
        if (!mountedRef.current) return false;

        if (!json.success) {
          setError(resolveErrorMessage(t, json.error, json.detail, "Failed to update exit node setting"));
          return false;
        }

        await query.refetch();
        return true;
      } catch (err) {
        if (!mountedRef.current) return false;
        setError(
          err instanceof Error ? err.message : "Failed to update exit node setting",
        );
        return false;
      } finally {
        if (mountedRef.current) setIsTogglingExitNode(false);
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

  const runInstall = useCallback(async (variant: "official" | "tiny") => {
    setInstallResult({ success: true, status: "running", message: "Starting installation..." });
    try {
      await authFetch(CGI_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "install", variant }),
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
      await query.refetch();
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
  }, [postAction, query, t]);

  return {
    status,
    isLoading: query.isLoading || query.isPending,
    isConnecting,
    isDisconnecting,
    isTogglingService,
    isTogglingExitNode,
    isUninstalling,
    installResult,
    error: errorMessage,
    connect,
    disconnect,
    logout,
    startService,
    stopService,
    setBootEnabled,
    setExitNodeAdvertised,
    uninstall,
    runInstall,
    refresh: () => {
      void query.refetch();
    },
  };
}
