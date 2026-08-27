"use client";

import { useQuery } from "@tanstack/react-query";
import { authFetch } from "@/lib/auth-fetch";
import type {
  RadioDetails,
  RadioDetailsResponse,
  RadioDetailsErrorResponse,
} from "@/types/modem-status";

// =============================================================================
// useRadioDetails — On-Demand Radio Details Polling Hook
// =============================================================================
// Polls the dedicated on-demand endpoint while the consuming component is
// mounted, and stops on unmount. Each call issues a fresh RAT-gated AT read on
// the modem (MIMO layers, timing advance, CGCONTRDP, QMAP) — these L1-adjacent
// reads were taken OFF the recurring poller as a suspected contributor to
// RM551E baseband restarts, so they only run while a page that displays them
// is open.
//
// The poller's status.json STILL carries last-known values for these fields, so
// consumers PREFER the live value this hook returns and FALL BACK to the poller
// snapshot before the first on-demand fetch returns / when the hook is stale.
//
// Backend endpoint: GET /cgi-bin/quecmanager/cellular/radio_details.sh
// =============================================================================

/** CGI endpoint path (proxied in dev via next.config.ts rewrites) */
const FETCH_ENDPOINT = "/cgi-bin/quecmanager/cellular/radio_details.sh";

/**
 * How often to re-issue the on-demand read (ms). Deliberately slower than the
 * dashboard poller (2s) — these are heavier modem reads and only need to feel
 * live, not real-time.
 */
const DEFAULT_POLL_INTERVAL = 7000;

export interface UseRadioDetailsOptions {
  /** Polling interval in ms (default: 7000). */
  pollInterval?: number;
  /** Whether polling is active (default: true). */
  enabled?: boolean;
}

export interface UseRadioDetailsReturn {
  /** Latest on-demand radio details (null before the first successful fetch). */
  details: RadioDetails | null;
  /**
   * True when the backend reported the modem was unreachable on the last call
   * and returned last-known values. The returned `details` are still usable —
   * render them, optionally with an "as of" hint; do NOT show an empty state.
   */
  stale: boolean;
  /** LTE Timing Advance parsed to a number, or null if unavailable. */
  lteTa: number | null;
  /** NR Timing Advance (NTA) parsed to a number, or null if unavailable. */
  nrTa: number | null;
  /** True during the very first fetch (before any details are available). */
  isLoading: boolean;
  /** Error message if the last fetch failed (auth/network/envelope). */
  error: string | null;
  /** Manually trigger an immediate refresh. */
  refresh: () => void;
}

/** Internal shape carried by the query cache. */
interface RadioDetailsQueryData {
  details: RadioDetails;
  stale: boolean;
}

/**
 * Parses a numeric-string TA field ("" | "12") into a number or null.
 * Empty string, non-numeric, and negative values resolve to null.
 */
function parseTa(value: string | undefined): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function useRadioDetails(
  options: UseRadioDetailsOptions = {}
): UseRadioDetailsReturn {
  const { pollInterval = DEFAULT_POLL_INTERVAL, enabled = true } = options;

  const query = useQuery<RadioDetailsQueryData>({
    queryKey: ["radio-details"],
    queryFn: async () => {
      const response = await authFetch(FETCH_ENDPOINT);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const json:
        | RadioDetailsResponse
        | RadioDetailsErrorResponse = await response.json();

      if (!json.success) {
        // Keep the last good details on the screen; surface the error only.
        // Throwing retains the previous query data (TanStack default).
        throw new Error(json.error || "Failed to fetch radio details");
      }

      return {
        details: json.details,
        stale: Boolean(json.stale),
      };
    },
    refetchInterval: enabled ? pollInterval : false,
    enabled,
  });

  const details = query.data?.details ?? null;
  const stale = query.data?.stale ?? false;

  const error = query.error
    ? query.error instanceof Error
      ? query.error.message
      : "Failed to fetch radio details"
    : null;

  return {
    details,
    stale,
    lteTa: parseTa(details?.lte_ta),
    nrTa: parseTa(details?.nr_ta),
    isLoading: query.isLoading || query.isPending,
    error,
    refresh: () => {
      void query.refetch();
    },
  };
}
