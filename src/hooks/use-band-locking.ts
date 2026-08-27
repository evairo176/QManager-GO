"use client";

import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { authFetch } from "@/lib/auth-fetch";
import { resolveErrorMessage } from "@/lib/i18n/resolve-error";
import type {
  BandCategory,
  CurrentBands,
  FailoverState,
  BandCurrentResponse,
  BandLockResponse,
  FailoverToggleResponse,
  FailoverStatusResponse,
} from "@/types/band-locking";
import { bandArrayToString } from "@/types/band-locking";

// =============================================================================
// useBandLocking — Band Lock State, Lock/Unlock, & Failover Hook
// =============================================================================
// Manages the band locking lifecycle: fetching current locked bands,
// applying per-category band locks, unlocking all bands, and toggling
// the failover safety mechanism.
//
// After a successful band lock (when failover is enabled), the hook polls
// the lightweight failover_status.sh endpoint every 1s until the watcher
// process completes. This detects whether failover activated and updates
// the UI accordingly — without touching the modem.
//
// Backend endpoints:
//   GET  /cgi-bin/quecmanager/bands/current.sh           → locked bands + failover
//   GET  /cgi-bin/quecmanager/bands/failover_status.sh   → lightweight flag check
//   POST /cgi-bin/quecmanager/bands/lock.sh              → apply band lock
//   POST /cgi-bin/quecmanager/bands/failover_toggle.sh   → enable/disable failover
// =============================================================================

const CGI_BASE = "/cgi-bin/quecmanager/bands";
const FAILOVER_POLL_INTERVAL = 1000; // 1s — watcher sleeps 5s then checks

const QUERY_KEY = ["band-locking"] as const;

export interface UseBandLockingReturn {
  /** Currently locked/configured bands from the per-category band registers */
  currentBands: CurrentBands | null;
  /** Failover safety mechanism state */
  failover: FailoverState;
  /** True during initial data fetch */
  isLoading: boolean;
  /** Which band category is currently being locked/unlocked (null = idle) */
  lockingCategory: BandCategory | null;
  /** Error message from the last operation */
  error: string | null;
  /**
   * Lock specific bands for one category.
   * Sends AT+QNWPREFCFG command for the specified band type.
   * Re-fetches current bands on success.
   * @returns success boolean
   */
  lockBands: (category: BandCategory, bands: number[]) => Promise<boolean>;
  /**
   * Unlock all bands for one category by setting to full supported list.
   * Requires the supported band list (from useModemStatus) to be passed in.
   * @returns success boolean
   */
  unlockAll: (
    category: BandCategory,
    supportedBands: number[],
  ) => Promise<boolean>;
  /**
   * Toggle the failover safety mechanism on/off.
   * @returns success boolean
   */
  toggleFailover: (enabled: boolean) => Promise<boolean>;
  /** Manually refresh current bands + failover state */
  refresh: () => void;
}

