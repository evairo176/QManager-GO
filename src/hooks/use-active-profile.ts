"use client";

import { useMemo, useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { authFetch } from "@/lib/auth-fetch";
import { useLiveInterval } from "@/components/realtime-provider";
import type { ProfileSummary, ProfileListResponse } from "@/types/sim-profile";
import {
  resolveScheduledScenario,
  nextChangeAt as computeNextChangeAt,
} from "@/lib/scenario-schedule";

const CGI_BASE = "/cgi-bin/quecmanager/profiles";
const POLL_INTERVAL_MS = 30_000;
// Recompute the resolved/next-change scenario every minute so the locked badge
// advances at block boundaries without a network round-trip.
const TICK_INTERVAL_MS = 60_000;

const QUERY_KEY = ["active-profile"] as const;

export interface UseActiveProfileReturn {
  activeProfile: ProfileSummary | null;
  isVerizonActive: boolean;
  isLoading: boolean;
  refresh: () => void;
  // --- Scenario schedule lock (display-only; device cron is authoritative) ---
  /** True when the active profile has scenario.schedule.enabled. */
  scheduleLocked: boolean;
  /** Scenario id dictated by the schedule right now (or the default fallback). */
  scheduledScenarioId: string | null;
  /** "HH:MM" of the next scheduled transition, or null. */
  nextChangeAt: string | null;
  /** Active profile name, for the lock hint copy. */
  lockProfileName: string | null;
}

export function useActiveProfile(): UseActiveProfileReturn {
  const queryClient = useQueryClient();

  const liveInterval = useLiveInterval(POLL_INTERVAL_MS);

  const query = useQuery<ProfileSummary | null>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      // Skip fetch when the tab is hidden — same guard as the original. We
      // return the last cached value so polling never clears the active
      // profile just because the tab lost visibility.
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return queryClient.getQueryData<ProfileSummary | null>(QUERY_KEY) ?? null;
      }

      const resp = await authFetch(`${CGI_BASE}/list.sh`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      const data: ProfileListResponse = await resp.json();

      const active = data.active_profile_id
        ? (data.profiles ?? []).find((p) => p.id === data.active_profile_id) ?? null
        : null;

      return active;
    },
    refetchInterval: liveInterval,
  });

  // Minute tick to advance the scheduled-scenario resolution at block edges.
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), TICK_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  const activeProfile = query.data ?? null;
  const binding = activeProfile?.scenario ?? null;
  const scheduleLocked = !!binding?.schedule.enabled;

  const scheduledScenarioId = useMemo(() => {
    if (!binding || !scheduleLocked) return null;
    return resolveScheduledScenario(now, binding.schedule, binding.default);
  }, [binding, scheduleLocked, now]);

  const nextChangeAt = useMemo(() => {
    if (!binding || !scheduleLocked) return null;
    return computeNextChangeAt(now, binding.schedule, binding.default);
  }, [binding, scheduleLocked, now]);

  return {
    activeProfile,
    isVerizonActive: activeProfile?.mno === "Verizon",
    isLoading: query.isLoading || query.isPending,
    refresh: () => {
      void query.refetch();
    },
    scheduleLocked,
    scheduledScenarioId,
    nextChangeAt,
    lockProfileName: scheduleLocked ? activeProfile?.name ?? null : null,
  };
}
