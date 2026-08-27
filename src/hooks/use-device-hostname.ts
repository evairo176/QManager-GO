"use client";

import { useQuery } from "@tanstack/react-query";
import type { DeviceHostnameResponse } from "@/types/device-hostname";

// =============================================================================
// useDeviceHostname — Pre-auth, single-shot fetch of the modem's hostname.
// =============================================================================
// Used by the login screen to render a device-identity pill. The hostname is
// effectively constant for a session, so this hook does not poll. It also does
// NOT carry credentials: the endpoint is unauthenticated by design, and the
// pre-auth surface should never leak cookies it does not need to.
//
// Graceful-degradation contract: if the CGI is missing (older firmware) or
// the hostname is empty, `hostname` resolves to `null` and the consumer hides
// the pill entirely. There is no error state surfaced pre-auth.
// =============================================================================

const FETCH_ENDPOINT = "/cgi-bin/quecmanager/public/hostname.sh";

export interface UseDeviceHostnameReturn {
  hostname: string | null;
  isLoading: boolean;
}

export function useDeviceHostname(): UseDeviceHostnameReturn {
  const query = useQuery<string | null>({
    queryKey: ["device-hostname"],
    // Silent failure is the contract: older firmware without the CGI,
    // network blip, or any other failure resolves to "hide the pill".
    queryFn: async () => {
      const res = await fetch(FETCH_ENDPOINT, {
        cache: "no-store",
        credentials: "omit",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as DeviceHostnameResponse;
      const trimmed = (json?.hostname ?? "").trim();
      return trimmed.length > 0 ? trimmed : null;
    },
    // Failures are expected pre-auth (older firmware); do not retry or surface.
    retry: false,
  });

  // Errors are deliberately swallowed: the pre-auth surface never surfaces a
  // hostname error — the consumer just hides the pill when hostname is null.
  const hostname = query.error ? null : (query.data ?? null);

  return {
    hostname,
    isLoading: query.isLoading || query.isPending,
  };
}
