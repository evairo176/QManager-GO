"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { authFetch } from "@/lib/auth-fetch";
import { resolveErrorMessage } from "@/lib/i18n/resolve-error";
import type {
  VideoOptimizerResponse,
  VideoOptimizerSettings,
  VerifyResult,
  InstallResult,
} from "@/types/video-optimizer";

const API_URL = "/cgi-bin/quecmanager/network/video_optimizer.sh";

export function useVideoOptimizer() {
  const { t } = useTranslation("errors");
  const [isSaving, setIsSaving] = useState(false);
  const [isUninstalling, setIsUninstalling] = useState(false);
  const [verifyResult, setVerifyResult] = useState<VerifyResult>({
    success: true,
    status: "idle",
  });
  const [installResult, setInstallResult] = useState<InstallResult>({
    success: true,
    status: "idle",
  });
  const [verifyPolling, setVerifyPolling] = useState(false);
  const [installPolling, setInstallPolling] = useState(false);

  const query = useQuery<VideoOptimizerResponse>({
    queryKey: ["video-optimizer"],
    queryFn: async () => {
      const response = await authFetch(API_URL);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    },
    // Poll for live stats while service is running
    refetchInterval: (q) =>
      (q.state.data as VideoOptimizerResponse | undefined)?.status === "running"
        ? 1000
        : false,
  });

  const data = query.data;
  const settings: VideoOptimizerSettings | null =
    data && data.success
      ? {
          enabled: data.enabled,
          other_enabled: data.other_enabled,
          status: data.status,
          uptime: data.uptime,
          packets_processed: data.packets_processed,
          domains_loaded: data.domains_loaded,
          desync_repeats: data.desync_repeats,
          binary_installed: data.binary_installed,
          kernel_module_loaded: data.kernel_module_loaded,
        }
      : null;

  const error = query.error
    ? query.error instanceof Error
      ? query.error.message
      : "Failed to fetch settings"
    : data && !data.success
      ? "Failed to load settings"
      : null;

  const saveMutation = useMutation({
    mutationFn: async (input: {
      enabled: boolean;
      desync_repeats?: number;
    }): Promise<boolean> => {
      const body: {
        action: "save";
        enabled: boolean;
        desync_repeats?: number;
      } = {
        action: "save",
        enabled: input.enabled,
      };
      if (typeof input.desync_repeats === "number") {
        body.desync_repeats = input.desync_repeats;
      }

      const response = await authFetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      if (!data.success) {
        throw new Error(
          resolveErrorMessage(t, data.error, data.detail, "Failed to save settings"),
        );
      }
      return true;
    },
    onSuccess: () => {
      // Silent re-fetch to get updated status
      void query.refetch();
    },
  });

  const saveSettings = async (input: {
    enabled: boolean;
    desync_repeats?: number;
  }): Promise<boolean> => {
    setIsSaving(true);
    try {
      return await saveMutation.mutateAsync(input);
    } catch {
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Verify (long-running, polled) ────────────────────────────────────────

  const verifyStatusQuery = useQuery<VerifyResult>({
    queryKey: ["video-optimizer-verify"],
    queryFn: async () => {
      const response = await authFetch(`${API_URL}?action=verify_status`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    },
    enabled: verifyPolling,
    refetchInterval: (q) =>
      q.state.data &&
      (q.state.data.status === "complete" || q.state.data.status === "error")
        ? false
        : 2000,
    refetchIntervalInBackground: true,
  });

  // Reflect verify status into local state on every poll; stop polling and
  // refresh settings once the verify reaches a terminal state.
  useEffect(() => {
    const v = verifyStatusQuery.data;
    if (!v) return;
    setVerifyResult(v);
    if (v.status === "complete" || v.status === "error") {
      setVerifyPolling(false);
      // Refresh settings to get updated status/stats
      void query.refetch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verifyStatusQuery.data]);

  const runVerification = async () => {
    setVerifyResult({ success: true, status: "running" });
    setVerifyPolling(false);
    try {
      const response = await authFetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify" }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setVerifyPolling(true);
    } catch (err) {
      setVerifyResult({
        success: false,
        status: "error",
        error: err instanceof Error ? err.message : "Failed to start verification",
      });
    }
  };

  // ─── Install (long-running, polled) ───────────────────────────────────────

  const installStatusQuery = useQuery<InstallResult>({
    queryKey: ["video-optimizer-install"],
    queryFn: async () => {
      const response = await authFetch(`${API_URL}?action=install_status`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    },
    enabled: installPolling,
    refetchInterval: (q) =>
      q.state.data &&
      (q.state.data.status === "complete" || q.state.data.status === "error")
        ? false
        : 2000,
    refetchIntervalInBackground: true,
  });

  // Reflect install status into local state on every poll; stop polling and
  // refresh settings once the install reaches a terminal state.
  useEffect(() => {
    const v = installStatusQuery.data;
    if (!v) return;
    setInstallResult(v);
    if (v.status === "complete" || v.status === "error") {
      setInstallPolling(false);
      // Refresh settings to pick up binary_installed change
      void query.refetch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [installStatusQuery.data]);

  const runInstall = async () => {
    setInstallResult({
      success: true,
      status: "running",
      message: "Starting installation...",
    });
    setInstallPolling(false);
    try {
      const response = await authFetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "install" }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setInstallPolling(true);
    } catch (err) {
      setInstallResult({
        success: false,
        status: "error",
        message: err instanceof Error ? err.message : "Failed to start installation",
      });
    }
  };

  const uninstallMutation = useMutation({
    mutationFn: async (): Promise<boolean> => {
      const response = await authFetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "uninstall" }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (!data.success) {
        throw new Error(
          resolveErrorMessage(t, undefined, data.detail, "Failed to uninstall"),
        );
      }
      return true;
    },
    onSuccess: () => {
      void query.refetch();
    },
  });

  const runUninstall = async (): Promise<boolean> => {
    setIsUninstalling(true);
    try {
      return await uninstallMutation.mutateAsync();
    } catch {
      return false;
    } finally {
      setIsUninstalling(false);
    }
  };

  return {
    settings,
    isLoading: query.isLoading || query.isPending,
    isSaving,
    isUninstalling,
    error,
    saveSettings,
    verifyResult,
    runVerification,
    installResult,
    runInstall,
    runUninstall,
    refresh: (..._args: unknown[]) => {
      void query.refetch();
    },
  };
}
