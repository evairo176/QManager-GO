"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { authFetch } from "@/lib/auth-fetch";
import { resolveErrorMessage } from "@/lib/i18n/resolve-error";
import type {
  LanConfigStatus,
  LanConfigSaveResponse,
} from "@/types/lan-config";

// =============================================================================
// useLanConfig — LAN Gateway/Subnet Hook
// =============================================================================
// Fetches the current br-lan IPv4 address + subnet on mount. Provides
// saveLanConfig to change network.lan.ipaddr / netmask.
//
// CRITICAL — self-severing apply: committing a new LAN IP and reloading the
// network rebinds br-lan, which kills THIS HTTP connection. When the address
// actually changes, the browser's current origin (the old IP) becomes
// unreachable. So unlike the old WoL hook, there is NO retry loop against the
// old origin — the backend flushes its response BEFORE the reload, and on
// success we flip straight to an "applied" state carrying the new address.
// The card surfaces a persistent banner telling the user to reconnect and
// browse to the new IP.
//
// Backend endpoint:
//   GET/POST /cgi-bin/quecmanager/network/lan_config.sh
// =============================================================================

const CGI_ENDPOINT = "/cgi-bin/quecmanager/network/lan_config.sh";

export interface LanApplied {
  /** Address the device will be reachable at after the reload */
  newIpaddr: string;
  /** CIDR prefix that was applied */
  prefix: number;
  /** Seconds the LAN is expected to be unreachable */
  windowSeconds: number;
  /**
   * True when the backend bounced the LAN port carrier — a DHCP upstream router
   * reconnects automatically, so the banner can say so instead of asking for a
   * manual cable re-plug.
   */
  carrierBounce: boolean;
}

export interface SaveLanConfigResult {
  success: boolean;
  errorCode?: string;
  errorDetail?: string;
}

export interface UseLanConfigReturn {
  /** Current LAN config (null before first fetch) */
  data: LanConfigStatus | null;
  /** True while the initial fetch is in progress */
  isLoading: boolean;
  /** True while the POST save request is in-flight */
  isSaving: boolean;
  /** Set once a change has been committed + the reload armed (drives the banner) */
  applied: LanApplied | null;
  /** Error message if fetch or save failed */
  error: string | null;
  /** Re-fetch LAN config */
  refresh: () => Promise<void>;
  /** Apply a new gateway IP + prefix. Returns raw error codes on failure. */
  saveLanConfig: (ipaddr: string, prefix: number) => Promise<SaveLanConfigResult>;
}

type SaveMutationResult = SaveLanConfigResult & { applied?: LanApplied };

export function useLanConfig(): UseLanConfigReturn {
  const { t } = useTranslation("errors");
  const [applied, setApplied] = useState<LanApplied | null>(null);

  const query = useQuery<LanConfigStatus>({
    queryKey: ["lan-config"],
    queryFn: async () => {
      const resp = await authFetch(CGI_ENDPOINT);
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      }

      const json = await resp.json();

      if (!json.success) {
        throw new Error(
          resolveErrorMessage(t, json.error, json.detail, "Failed to fetch LAN settings")
        );
      }

      return json as LanConfigStatus;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (args: {
      ipaddr: string;
      prefix: number;
    }): Promise<SaveMutationResult> => {
      const { ipaddr, prefix } = args;

      let resp: Response;
      try {
        resp = await authFetch(CGI_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ipaddr, prefix }),
        });
      } catch (err) {
        const detail =
          err instanceof Error ? err.message : "Failed to save LAN settings";
        return { success: false, errorDetail: detail };
      }

      if (!resp.ok) {
        let json: LanConfigSaveResponse | null = null;
        try {
          json = await resp.json();
        } catch {
          // ignore parse error
        }
        return {
          success: false,
          errorCode: json?.error,
          errorDetail: json?.detail,
        };
      }

      let json: LanConfigSaveResponse;
      try {
        json = await resp.json();
      } catch {
        return { success: false };
      }

      if (!json.success) {
        return {
          success: false,
          errorCode: json.error,
          errorDetail: json.detail,
        };
      }

      // --- Success: the reload is armed; the old origin is about to die. -------
      // Do NOT poll — flip straight to the applied state. The card shows a
      // persistent banner with the new address.
      return {
        success: true,
        applied: {
          newIpaddr: json.new_ipaddr ?? ipaddr,
          prefix: json.prefix ?? prefix,
          windowSeconds: json.disconnect_window_seconds ?? 15,
          carrierBounce: json.carrier_bounce ?? false,
        },
      };
    },
    onSuccess: (result) => {
      if (result.applied) {
        setApplied(result.applied);
      }
    },
  });

  const saveLanConfig = async (
    ipaddr: string,
    prefix: number
  ): Promise<SaveLanConfigResult> => {
    try {
      const result = await saveMutation.mutateAsync({ ipaddr, prefix });
      return {
        success: result.success,
        errorCode: result.errorCode,
        errorDetail: result.errorDetail,
      };
    } catch {
      return { success: false };
    }
  };

  const refresh = async (): Promise<void> => {
    await query.refetch();
  };

  return {
    data: query.data ?? null,
    isLoading: query.isLoading || query.isPending,
    isSaving: saveMutation.isPending,
    applied,
    error: query.error?.message ?? saveMutation.error?.message ?? null,
    refresh,
    saveLanConfig,
  };
}
