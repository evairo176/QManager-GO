"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { authFetch } from "@/lib/auth-fetch";
import { resolveErrorMessage } from "@/lib/i18n/resolve-error";

// =============================================================================
// useDnsSettings — DNS Fetch & Save Hook (TanStack Query)
// =============================================================================
// Backend: GET/POST /cgi-bin/quecmanager/network/dns.sh
// =============================================================================

const CGI_ENDPOINT = "/cgi-bin/quecmanager/network/dns.sh";

export interface DnsSettingsData {
  mode: "enabled" | "disabled";
  currentDNS: string;
  currentDNS6: string;
  nic: string;
  dns1: string;
  dns2: string;
  dns3: string;
  dns1v6: string;
  dns2v6: string;
}

export interface SaveDnsParams {
  mode: "enabled" | "disabled";
  nic: string;
  dns1: string;
  dns2: string;
  dns3: string;
  dns1v6: string;
  dns2v6: string;
}

export interface UseDnsSettingsReturn {
  data: DnsSettingsData | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  saveDns: (params: SaveDnsParams) => Promise<boolean>;
  refresh: () => void;
}

interface DnsGetResponse {
  success: boolean;
  mode?: string;
  currentDNS?: string;
  currentDNS6?: string;
  nic?: string;
  error?: string;
  detail?: string;
}

export function useDnsSettings(): UseDnsSettingsReturn {
  const { t } = useTranslation("errors");
  const [isSaving, setIsSaving] = useState(false);

  const query = useQuery<DnsGetResponse>({
    queryKey: ["dns-settings"],
    queryFn: async () => {
      const resp = await authFetch(CGI_ENDPOINT);
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      }
      const json = await resp.json();
      if (!json.success) {
        throw new Error(
          resolveErrorMessage(t, json.error, undefined, "Failed to fetch DNS settings"),
        );
      }
      return json;
    },
  });

  // Parse comma-separated DNS strings into individual fields.
  // CRITICAL: memoize so the object reference is stable across renders — the
  // consuming card uses `data !== prevData` as a render-phase sync guard, so
  // a fresh object every render would cause an infinite re-render (React #301).
  const json = query.data;
  const data: DnsSettingsData | null = useMemo(() => {
    if (!json) return null;
    const parts = (json.currentDNS || "")
      .split(",")
      .map((s: string) => s.trim())
      .filter(Boolean);
    const parts6 = (json.currentDNS6 || "")
      .split(",")
      .map((s: string) => s.trim())
      .filter(Boolean);
    return {
      mode: json.mode === "enabled" ? "enabled" : "disabled",
      currentDNS: json.currentDNS || "",
      currentDNS6: json.currentDNS6 || "",
      nic: json.nic === "lan_bind4" ? "lan_bind4" : "lan",
      dns1: parts[0] || "",
      dns2: parts[1] || "",
      dns3: parts[2] || "",
      dns1v6: parts6[0] || "",
      dns2v6: parts6[1] || "",
    };
  }, [json]);

  const error = query.error ? query.error.message : null;

  // ─── Save DNS settings ────────────────────────────────────────────────────

  const saveMutation = useMutation({
    mutationFn: async (params: SaveDnsParams) => {
      const resp = await authFetch(CGI_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      }
      const json = await resp.json();
      if (!json.success) {
        throw new Error(
          resolveErrorMessage(t, json.error, json.detail, "Failed to apply DNS settings"),
        );
      }
    },
    onSuccess: () => void query.refetch(),
  });

  const saveDns = async (params: SaveDnsParams): Promise<boolean> => {
    setIsSaving(true);
    try {
      await saveMutation.mutateAsync(params);
      return true;
    } catch (err) {
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
    saveDns,
    refresh: () => void query.refetch(),
  };
}
