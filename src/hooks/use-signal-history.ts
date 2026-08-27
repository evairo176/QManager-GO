"use client";

import { useQuery } from "@tanstack/react-query";
import { authFetch } from "@/lib/auth-fetch";
import { useLiveInterval } from "@/components/realtime-provider";
import type { SignalHistoryEntry } from "@/types/modem-status";

// =============================================================================
// useSignalHistory — Polling Hook for Signal History Chart
// =============================================================================
// Fetches the per-antenna signal history NDJSON (converted to JSON array by
// the CGI endpoint) at the same cadence as the poller's Tier 1 (2s).
//
// Returns raw history entries and a chart-ready transformation that computes
// the best (highest) non-null antenna value per RAT per timestamp, with
// relative time labels ('-Ns' / 'Now') matching the Live Latency chart.
//
// Usage:
//   const { chartData, isLoading, error } = useSignalHistory();
// =============================================================================

const HISTORY_ENDPOINT = "/cgi-bin/quecmanager/at_cmd/fetch_signal_history.sh";

/** Poll cadence — matches poller Tier 1 (2s). */
const DEFAULT_POLL_INTERVAL = 2_000;

/** Number of trailing entries shown on the chart (6 entries × 2s = last 10s). */
const CHART_POINTS = 6;

// --- Types -------------------------------------------------------------------

export interface SignalChartPoint {
  /** Relative time label, e.g. "-10s" or "Now". */
  time: string;
  rsrp4G: number | null;
  rsrp5G: number | null;
  rsrq4G: number | null;
  rsrq5G: number | null;
  sinr4G: number | null;
  sinr5G: number | null;
}

export interface UseSignalHistoryOptions {
  pollInterval?: number;
  enabled?: boolean;
}

export interface UseSignalHistoryReturn {
  /** Chart-ready data points (oldest first) */
  chartData: SignalChartPoint[];
  /** Raw history entries from backend */
  raw: SignalHistoryEntry[];
  /** True during the very first fetch */
  isLoading: boolean;
  /** Error message if the last fetch failed */
  error: string | null;
}

// --- Helpers -----------------------------------------------------------------

function bestAntenna(values: (number | null)[]): number | null {
  let best: number | null = null;
  for (const v of values) {
    if (v !== null && (best === null || v > best)) {
      best = v;
    }
  }
  return best;
}

/**
 * Formats a relative-time label for an entry given the most-recent entry's ts.
 *
 * - Equal or future timestamps return "Now" (future = clock skew, clamp safely).
 * - Older entries return "-Ns" rounded to the nearest whole second.
 *
 * Exported for unit tests.
 */
export function formatRelativeTime(entryTs: number, latestTs: number): string {
  const diff = Math.round(latestTs - entryTs);
  if (diff <= 0) return "Now";
  return `-${diff}s`;
}

function toChartPoint(
  entry: SignalHistoryEntry,
  latestTs: number,
): SignalChartPoint {
  return {
    time: formatRelativeTime(entry.ts, latestTs),
    rsrp4G: bestAntenna(entry.lte_rsrp),
    rsrp5G: bestAntenna(entry.nr_rsrp),
    rsrq4G: bestAntenna(entry.lte_rsrq),
    rsrq5G: bestAntenna(entry.nr_rsrq),
    sinr4G: bestAntenna(entry.lte_sinr),
    sinr5G: bestAntenna(entry.nr_sinr),
  };
}

// --- Hook --------------------------------------------------------------------

export function useSignalHistory(
  options: UseSignalHistoryOptions = {},
): UseSignalHistoryReturn {
  const { pollInterval = DEFAULT_POLL_INTERVAL, enabled = true } = options;

  const liveInterval = useLiveInterval(pollInterval);

  const query = useQuery<SignalHistoryEntry[]>({
    queryKey: ["signal-history"],
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

  const raw = query.data ?? [];

  // Chart-ready transformation: keep the last CHART_POINTS entries, computing
  // relative time labels against the newest entry's timestamp.
  let chartData: SignalChartPoint[] = [];
  if (raw.length > 0) {
    const recent = raw.slice(-CHART_POINTS);
    const latestTs = recent[recent.length - 1].ts;
    chartData = recent.map((entry) => toChartPoint(entry, latestTs));
  }

  const error = query.error
    ? query.error instanceof Error
      ? query.error.message
      : "Failed to fetch signal history"
    : null;

  return {
    chartData,
    raw,
    isLoading: query.isLoading || query.isPending,
    error,
  };
}
