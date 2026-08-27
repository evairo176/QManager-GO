"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { authFetch } from "@/lib/auth-fetch";
import { resolveErrorMessage } from "@/lib/i18n/resolve-error";
import type { HostlistResponse } from "@/types/video-optimizer";

const API_URL = "/cgi-bin/quecmanager/network/video_optimizer.sh";

export function useCdnHostlist() {
  const { t } = useTranslation("errors");

  const query = useQuery<HostlistResponse>({
    queryKey: ["cdn-hostlist"],
    queryFn: async () => {
      const response = await authFetch(`${API_URL}?section=hostlist`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data: HostlistResponse = await response.json();

      if (!data.success) {
        throw new Error("Failed to load hostname list");
      }

      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (newDomains: string[]): Promise<boolean> => {
      const response = await authFetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save_hostlist", domains: newDomains }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      if (!data.success) {
        throw new Error(
          resolveErrorMessage(t, undefined, data.detail, "Failed to save hostname list")
        );
      }
      return true;
    },
    onSuccess: () => {
      void query.refetch();
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async (): Promise<boolean> => {
      const response = await authFetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restore_hostlist" }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      if (!data.success) {
        throw new Error(
          resolveErrorMessage(t, undefined, data.detail, "Failed to restore defaults")
        );
      }
      return true;
    },
    onSuccess: () => {
      void query.refetch();
    },
  });

  const saveHostlist = async (newDomains: string[]): Promise<boolean> => {
    try {
      return await saveMutation.mutateAsync(newDomains);
    } catch (err) {
      return false;
    }
  };

  const restoreDefaults = async (): Promise<boolean> => {
    try {
      return await restoreMutation.mutateAsync();
    } catch {
      return false;
    }
  };

  return {
    domains: query.data?.domains ?? [],
    defaultDomains: query.data?.default_domains ?? [],
    count: query.data?.count ?? 0,
    isLoading: query.isLoading || query.isPending,
    isSaving: saveMutation.isPending || restoreMutation.isPending,
    isRestoring: restoreMutation.isPending,
    error:
      query.error?.message ??
      saveMutation.error?.message ??
      restoreMutation.error?.message ??
      null,
    saveHostlist,
    restoreDefaults,
    refresh: () => {
      void query.refetch();
    },
  };
}
