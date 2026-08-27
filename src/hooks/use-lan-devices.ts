"use client";

import { useQuery } from "@tanstack/react-query";
import { authFetch } from "@/lib/auth-fetch";
import type { LanDevice, LanDevicesResponse } from "@/types/lan-devices";

// =============================================================================
// useLanDevices — Connected LAN Device List
// =============================================================================
// Reads the modem's connected LAN devices (DHCP leases merged with ip neigh /
// ARP) so a UI can offer a "pick a device" affordance instead of hand-typing a
// MAC. Read-only; safe to refresh on demand. Backs the IP Passthrough MAC picker.
//
// Backend endpoint:
//   GET /cgi-bin/quecmanager/network/lan_devices.sh
// =============================================================================

const CGI_ENDPOINT = "/cgi-bin/quecmanager/network/lan_devices.sh";

export interface UseLanDevicesReturn {
  /** Connected devices; empty array when none are visible on the LAN */
  devices: LanDevice[];
  /** True while a fetch is in progress */
  isLoading: boolean;
  /** Error message if the fetch failed, else null */
  error: string | null;
  /** Re-scan the LAN */
  refresh: () => void;
}

/**
 * @param enabled - When false, the hook stays idle and performs no fetch.
 *   The IP Passthrough card only needs devices while passthrough is active, so
 *   it gates the scan on mode !== "disabled".
 */
export function useLanDevices(enabled = true): UseLanDevicesReturn {
  const query = useQuery<LanDevice[]>({
    queryKey: ["lan-devices"],
    queryFn: async () => {
      const resp = await authFetch(CGI_ENDPOINT);
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      }

      const data: LanDevicesResponse = await resp.json();

      if (!data.success) {
        throw new Error(data.error ?? "Failed to load connected devices");
      }

      return Array.isArray(data.devices) ? data.devices : [];
    },
    enabled,
  });

  return {
    devices: query.data ?? [],
    isLoading: query.isLoading || query.isPending,
    error: query.error ? query.error.message : null,
    refresh: () => {
      void query.refetch();
    },
  };
}
