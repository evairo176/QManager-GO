"use client";

import { useQuery } from "@tanstack/react-query";
import { authFetch } from "@/lib/auth-fetch";
import { useLiveInterval } from "@/components/realtime-provider";
import type { NetworkEvent } from "@/types/modem-status";

// =============================================================================
// useRecentActivities — Polling Hook for Network Events
// =============================================================================
// Fetches the NDJSON events file (converted to JSON array by the CGI) at a
// slower interval than the main dashboard poll. Events are things like band
// changes, PCI handoffs, CA activation, signal loss, etc.
//
// Usage:
//   const { events, isLoading, refresh } = useRecentActivities();
// =============================================================================

/** How often to poll the events CGI endpoint (ms) — slower than dashboard */
const DEFAULT_POLL_INTERVAL = 10_000;

/** CGI endpoint path */
const EVENTS_ENDPOINT = "/cgi-bin/quecmanager/at_cmd/fetch_events.sh";

export interface UseRecentActivitiesOptions {
  /** Polling interval in ms (default: 10000) */
  pollInterval?: number;
  /** Whether polling is active (default: true) */
  enabled?: boolean;
  /** Maximum number of events to keep in state (default: 20, newest first) */
  maxEvents?: number;
}

export interface UseRecentActivitiesReturn {
  /** Network events, newest first */
  events: NetworkEvent[];
  /** True during the very first fetch */
  isLoading: boolean;
  /** True during a manual refresh (non-initial fetch) */
  isRefreshing: boolean;
  /** Error message if the last fetch failed */
  error: string | null;
  /** Manually trigger an immediate fetch and reset the poll timer */
  refresh: () => void;
}

export function useRecentActivities(
  options: UseRecentActivitiesOptions = {}
): UseRecentActivitiesReturn {
  const {
    pollInterval = DEFAULT_POLL_INTERVAL,
    enabled = true,
    maxEvents = 20,
  } = options;

  const liveInterval = useLiveInterval(pollInterval);

  const query = useQuery<NetworkEvent[]>({
    queryKey: ["recent-activities"],
    queryFn: async () => {
      const response = await authFetch(EVENTS_ENDPOINT);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const json: NetworkEvent[] = await response.json();
      // Events come oldest-first from the file; reverse for newest-first display
      return [...json].reverse().slice(0, maxEvents);
    },
    refetchInterval: enabled ? liveInterval : false,
    enabled,
  });

  const events = query.data ?? [];

  const error = query.error
    ? query.error instanceof Error
      ? query.error.message
      : "Failed to fetch events"
    : null;

  return {
    events,
    isLoading: query.isLoading || query.isPending,
    isRefreshing: query.isFetching && !(query.isLoading || query.isPending),
    error,
    refresh: () => {
      void query.refetch();
    },
  };
}
