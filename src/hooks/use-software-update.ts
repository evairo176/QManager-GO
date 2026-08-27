"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { authFetch } from "@/lib/auth-fetch";
import { resolveErrorMessage } from "@/lib/i18n/resolve-error";
import { useLiveInterval } from "@/components/realtime-provider";
import { enterRebootFlow } from "@/lib/reboot";

// =============================================================================
// useSoftwareUpdate — Check, download, install QManager updates
// =============================================================================
// Checks GitHub Releases via the backend CGI on mount.
// Two-step flow: download + verify → install. Polls status during both phases.
//
// Backend: GET/POST /cgi-bin/quecmanager/system/update.sh
// =============================================================================

const CGI_ENDPOINT = "/cgi-bin/quecmanager/system/update.sh";
const POLL_INTERVAL = 2000;
const LAST_CHECKED_KEY = "qm_update_last_checked";
const INSTALL_STALL_TIMEOUT_MS = 120000;

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AvailableVersion {
  tag: string;
  has_assets: boolean;
  asset_size: string | null;
  is_current: boolean;
}

export interface DownloadState {
  status: "downloading" | "verifying" | "ready" | "error";
  version: string;
  message?: string;
  size?: string;
}

export interface UpdateInfo {
  current_version: string;
  latest_version: string | null;
  update_available: boolean;
  changelog: string | null;
  current_changelog: string | null;
  download_url: string | null;
  download_size: string | null;
  available_versions: AvailableVersion[];
  download_state: DownloadState | null;
  include_prerelease: boolean;
  auto_update_enabled: boolean;
  auto_update_time: string;
  check_error: string | null;
}

export interface UpdateStatus {
  status: "idle" | "downloading" | "installing" | "rebooting" | "error";
  message?: string;
  version?: string;
  size?: string;
}

export interface UseSoftwareUpdateReturn {
  updateInfo: UpdateInfo | null;
  updateStatus: UpdateStatus;
  downloadState: DownloadState | null;
  isLoading: boolean;
  isChecking: boolean;
  isUpdating: boolean;
  isDownloading: boolean;
  isInstallStalled: boolean;
  error: string | null;
  lastChecked: string | null;
  checkForUpdates: () => Promise<void>;
  downloadUpdate: (version?: string) => Promise<void>;
  installStaged: () => Promise<void>;
  installUpdate: () => Promise<void>;
  rebootDevice: () => Promise<void>;
  togglePrerelease: (enabled: boolean) => Promise<void>;
  saveAutoUpdate: (enabled: boolean, time: string) => Promise<void>;
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useSoftwareUpdate(): UseSoftwareUpdateReturn {
  const { t } = useTranslation("errors");
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({ status: "idle" });
  const [isChecking, setIsChecking] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isInstallStalled, setIsInstallStalled] = useState(false);
  const [lastChecked, setLastChecked] = useState<string | null>(null);
  const [statusPolling, setStatusPolling] = useState(false);
  // Mirrored download state (from backend poll / update info)
  const [downloadState, setDownloadState] = useState<DownloadState | null>(null);

  const mountedRef = useRef(true);
  const installStallTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastStatusSignatureRef = useRef<string>("");

  const liveInterval = useLiveInterval(POLL_INTERVAL);

  const clearInstallStallTimer = useCallback(() => {
    if (installStallTimerRef.current) {
      clearTimeout(installStallTimerRef.current);
      installStallTimerRef.current = null;
    }
  }, []);

  const armInstallStallTimer = useCallback(() => {
    clearInstallStallTimer();
    installStallTimerRef.current = setTimeout(() => {
      if (mountedRef.current) {
        setIsInstallStalled(true);
      }
    }, INSTALL_STALL_TIMEOUT_MS);
  }, [clearInstallStallTimer]);

  useEffect(() => {
    mountedRef.current = true;
    // Load last checked from localStorage
    const stored = localStorage.getItem(LAST_CHECKED_KEY);
    if (stored) setLastChecked(stored);
    return () => {
      mountedRef.current = false;
      clearInstallStallTimer();
    };
  }, [clearInstallStallTimer]);

