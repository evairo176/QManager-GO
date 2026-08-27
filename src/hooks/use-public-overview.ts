"use client";

import { useQuery } from "@tanstack/react-query";
import { useLiveInterval } from "@/components/realtime-provider";
import type { PublicOverview } from "@/types/public-overview";

// =============================================================================
// usePublicOverview — Polling hook for the unauthenticated overview card.
// =============================================================================
// Mirrors useModemStatus' shape and lifecycle but uses plain `fetch` (NOT
// authFetch). The endpoint is unauthenticated by design; sending a session
// cookie would be harmless but pointless.
//
// Resilience: tracks consecutive fetch failures and applies exponential
// backoff once a threshold is crossed. The component consumes the failure
// count to swap from "stale data + chip" to a full EmptyState once misses
// pile up, so users aren't left staring at indefinitely stale numbers.
// =============================================================================

const FETCH_ENDPOINT = "/cgi-bin/quecmanager/public/overview.sh";
// Pre-login cadence: a passerby on the landing page does not need 0.5 Hz
// refresh. 5 s keeps the card feeling live without hammering the device CGI.
const POLL_INTERVAL = 5000;
const MAX_POLL_INTERVAL = 60_000;
// First N failures keep the base interval; after that, double per failure.
const BACKOFF_THRESHOLD = 6;
const STALE_THRESHOLD_SECONDS = 15;

function computeNextInterval(failures: number, base: number): number {
  if (failures < BACKOFF_THRESHOLD) return base;
  const exp = Math.min(failures - BACKOFF_THRESHOLD + 1, 4);
  return Math.min(base * 2 ** exp, MAX_POLL_INTERVAL);
}

export interface UsePublicOverviewReturn {
  data: PublicOverview | null;
  isLoading: boolean;
  isStale: boolean;
  error: string | null;
  consecutiveFailures: number;
  refresh: () => void;
}

export function usePublicOverview(): UsePublicOverviewReturn {
  const livePoll = useLiveInterval(POLL_INTERVAL);

  const query = useQuery<PublicOverview>({
    queryKey: ["public-overview"],
    queryFn: async () => {
      const response = await fetch(FETCH_ENDPOINT, {
        cache: "no-store",
        credentials: "omit",
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return (await response.json()) as PublicOverview;
    },
    // Backoff: once failures cross the threshold, double the poll interval per
    // failure (capped). A failureCount reset on success restores the base rate.
    refetchInterval: (q) =>
      typeof document !== "undefined" && document.hidden
        ? false // pause polling while the tab is hidden
        : livePoll === false
          ? false // realtime OFF — stop polling
          : computeNextInterval(q.state.fetchFailureCount, livePoll),
    retry: false,
  });

  const data = query.data ?? null;

  // Staleness: compare the JSON timestamp to current time. Non-ok states
  // (setup_required / unavailable) are explicit backend states, not stale data.
  let isStale = false;
  if (data && data.state === "ok") {
    const now = Math.floor(Date.now() / 1000);
    isStale = now - data.timestamp > STALE_THRESHOLD_SECONDS;
  } else if (query.isError) {
    // On fetch failure, data (if any) is stale by definition.
    isStale = true;
  }

  const error = query.error
    ? query.error instanceof Error
      ? query.error.message
      : "Failed to fetch overview"
    : null;

  return {
    data,
    isLoading: query.isLoading || query.isPending,
    isStale,
    error,
    consecutiveFailures: query.failureCount,
    refresh: () => {
      void query.refetch();
    },
  };
}
