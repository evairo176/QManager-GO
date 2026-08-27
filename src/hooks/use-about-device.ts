"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { authFetch } from "@/lib/auth-fetch";
import { resolveErrorMessage } from "@/lib/i18n/resolve-error";
import type { AboutDeviceData, AboutDeviceResponse } from "@/types/about-device";

// =============================================================================
// useAboutDevice — One-shot Fetch Hook for About Device Data
// =============================================================================
// Fetches device identity, network addresses, 3GPP release info, and system
// info on mount. No polling — this data is static/semi-static.
//
// Backend: GET /cgi-bin/quecmanager/device/about.sh
// =============================================================================

const CGI_ENDPOINT = "/cgi-bin/quecmanager/device/about.sh";

export interface UseAboutDeviceReturn {
  data: AboutDeviceData | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useAboutDevice(): UseAboutDeviceReturn {
  const { t } = useTranslation("system-settings");

  // Compute fallback inside queryFn so language changes are picked up on each
  // refetch without re-creating the query.
  const query = useQuery<AboutDeviceData>({
    queryKey: ["about-device"],
    queryFn: async () => {
      const fallback = t("about_device.errors.fetch_failed");

      const resp = await authFetch(CGI_ENDPOINT);
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      }

      const json: AboutDeviceResponse = await resp.json();

      if (!json.success) {
        throw new Error(
          resolveErrorMessage(
            t,
            json.error,
            (json as { detail?: string }).detail,
            fallback,
          ),
        );
      }

      return {
        device: json.device,
        threeGppRelease: json["3gpp_release"],
        network: json.network,
        system: json.system,
      };
    },
  });

  const data = query.data ?? null;

  const error = query.error
    ? query.error instanceof Error
      ? query.error.message
      : "Failed to load device info"
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
