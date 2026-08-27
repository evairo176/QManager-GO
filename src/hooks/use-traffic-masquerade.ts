"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { authFetch } from "@/lib/auth-fetch";
import { resolveErrorMessage } from "@/lib/i18n/resolve-error";
import { useLiveInterval } from "@/components/realtime-provider";
import type {
  MasqueradeTestResult,
  TrafficMasqueradeResponse,
  TrafficMasqueradeSettings,
} from "@/types/video-optimizer";

const API_URL = "/cgi-bin/quecmanager/network/video_optimizer.sh";

export function useTrafficMasquerade() {
  const { t } = useTranslation("errors");
  const [isSaving, setIsSaving] = useState(false);
  const [isUninstalling, setIsUninstalling] = useState(false);
  const [testResult, setTestResult] = useState<MasqueradeTestResult>({
    status: "idle",
  });

  const liveInterval = useLiveInterval(1000);

  const query = useQuery<TrafficMasqueradeResponse>({
    queryKey: ["traffic-masquerade"],
    queryFn: async () => {
      const response = await authFetch(`${API_URL}?section=masquerade`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    },
    // Poll for live stats while service is running
    refetchInterval: (q) =>
      (q.state.data as TrafficMasqueradeResponse | undefined)?.status === "running"
        ? liveInterval
        : false,
  });

  const data = query.data;
  const settings: TrafficMasqueradeSettings | null =
    data && data.success
      ? {
          enabled: data.enabled,
          other_enabled: data.other_enabled,
          status: data.status,
          uptime: data.uptime,
          packets_processed: data.packets_processed,
          sni_domain: data.sni_domain,
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
    mutationFn: async ({
      enabled,
      sniDomain,
    }: {
      enabled: boolean;
      sniDomain: string;
    }): Promise<boolean> => {
      const response = await authFetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_masquerade",
          enabled,
          sni_domain: sniDomain,
        }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      if (!data.success) {
        throw new Error(
          resolveErrorMessage(t, undefined, data.detail, "Failed to save settings"),
        );
      }
      return true;
    },
    onSuccess: () => {
      void query.refetch();
    },
  });

  const saveSettings = async (
    enabled: boolean,
    sniDomain: string,
  ): Promise<boolean> => {
    setIsSaving(true);
    try {
      return await saveMutation.mutateAsync({ enabled, sniDomain });
    } catch {
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const runTest = async () => {
    setTestResult({ status: "running" });

    try {
      const response = await authFetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test_masquerade" }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();

      if (!data.success) {
        setTestResult({
          status: "error",
          error: data.error || "Test failed",
        });
        return;
      }

      setTestResult({
        status: "complete",
        injected: data.injected,
        packets: data.packets,
        message: data.message,
      });
    } catch (err) {
      setTestResult({
        status: "error",
        error: err instanceof Error ? err.message : "Test failed",
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
    testResult,
    runTest,
    runUninstall,
    refresh: (..._args: unknown[]) => {
      void query.refetch();
    },
  };
}
