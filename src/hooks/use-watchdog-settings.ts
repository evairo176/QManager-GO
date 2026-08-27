"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { authFetch } from "@/lib/auth-fetch";
import { resolveErrorMessage } from "@/lib/i18n/resolve-error";
import { useLiveInterval } from "@/components/realtime-provider";
import type { PingProfile } from "@/types/modem-status";

const CGI_ENDPOINT = "/cgi-bin/quecmanager/monitoring/watchdog.sh";

// ─── Types ─────────────────────────────────────────────────────────────────

export interface WatchdogSettings {
  enabled: boolean;
  fail_threshold: number;
  check_interval: number;
  cooldown: number;
  tier1_enabled: boolean;
  tier2_enabled: boolean;
  tier3_enabled: boolean;
  tier4_enabled: boolean;
  backup_sim_slot: number | null;
  max_reboots_per_hour: number;
  quality_enabled: boolean;
  quality_consecutive: number;
  ssr_aware: boolean;
  ssr_grace: number;
  primary_recheck_enabled: boolean;
  primary_recheck_interval: number;
  probe_profile: PingProfile;
  interval_override: number | null;
}

export type WatchdogSavePayload = WatchdogSettings & {
  action: "save_settings";
};

export interface WatchdogQualityThresholds {
  latency_ms: number;
  loss_pct: number;
  latency_preset: string;
  loss_preset: string;
}

export interface WatchdogLiveStatus {
  timestamp: number;
  enabled: boolean;
  state: string;
  current_tier: number;
  failure_count: number;
  last_recovery_time: number | null;
  last_recovery_tier: number | null;
  total_recoveries: number;
  cooldown_remaining: number;
  sim_failover_active: boolean;
  original_sim_slot: number | null;
  current_sim_slot: number | null;
  reboots_this_hour: number;
  quality_breach_count?: number;
  quality_enabled?: boolean;
  last_recovery_reason?: string;
  ssr_hold?: boolean;
  last_ssr_detected?: number | null;
}

export interface SimFailoverInfo {
  active: boolean;
  original_slot?: number;
  current_slot?: number;
  switched_at?: number;
}

export interface SimSwapInfo {
  detected: boolean;
  matching_profile_id?: string;
  matching_profile_name?: string;
}

interface WatchdogGetResponse {
  success: boolean;
  settings?: WatchdogSettings;
  probe_profile?: PingProfile;
  interval_override?: number | null;
  effective_interval?: number;
  quality_thresholds?: WatchdogQualityThresholds | null;
  status?: WatchdogLiveStatus | null;
  sim_failover?: SimFailoverInfo | null;
  sim_swap?: SimSwapInfo | null;
  auto_disabled?: boolean;
  error?: string;
  reason?: string;
}

export interface UseWatchdogSettingsReturn {
  settings: WatchdogSettings | null;
  effectiveInterval: number | null;
  qualityThresholds: WatchdogQualityThresholds | null;
  status: WatchdogLiveStatus | null;
  simFailover: SimFailoverInfo | null;
  simSwap: SimSwapInfo | null;
  autoDisabled: boolean;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  saveSettings: (payload: WatchdogSavePayload) => Promise<boolean>;
  dismissSimSwap: () => Promise<boolean>;
  revertSim: () => Promise<boolean>;
  refresh: () => void;
}

// ─── Hook ──────────────────────────────────────────────────────────────────

export function useWatchdogSettings(): UseWatchdogSettingsReturn {
  const { t } = useTranslation("errors");
  const [isSaving, setIsSaving] = useState(false);

  const liveInterval = useLiveInterval(30_000);

  const query = useQuery<WatchdogGetResponse>({
    queryKey: ["watchdog-settings"],
    queryFn: async () => {
      const resp = await authFetch(CGI_ENDPOINT);
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      }
      return resp.json();
    },
    refetchInterval: liveInterval,
  });

  const json = query.data;
  const settings: WatchdogSettings | null = json?.settings
    ? {
        ...json.settings,
        probe_profile: json.probe_profile ?? "relaxed",
        interval_override: json.interval_override ?? null,
      }
    : null;

  const error = query.error
    ? query.error.message
    : json && !json.success
      ? resolveErrorMessage(t, json.error, json.reason, "Failed to fetch watchdog settings")
      : null;

  // ─── Save settings ────────────────────────────────────────────────────────

  const saveMutation = useMutation({
    mutationFn: async (payload: WatchdogSavePayload): Promise<boolean> => {
      const resp = await authFetch(CGI_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      }

      const json = await resp.json();
      if (!json.success) {
        throw new Error(
          resolveErrorMessage(t, json.error, json.reason, "Failed to save watchdog settings"),
        );
      }
      return true;
    },
    onSuccess: () => {
      void query.refetch();
    },
  });

  const saveSettings = async (payload: WatchdogSavePayload): Promise<boolean> => {
    setIsSaving(true);
    try {
      return await saveMutation.mutateAsync(payload);
    } catch (err) {
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Dismiss SIM swap notification ────────────────────────────────────────

  const dismissMutation = useMutation({
    mutationFn: async (): Promise<boolean> => {
      const resp = await authFetch(CGI_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "dismiss_sim_swap" }),
      });
      if (!resp.ok) return false;
      const json = await resp.json();
      return json.success === true;
    },
    onSuccess: () => {
      void query.refetch();
    },
  });

  const dismissSimSwap = async (): Promise<boolean> => {
    try {
      return await dismissMutation.mutateAsync();
    } catch {
      return false;
    }
  };

  // ─── Request SIM revert (watchcat picks up the flag) ──────────────────────

  const revertMutation = useMutation({
    mutationFn: async (): Promise<boolean> => {
      const resp = await authFetch(CGI_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "revert_sim" }),
      });
      if (!resp.ok) return false;
      const json = await resp.json();
      return json.success === true;
    },
    onSuccess: () => {
      void query.refetch();
    },
  });

  const revertSim = async (): Promise<boolean> => {
    try {
      return await revertMutation.mutateAsync();
    } catch {
      return false;
    }
  };

  return {
    settings,
    effectiveInterval:
      typeof json?.effective_interval === "number"
        ? json.effective_interval
        : null,
    qualityThresholds: json?.quality_thresholds ?? null,
    status: json?.status && json.status.timestamp ? json.status : null,
    simFailover: json?.sim_failover ?? null,
    simSwap: json?.sim_swap ?? null,
    autoDisabled: json?.auto_disabled === true,
    isLoading: query.isLoading || query.isPending,
    isSaving,
    error,
    saveSettings,
    dismissSimSwap,
    revertSim,
    refresh: () => {
      void query.refetch();
    },
  };
}
