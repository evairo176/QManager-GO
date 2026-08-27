"use client";

import { useQuery } from "@tanstack/react-query";
import { authFetch } from "@/lib/auth-fetch";
import { useLiveInterval } from "@/components/realtime-provider";
import type { PingHistoryEntry } from "@/types/modem-status";

// =============================================================================
// useLatencyHistory — Polling Hook for Ping History Chart
// =============================================================================
// Fetches the ping history NDJSON (converted to JSON array by the CGI endpoint)
// at a 30-second interval. Historical data does not need real-time refresh.
//
// Returns raw PingHistoryEntry array for the component to aggregate into
// hourly, 12-hour, and daily buckets.
//
// Usage:
//   const { data, isLoading, error, refresh } = useLatencyHistory();
// =============================================================================

/** CGI endpoint that serves the NDJSON file as a JSON array */
const HISTORY_ENDPOINT =
  "/cgi-bin/quecmanager/at_cmd/fetch_ping_history.sh";

/** Poll every 30s — historical data does not need real-time cadence */
const DEFAULT_POLL_INTERVAL = 30_000;

export interface UseLatencyHistoryOptions {
  /** Polling interval in ms (default: 30000) */
  pollInterval?: number;
  /** Whether polling is active (default: true) */
  enabled?: boolean;
}

export interface UseLatencyHistoryReturn {
  /** Raw history entries from backend (oldest first) */
  data: PingHistoryEntry[];
  /** True during the very first fetch */
  isLoading: boolean;
  /** Error message if the last fetch failed */
  error: string | null;
  /** Manually trigger an immediate refresh */
  refresh: () => void;
}

export function useLatencyHistory(
  options: UseLatencyHistoryOptions = {}
): UseLatencyHistoryReturn {
  const { pollInterval = DEFAULT_POLL_INTERVAL, enabled = true } = options;

  const liveInterval = useLiveInterval(pollInterval);

  const query = useQuery<PingHistoryEntry[]>({
    queryKey: ["latency-history"],
    queryFn: async () => {
      const response = await authFetch(HISTORY_ENDPOINT);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response.json();
    },
    refetchInterval: enabled ? liveInterval : false,
    enabled,
  });

  const data = query.data ?? [];

  const error = query.error
    ? query.error instanceof Error
      ? query.error.message
      : "Failed to fetch ping history"
    : null;

  return {
    data,
    isLoading: query.isLoading || query.isPending,
    error,
    refresh: () => {
      void query.refetch();
    },
  };
}