export function useBandLocking(): UseBandLockingReturn {
  const { t } = useTranslation("errors");
  const queryClient = useQueryClient();
  const [lockingCategory, setLockingCategory] = useState<BandCategory | null>(null);

  const query = useQuery<BandCurrentResponse>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const resp = await authFetch(`${CGI_BASE}/current.sh?_t=${Date.now()}`);
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      }

      const data: BandCurrentResponse = await resp.json();

      if (!data.success) {
        throw new Error(
          resolveErrorMessage(t, data.error, data.detail, "Failed to fetch band configuration")
        );
      }

      return data;
    },
  });

  // Keep a ref to the latest query so the interval callback always refetches
  // the freshest instance (avoids stale closures).
  const queryRef = useRef(query);
  queryRef.current = query;

  // ---------------------------------------------------------------------------
  // Failover status polling (lightweight — no modem contact)
  // ---------------------------------------------------------------------------
  // Started after a successful band lock when failover is enabled.
  // Polls failover_status.sh until the watcher process exits, then:
  //   - Updates failover state from the response
  //   - If activated → re-fetches current.sh to get the reset bands
  //   - Stops polling
  // ---------------------------------------------------------------------------
  const failoverPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopFailoverPolling = () => {
    if (failoverPollRef.current) {
      clearInterval(failoverPollRef.current);
      failoverPollRef.current = null;
    }
  };

  const startFailoverPolling = () => {
    stopFailoverPolling();
    failoverPollRef.current = setInterval(async () => {
      try {
        const resp = await authFetch(`${CGI_BASE}/failover_status.sh`);
        if (!resp.ok) return; // Silent fail — retry next interval

        const data: FailoverStatusResponse = await resp.json();

        // Watcher still running — keep polling
        if (data.watcher_running) return;

        // Watcher finished — stop polling and update state
        stopFailoverPolling();

        const failover: FailoverState = {
          enabled: data.enabled,
          activated: data.activated,
        };
        queryClient.setQueryData<BandCurrentResponse>(QUERY_KEY, (prev) =>
          prev ? { ...prev, failover } : prev
        );

        // If failover activated, bands were reset — re-fetch to get new values
        if (data.activated) {
          void queryRef.current.refetch();
        }
      } catch {
        // Network error — silent, retry next interval
      }
    }, FAILOVER_POLL_INTERVAL);
  };

  const lockMutation = useMutation({
    mutationFn: async (args: {
      category: BandCategory;
      bands: number[];
    }): Promise<boolean> => {
      const { category, bands } = args;
      if (bands.length === 0) {
        throw new Error("No bands selected");
      }

      const resp = await authFetch(`${CGI_BASE}/lock.sh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          band_type: category,
          bands: bandArrayToString(bands),
        }),
      });

      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      }

      const data: BandLockResponse = await resp.json();

      if (!data.success) {
        throw new Error(
          resolveErrorMessage(t, data.error, data.detail, "Failed to apply band lock")
        );
      }

      // Re-fetch current state to confirm the lock took effect
      await queryRef.current.refetch();

      // If failover is armed (enabled + watcher spawned), start polling
      // for watcher completion so we detect activation in real-time
      if (data.failover_armed) {
        // Clear any previous activated flag from UI — watcher just started fresh
        queryClient.setQueryData<BandCurrentResponse>(QUERY_KEY, (prev) =>
          prev
            ? { ...prev, failover: { ...prev.failover, activated: false } }
            : prev
        );
        startFailoverPolling();
      }

      return true;
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (enabled: boolean): Promise<boolean> => {
      const resp = await authFetch(`${CGI_BASE}/failover_toggle.sh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });

      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      }

      const data: FailoverToggleResponse = await resp.json();

      if (!data.success) {
        throw new Error(
          resolveErrorMessage(t, data.error, data.detail, "Failed to toggle failover")
        );
      }

      // Optimistic update
      queryClient.setQueryData<BandCurrentResponse>(QUERY_KEY, (prev) =>
        prev
          ? {
              ...prev,
              failover: { ...prev.failover, enabled: data.enabled ?? enabled },
            }
          : prev
      );
      return true;
    },
  });

  const lockBands = async (
    category: BandCategory,
    bands: number[]
  ): Promise<boolean> => {
    setLockingCategory(category);
    try {
      return await lockMutation.mutateAsync({ category, bands });
    } catch {
      return false;
    } finally {
      setLockingCategory(null);
    }
  };

  const unlockAll = async (
    category: BandCategory,
    supportedBands: number[],
  ): Promise<boolean> => {
    if (supportedBands.length === 0) {
      return false;
    }
    // Locking to ALL supported bands = unlock all
    return lockBands(category, supportedBands);
  };

  const toggleFailover = async (enabled: boolean): Promise<boolean> => {
    try {
      return await toggleMutation.mutateAsync(enabled);
    } catch {
      return false;
    }
  };

  return {
    currentBands: query.data?.current ?? null,
    failover: query.data?.failover ?? { enabled: false, activated: false },
    isLoading: query.isLoading || query.isPending,
    lockingCategory,
    error:
      query.error?.message ??
      lockMutation.error?.message ??
      toggleMutation.error?.message ??
      null,
    lockBands,
    unlockAll,
    toggleFailover,
    refresh: () => {
      void query.refetch();
    },
  };
}
