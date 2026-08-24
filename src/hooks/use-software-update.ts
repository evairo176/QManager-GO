"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { authFetch } from "@/lib/auth-fetch";
import { resolveErrorMessage } from "@/lib/i18n/resolve-error";
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
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({ status: "idle" });
  const [isLoading, setIsLoading] = useState(true);
  const [isChecking, setIsChecking] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadState, setDownloadState] = useState<DownloadState | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isInstallStalled, setIsInstallStalled] = useState(false);
  const [lastChecked, setLastChecked] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const installStallTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastStatusSignatureRef = useRef<string>("");

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
      if (pollRef.current) clearInterval(pollRef.current);
      clearInstallStallTimer();
    };
  }, [clearInstallStallTimer]);

  // ---------------------------------------------------------------------------
  // Poll download status during background download
  // ---------------------------------------------------------------------------
  const startDownloadPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);

    pollRef.current = setInterval(async () => {
      try {
        const resp = await authFetch(`${CGI_ENDPOINT}?action=status`);
        if (!resp.ok) return;

        const json = await resp.json();
        if (!mountedRef.current) return;

        setDownloadState(json as DownloadState);

        if (json.status === "ready") {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          setIsDownloading(false);
        }

        if (json.status === "error") {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          setIsDownloading(false);
          setError(resolveErrorMessage(t, undefined, json.message, "Download failed"));
        }
      } catch {
        // Silently retry on next interval
      }
    }, POLL_INTERVAL);
  }, [t]);

  // ---------------------------------------------------------------------------
  // Fetch update info from CGI
  // ---------------------------------------------------------------------------
  const fetchUpdateInfo = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    setError(null);

    try {
      const resp = await authFetch(CGI_ENDPOINT);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);

      const json = await resp.json();
      if (!mountedRef.current) return;

      if (!json.success) {
        setError(resolveErrorMessage(t, json.error, json.detail, "Failed to check for updates"));
        return;
      }

      setUpdateInfo(json as UpdateInfo);

      // Sync download state from backend
      const info = json as UpdateInfo;
      if (info.download_state) {
        setDownloadState(info.download_state);
        if (info.download_state.status === "downloading" || info.download_state.status === "verifying") {
          setIsDownloading(true);
          startDownloadPolling();
        }
      }

      // Update last checked timestamp
      const now = new Date().toISOString();
      localStorage.setItem(LAST_CHECKED_KEY, now);
      setLastChecked(now);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err.message : "Failed to check for updates");
    } finally {
      if (mountedRef.current && !silent) setIsLoading(false);
    }
  }, [startDownloadPolling, t]);

  // Fetch on mount
  useEffect(() => {
    fetchUpdateInfo();
  }, [fetchUpdateInfo]);

  // ---------------------------------------------------------------------------
  // Poll update status during install/rollback
  // ---------------------------------------------------------------------------
  const startPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);

    pollRef.current = setInterval(async () => {
      try {
        const resp = await authFetch(`${CGI_ENDPOINT}?action=status`);
        if (!resp.ok) return;

        const json: UpdateStatus = await resp.json();
        if (!mountedRef.current) return;

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
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          enterRebootFlow("software_update");
        }

        if (json.status === "error") {
          clearInstallStallTimer();
          setIsInstallStalled(false);
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          setIsUpdating(false);
          setError(resolveErrorMessage(t, undefined, json.message, "Update failed"));
        }
      } catch {
        clearInstallStallTimer();
        // Device may be rebooting — stop polling and redirect
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;

        enterRebootFlow("software_update");
      }
    }, POLL_INTERVAL);
  }, [armInstallStallTimer, clearInstallStallTimer, t]);

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------
  const checkForUpdates = useCallback(async () => {
    setIsChecking(true);
    await fetchUpdateInfo(true);
    if (mountedRef.current) setIsChecking(false);
  }, [fetchUpdateInfo]);

  const downloadUpdate = useCallback(async (version?: string) => {
    const targetVersion = version || updateInfo?.latest_version;
    if (!targetVersion) return;

    setError(null);
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
        setError(resolveErrorMessage(t, json.error, json.detail, "Failed to start download"));
        setIsDownloading(false);
        setDownloadState(null);
        return;
      }

      startDownloadPolling();
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err.message : "Failed to start download");
      setIsDownloading(false);
      setDownloadState(null);
    }
  }, [updateInfo, startDownloadPolling, t]);

  const installStaged = useCallback(async () => {
    setError(null);
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
        setError(resolveErrorMessage(t, json.error, json.detail, "Failed to start installation"));
        setIsUpdating(false);
        return;
      }

      startPolling();
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err.message : "Failed to start installation");
      setIsUpdating(false);
    }
  }, [startPolling, t]);

  const installUpdate = useCallback(async () => {
    if (!updateInfo?.download_url || !updateInfo?.latest_version) return;

    setError(null);
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
        setError(resolveErrorMessage(t, json.error, json.detail, "Failed to start update"));
        setIsUpdating(false);
        return;
      }

      startPolling();
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err.message : "Failed to start update");
      setIsUpdating(false);
    }
  }, [updateInfo, startPolling, t]);

  const rebootDevice = useCallback(async () => {
    setError(null);
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
      setError(err instanceof Error ? err.message : "Failed to request reboot");
    }
  }, []);

  const togglePrerelease = useCallback(async (enabled: boolean) => {
    try {
      const resp = await authFetch(CGI_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save_prerelease", enabled }),
      });

      const json = await resp.json();
      if (!json.success) {
        setError(resolveErrorMessage(t, json.error, json.detail, "Failed to save preference"));
        return;
      }

      // Re-check with new preference
      await fetchUpdateInfo(true);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err.message : "Failed to save preference");
    }
  }, [fetchUpdateInfo, t]);

  const saveAutoUpdate = useCallback(async (enabled: boolean, time: string) => {
    try {
      const resp = await authFetch(CGI_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save_auto_update", enabled, time }),
      });

      const json = await resp.json();
      if (!json.success) {
        setError(resolveErrorMessage(t, json.error, json.detail, "Failed to save auto-update preference"));
        return;
      }

      await fetchUpdateInfo(true);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err.message : "Failed to save auto-update preference");
    }
  }, [fetchUpdateInfo, t]);

  return {
    updateInfo,
    updateStatus,
    downloadState,
    isLoading,
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
