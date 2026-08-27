"use client";

import { useQuery } from "@tanstack/react-query";
import { authFetch } from "@/lib/auth-fetch";
import type { CurrentModemSettings } from "@/types/sim-profile";

// =============================================================================
// useCurrentSettings — One-Shot Modem Settings Query Hook
// =============================================================================
// Fetches current modem settings (APN, IMEI, ICCID) for pre-filling
// the profile creation form. Called once on demand, not on a timer.
//
// The CGI endpoint queries the modem via qcmd using sip-don't-gulp pattern,
// so this may take 2-3 seconds to complete.
//
// Usage:
//   const { settings, isLoading, error, refresh } = useCurrentSettings();
// =============================================================================

const CGI_ENDPOINT = "/cgi-bin/quecmanager/profiles/current_settings.sh";

export interface UseCurrentSettingsReturn {
  /** Current modem settings (null before first fetch) */
  settings: CurrentModemSettings | null;
  /** True while fetching */
  isLoading: boolean;
  /** Error message if fetch failed */
  error: string | null;
  /** Manually trigger a fresh query */
  refresh: () => void;
}

export function useCurrentSettings(
  /** If true, fetch immediately on mount. Default: false (fetch on demand via refresh). */
  fetchOnMount: boolean = false
): UseCurrentSettingsReturn {
  const query = useQuery<CurrentModemSettings>({
    queryKey: ["current-settings"],
    queryFn: async () => {
      const resp = await authFetch(CGI_ENDPOINT);
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      }
      return resp.json() as Promise<CurrentModemSettings>;
    },
    enabled: fetchOnMount,
  });

  return {
    settings: query.data ?? null,
    isLoading: query.isLoading || query.isPending,
    error: query.error ? query.error.message : null,
    refresh: () => {
      void query.refetch();
    },
  };
}
