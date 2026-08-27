"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { authFetch } from "@/lib/auth-fetch";
import { resolveErrorMessage } from "@/lib/i18n/resolve-error";
import type {
  PassthroughMode,
  UsbMode,
  DnsProxy,
  IpptNat,
  IpPassthroughSettingsResponse,
  IpPassthroughSaveRequest,
  IpPassthroughSaveResponse,
} from "@/types/ip-passthrough";

// =============================================================================
// useIpPassthrough — Fetch & Save Hook for IP Passthrough Settings
// =============================================================================
// Fetches current IPPT configuration on mount and exposes a saveSettings action.
// Applying settings triggers an immediate device reboot — no separate reboot
// action is needed.
//
// Backend endpoint:
//   GET/POST /cgi-bin/quecmanager/network/ip_passthrough.sh
// =============================================================================

const CGI_ENDPOINT = "/cgi-bin/quecmanager/network/ip_passthrough.sh";

export interface IpPassthroughApplyData {
  passthrough_mode: PassthroughMode;
  target_mac: string;
  ippt_nat: IpptNat;
  usb_mode: UsbMode;
  dns_proxy: DnsProxy;
}

export interface UseIpPassthroughReturn {
  /** Current passthrough mode (null before first fetch) */
  passthroughMode: PassthroughMode | null;
  /** Target device MAC — "FF:FF:FF:FF:FF:FF" = automatic, empty = none (null before first fetch) */
  targetMac: string | null;
  /** IPPT NAT mode (null before first fetch) */
  ipptNat: IpptNat | null;
  /** Current USB modem protocol (null before first fetch) */
  usbMode: UsbMode | null;
  /** DNS offloading state (null before first fetch) */
  dnsProxy: DnsProxy | null;
  /** True while initial fetch is in progress */
  isLoading: boolean;
  /** True while a save operation is in progress */
  isSaving: boolean;
  /** Error message if fetch or save failed */
  error: string | null;
  /**
   * Apply all IP Passthrough settings. The backend will apply AT commands
   * and immediately trigger a device reboot. Returns true if the request
   * was accepted (reboot will follow).
   */
  saveSettings: (data: IpPassthroughApplyData) => Promise<boolean>;
  /** Re-fetch settings */
  refresh: () => void;
}

export function useIpPassthrough(): UseIpPassthroughReturn {
  const { t } = useTranslation("errors");

  const query = useQuery<IpPassthroughSettingsResponse>({
    queryKey: ["ip-passthrough"],
    queryFn: async () => {
      const resp = await authFetch(CGI_ENDPOINT);
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      }

      const data: IpPassthroughSettingsResponse = await resp.json();

      if (!data.success) {
        throw new Error(
          resolveErrorMessage(t, data.error, undefined, "Failed to fetch IP Passthrough settings")
        );
      }

      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: IpPassthroughApplyData): Promise<boolean> => {
      const request: IpPassthroughSaveRequest = {
        action: "apply",
        passthrough_mode: data.passthrough_mode,
        target_mac: data.target_mac,
        ippt_nat: data.ippt_nat,
        usb_mode: data.usb_mode,
        dns_proxy: data.dns_proxy,
      };

      const resp = await authFetch(CGI_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });

      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      }

      const result: IpPassthroughSaveResponse = await resp.json();

      if (!result.success) {
        throw new Error(
          resolveErrorMessage(t, result.error, result.detail, "Failed to apply settings")
        );
      }

      return true;
    },
  });

  const saveSettings = async (data: IpPassthroughApplyData): Promise<boolean> => {
    try {
      return await saveMutation.mutateAsync(data);
    } catch {
      return false;
    }
  };

  return {
    passthroughMode: query.data?.passthrough_mode ?? null,
    targetMac: query.data?.target_mac ?? null,
    ipptNat: query.data?.ippt_nat ?? null,
    usbMode: query.data?.usb_mode ?? null,
    dnsProxy: query.data?.dns_proxy ?? null,
    isLoading: query.isLoading || query.isPending,
    isSaving: saveMutation.isPending,
    error: query.error?.message ?? saveMutation.error?.message ?? null,
    saveSettings,
    refresh: () => {
      void query.refetch();
    },
  };
}