  // ---------------------------------------------------------------------------
  // Fetch update info from CGI (on mount + manual check)
  // ---------------------------------------------------------------------------

  const infoQuery = useQuery<UpdateInfo>({
    queryKey: ["software-update-info"],
    queryFn: async () => {
      const resp = await authFetch(CGI_ENDPOINT);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      const json = await resp.json();
      if (!json.success) {
        throw new Error(
          resolveErrorMessage(t, json.error, json.detail, "Failed to check for updates"),
        );
      }
      return json as UpdateInfo;
    },
  });

  const updateInfo = infoQuery.data ?? null;

  // Sync download state + polling from fetched info
  useEffect(() => {
    const info = infoQuery.data;
    if (!info?.download_state) return;
    setDownloadState(info.download_state);
    if (
      info.download_state.status === "downloading" ||
      info.download_state.status === "verifying"
    ) {
      setIsDownloading(true);
      setStatusPolling(true);
    }
    // Update last checked timestamp
    const now = new Date().toISOString();
    localStorage.setItem(LAST_CHECKED_KEY, now);
    setLastChecked(now);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [infoQuery.data]);

  const infoError = infoQuery.error
    ? infoQuery.error instanceof Error
      ? infoQuery.error.message
      : "Failed to check for updates"
    : null;

  const [actionError, setActionError] = useState<string | null>(null);

  const error = infoError ?? actionError;

  // ---------------------------------------------------------------------------
  // Poll update status during download / install / rollback
  // ---------------------------------------------------------------------------

  const statusQuery = useQuery<UpdateStatus>({
    queryKey: ["software-update-status"],
    queryFn: async () => {
      const resp = await authFetch(`${CGI_ENDPOINT}?action=status`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return resp.json();
    },
    enabled: statusPolling,
    refetchInterval: statusPolling ? liveInterval : false,
  });

  // Drive status state from each poll
  useEffect(() => {
    const json = statusQuery.data;
    if (!json) return;

    setUpdateStatus(json);

    const signature = `${json.status}|${json.message ?? ""}|${json.version ?? ""}`;
    if (signature !== lastStatusSignatureRef.current) {
      lastStatusSignatureRef.current = signature;
      setIsInstallStalled(false);
      if (json.status === "installing") {
        armInstallStallTimer();
      } else {
        clearInstallStallTimer();
      }
    }

    if (json.status === "rebooting") {
      clearInstallStallTimer();
      setIsInstallStalled(false);
      // Stop polling, navigate to reboot page
      setStatusPolling(false);
      enterRebootFlow("software_update");
    }

    if (json.status === "error") {
      clearInstallStallTimer();
      setIsInstallStalled(false);
      setStatusPolling(false);
      setIsUpdating(false);
      setActionError(
        resolveErrorMessage(t, undefined, json.message, "Update failed"),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusQuery.data]);

  // Network error while polling — device may be rebooting
  useEffect(() => {
    if (!statusPolling) return;
    if (statusQuery.isError) {
      clearInstallStallTimer();
      setStatusPolling(false);
      enterRebootFlow("software_update");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusQuery.isError, statusPolling]);

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  const checkForUpdates = async () => {
    setIsChecking(true);
    setActionError(null);
    await infoQuery.refetch();
    if (mountedRef.current) setIsChecking(false);
  };

  const downloadUpdate = async (version?: string) => {
    const targetVersion = version || updateInfo?.latest_version;
    if (!targetVersion) return;

    setActionError(null);
    setIsDownloading(true);
    setDownloadState({ status: "downloading", version: targetVersion });

    try {
      const resp = await authFetch(CGI_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "download", version: targetVersion }),
      });

      const json = await resp.json();
      if (!json.success) {
        setActionError(
          resolveErrorMessage(t, json.error, json.detail, "Failed to start download"),
        );
        setIsDownloading(false);
        setDownloadState(null);
        return;
      }

      setStatusPolling(true);
    } catch (err) {
      if (!mountedRef.current) return;
      setActionError(err instanceof Error ? err.message : "Failed to start download");
      setIsDownloading(false);
      setDownloadState(null);
    }
  };

  const installStaged = async () => {
    setActionError(null);
    setIsUpdating(true);
    setIsInstallStalled(false);
    lastStatusSignatureRef.current = "";
    setUpdateStatus({ status: "installing", message: "Installing update..." });

    try {
      const resp = await authFetch(CGI_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "install_staged" }),
      });

      const json = await resp.json();
      if (!json.success) {
        setActionError(
          resolveErrorMessage(t, json.error, json.detail, "Failed to start installation"),
        );
        setIsUpdating(false);
        return;
      }

      setStatusPolling(true);
    } catch (err) {
      if (!mountedRef.current) return;
      setActionError(err instanceof Error ? err.message : "Failed to start installation");
      setIsUpdating(false);
    }
  };

  const installUpdate = async () => {
    if (!updateInfo?.download_url || !updateInfo?.latest_version) return;

    setActionError(null);
    setIsUpdating(true);
    setIsInstallStalled(false);
    lastStatusSignatureRef.current = "";
    setUpdateStatus({ status: "downloading", version: updateInfo.latest_version });

    try {
      const resp = await authFetch(CGI_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "install",
          download_url: updateInfo.download_url,
          version: updateInfo.latest_version,
          download_size: updateInfo.download_size,
        }),
      });

      const json = await resp.json();
      if (!json.success) {
        setActionError(
          resolveErrorMessage(t, json.error, json.detail, "Failed to start update"),
        );
        setIsUpdating(false);
        return;
      }

      setStatusPolling(true);
    } catch (err) {
      if (!mountedRef.current) return;
      setActionError(err instanceof Error ? err.message : "Failed to start update");
      setIsUpdating(false);
    }
  };

  const rebootDevice = async () => {
    setActionError(null);
    try {
      const resp = await authFetch("/cgi-bin/quecmanager/system/reboot.sh", {
        method: "POST",
      });
      if (!resp.ok) {
        throw new Error(`reboot_failed: HTTP ${resp.status}`);
      }

      setUpdateStatus({ status: "rebooting", message: "Rebooting device..." });
      enterRebootFlow("software_update");
    } catch (err) {
      if (!mountedRef.current) return;
      setActionError(err instanceof Error ? err.message : "Failed to request reboot");
    }
  };

  const togglePrereleaseMutation = useMutation({
    mutationFn: async (enabled: boolean): Promise<void> => {
      const resp = await authFetch(CGI_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save_prerelease", enabled }),
      });

      const json = await resp.json();
      if (!json.success) {
        throw new Error(
          resolveErrorMessage(t, json.error, json.detail, "Failed to save preference"),
        );
      }
    },
    onSuccess: () => {
      // Re-check with new preference
      void infoQuery.refetch();
    },
  });

  const togglePrerelease = async (enabled: boolean) => {
    try {
      await togglePrereleaseMutation.mutateAsync(enabled);
    } catch (err) {
      if (!mountedRef.current) return;
      setActionError(err instanceof Error ? err.message : "Failed to save preference");
    }
  };

  const saveAutoUpdateMutation = useMutation({
    mutationFn: async ({
      enabled,
      time,
    }: {
      enabled: boolean;
      time: string;
    }): Promise<void> => {
      const resp = await authFetch(CGI_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save_auto_update", enabled, time }),
      });

      const json = await resp.json();
      if (!json.success) {
        throw new Error(
          resolveErrorMessage(t, json.error, json.detail, "Failed to save auto-update preference"),
        );
      }
    },
    onSuccess: () => {
      void infoQuery.refetch();
    },
  });

  const saveAutoUpdate = async (enabled: boolean, time: string) => {
    try {
      await saveAutoUpdateMutation.mutateAsync({ enabled, time });
    } catch (err) {
      if (!mountedRef.current) return;
      setActionError(
        err instanceof Error ? err.message : "Failed to save auto-update preference",
      );
    }
  };

  return {
    updateInfo,
    updateStatus,
    downloadState,
    isLoading: infoQuery.isLoading || infoQuery.isPending,
    isChecking,
    isUpdating,
    isDownloading,
    isInstallStalled,
    error,
    lastChecked,
    checkForUpdates,
    downloadUpdate,
    installStaged,
    installUpdate,
    rebootDevice,
    togglePrerelease,
    saveAutoUpdate,
  };
}
