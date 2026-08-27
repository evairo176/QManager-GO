"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { authFetch } from "@/lib/auth-fetch";

// =============================================================================
// useMtuSettings — One-Shot MTU Fetch & Save Hook (TanStack Query)
// =============================================================================
// Backend: GET/POST /cgi-bin/quecmanager/network/mtu.sh
// =============================================================================

const CGI_ENDPOINT = "/cgi-bin/quecmanager/network/mtu.sh";

export interface MtuSettingsData {
  isEnabled: boolean;
  currentValue: number;
}

export interface UseMtuSettingsReturn {
  data: MtuSettingsData | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  saveMtu: (mtu: number) => Promise<boolean>;
  disableMtu: () => Promise<boolean>;
  refresh: () => void;
}

export function useMtuSettings(): UseMtuSettingsReturn {
  const [isSaving, setIsSaving] = useState(false);

  const query = useQuery<{ success: boolean; is_enabled: boolean; current_value: number }>({
    queryKey: ["mtu-settings"],
    queryFn: async () => {
      const resp = await authFetch(CGI_ENDPOINT);
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      }
      const json = await resp.json();
      if (!json.success) {
        throw new Error(json.error || "Failed to fetch MTU settings");
      }
      return json;
    },
  });

  const data: MtuSettingsData | null = query.data
    ? { isEnabled: query.data.is_enabled, currentValue: query.data.current_value }
    : null;

  const error = query.error ? query.error.message : null;

  // ─── Save new MTU value ───────────────────────────────────────────────────

  const saveMutation = useMutation({
    mutationFn: async (mtu: number) => {
      const resp = await authFetch(CGI_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mtu }),
      });
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      }
      const json = await resp.json();
      if (!json.success) {
        throw new Error(json.detail || json.error || "Failed to apply MTU");
      }
    },
    onSuccess: () => void query.refetch(),
  });

  // ─── Disable custom MTU ───────────────────────────────────────────────────

  const disableMutation = useMutation({
    mutationFn: async () => {
      const resp = await authFetch(CGI_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mtu: "disable" }),
      });
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      }
      const json = await resp.json();
      if (!json.success) {
        throw new Error(json.detail || json.error || "Failed to disable MTU");
      }
    },
    onSuccess: () => void query.refetch(),
  });

  const saveMtu = async (mtu: number): Promise<boolean> => {
    setIsSaving(true);
    try {
      await saveMutation.mutateAsync(mtu);
      return true;
    } catch (err) {
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const disableMtu = async (): Promise<boolean> => {
    setIsSaving(true);
    try {
      await disableMutation.mutateAsync();
      return true;
    } catch {
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  return {
    data,
    isLoading: query.isLoading || query.isPending,
    isSaving,
    error,
    saveMtu,
    disableMtu,
    refresh: () => void query.refetch(),
  };
}
