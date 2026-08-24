"use client";

import { useState, useCallback, useRef, useEffect } from "react";
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
  const [data, setData] = useState<AboutDeviceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    setError(null);

    // Compute fallback inside each call so language changes are picked up
    // without re-creating fetchData (which would re-run the mount effect).
    const fallback = t("about_device.errors.fetch_failed");

    try {
      const resp = await authFetch(CGI_ENDPOINT);
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      }

      const json: AboutDeviceResponse = await resp.json();
      if (!mountedRef.current) return;

      if (!json.success) {
        setError(
          resolveErrorMessage(
            t,
            json.error,
            (json as { detail?: string }).detail,
            fallback,
          ),
        );
        return;
      }

      setData({
        device: json.device,
        threeGppRelease: json["3gpp_release"],
        network: json.network,
        system: json.system,
      });
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err.message : fallback);
    } finally {
      if (mountedRef.current && !silent) {
        setIsLoading(false);
      }
    }
    // t intentionally omitted from deps — see fallback comment above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refresh = useCallback(() => {
    fetchData();
  }, [fetchData]);

  return { data, isLoading, error, refresh };
}
