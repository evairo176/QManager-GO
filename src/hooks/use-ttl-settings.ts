"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { authFetch } from "@/lib/auth-fetch";
import { resolveErrorMessage } from "@/lib/i18n/resolve-error";

// =============================================================================
// useTtlSettings — One-Shot TTL/HL Fetch & Save Hook
// =============================================================================
// Fetches current TTL and HL values on mount.
// Provides saveTtlHl for applying new values.
//
// Backend endpoint:
//   GET/POST /cgi-bin/quecmanager/network/ttl.sh
// =============================================================================

const CGI_ENDPOINT = "/cgi-bin/quecmanager/network/ttl.sh";

export interface TtlSettingsData {
  /** Whether custom TTL/HL is currently active */
  isEnabled: boolean;
  /** Current TTL value (0 = default / disabled) */
  ttl: number;
  /** Current HL value (0 = default / disabled) */
  hl: number;
  /** Whether TTL/HL is set to autostart on boot */
  autostart: boolean;
}

export interface UseTtlSettingsReturn {
  /** Current TTL/HL data (null before first fetch) */
  data: TtlSettingsData | null;
  /** True while initial fetch is in progress */
  isLoading: boolean;
  /** True while a save operation is in progress */
  isSaving: boolean;
  /** Error message if fetch or save failed */
  error: string | null;
  /** Apply new TTL/HL values. Returns true on success. */
  saveTtlHl: (ttl: number, hl: number) => Promise<boolean>;
  /** Re-fetch TTL/HL data */
  refresh: () => void;
}

export function useTtlSettings(): UseTtlSettingsReturn {
  const { t } = useTranslation("errors");
  const [isSaving, setIsSaving] = useState(false);

  const query = useQuery<{
    success: boolean;
    is_enabled: boolean;
    ttl: number;
    hl: number;
    autostart: boolean;
    error?: string;
    detail?: string;
  }>({
    queryKey: ["ttl-settings"],
    queryFn: async () => {
      const resp = await authFetch(CGI_ENDPOINT);
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      }
      return resp.json();
    },
  });

  const data: TtlSettingsData | null = query.data && query.data.success
    ? {
        isEnabled: query.data.is_enabled,
        ttl: query.data.ttl,
        hl: query.data.hl,
        autostart: query.data.autostart,
      }
    : null;

  const error = query.error
    ? query.error instanceof Error
      ? query.error.message
      : "Failed to fetch TTL settings"
    : query.data && !query.data.success
      ? resolveErrorMessage(t, query.data.error, undefined, "Failed to fetch TTL settings")
      : null;

  const saveMutation = useMutation({
    mutationFn: async ({
      ttl,
      hl,
    }: {
      ttl: number;
      hl: number;
    }): Promise<boolean> => {
      const resp = await authFetch(CGI_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ttl, hl }),
      });

      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      }

      const json = await resp.json();
      if (!json.success) {
        throw new Error(
          resolveErrorMessage(t, json.error, json.detail, "Failed to apply TTL/HL"),
        );
      }
      return true;
    },
    onSuccess: () => {
      void query.refetch();
    },
  });

  const saveTtlHl = async (ttl: number, hl: number): Promise<boolean> => {
    setIsSaving(true);
    try {
      return await saveMutation.mutateAsync({ ttl, hl });
    } catch {
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  return {
    data,
    isLoading: query.isLoading || query.isPending,
    isSaving,
    error,
    saveTtlHl,
    refresh: () => {
      void query.refetch();
    },
  };
}
