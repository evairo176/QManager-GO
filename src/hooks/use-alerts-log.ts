"use client";

import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { authFetch } from "@/lib/auth-fetch";
import { resolveErrorMessage } from "@/lib/i18n/resolve-error";
import type { AlertLogEntry } from "@/types/alerts";

// =============================================================================
// useAlertsLog — merged SMS + email alert history
// =============================================================================
// Posts { action: "get_log" } to the unified CGI, which merges both channels'
// NDJSON logs, tags each entry with its channel, and returns newest-first.
//
// Backend: POST /cgi-bin/quecmanager/monitoring/alerts.sh { action: "get_log" }
// =============================================================================

const CGI_ENDPOINT = "/cgi-bin/quecmanager/monitoring/alerts.sh";

interface AlertsLogResponse {
  success: boolean;
  entries: AlertLogEntry[];
  total: number;
  error?: string;
}

export interface UseAlertsLogReturn {
  entries: AlertLogEntry[];
  total: number;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  lastFetched: Date | null;
  refresh: () => void;
  silentRefresh: () => void;
}

export function useAlertsLog(): UseAlertsLogReturn {
  const { t } = useTranslation("errors");

  // Tracks whether the most recent refetch was a "silent" one. Silent refreshes
  // (refreshKey changes) suppress the error toast; initial load and manual
  // refresh surface it. Mirrors the original mode: "initial" | "refresh" |
  // "silent" without needing state.
  const silentRef = useRef(false);

  const query = useQuery<AlertsLogResponse>({
    queryKey: ["alerts-log"],
    queryFn: async () => {
      const resp = await authFetch(CGI_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_log" }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      const data: AlertsLogResponse = await resp.json();

      if (!data.success) {
        const msg = resolveErrorMessage(
          t,
          data.error,
          undefined,
          "Failed to load alert log",
        );
        // Non-silent failures surface as a toast, mirroring the original.
        if (!silentRef.current) toast.error(msg);
        throw new Error(msg);
      }
      return data;
    },
    // The original fires one fetch per request (aborting in-flight); a retry
    // would double-fire the POST and could double-toast. Keep it single-shot.
    retry: false,
  });

  const data = query.data ?? null;
  const entries = data?.entries ?? [];
  const total = data?.total ?? 0;

  const error = query.error
    ? query.error instanceof Error
      ? query.error.message
      : "Failed to load alert log"
    : null;

  // Original set lastFetched to `new Date()` only on successful fetches;
  // TanStack's dataUpdatedAt is likewise only advanced by a success.
  const lastFetched = data ? new Date(query.dataUpdatedAt) : null;

  const isLoading = query.isLoading || query.isPending;
  // Manual (non-silent, non-initial) refresh in flight. Derived from
  // isFetching minus the initial load and silent refreshes.
  const isRefreshing =
    query.isFetching && !isLoading && !silentRef.current;

  return {
    entries,
    total,
    isLoading,
    isRefreshing,
    error,
    lastFetched,
    refresh: () => {
      silentRef.current = false;
      void query.refetch();
    },
    silentRefresh: () => {
      silentRef.current = true;
      void query.refetch();
    },
  };
}
