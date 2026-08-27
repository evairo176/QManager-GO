"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
import { authFetch } from "@/lib/auth-fetch";
import type { PingProfile } from "@/types/modem-status";

// =============================================================================
// usePingProfile — read/write the ping-daemon sensitivity profile + targets
// =============================================================================
// GET  → { success: true, profile, target_ipv4, target_ipv6 }
// POST → { action: "save", profile, target_ipv4, target_ipv6 }
//        success: { success: true, ... }
//        failure: { success: false, error, detail }
//
// The daemon probes via ICMP: the IPv4 DNS target is pinged first; the IPv6
// target is only used when the IPv4 probe fails, so an IPv6-only bearer never
// reads as "down". Targets are bare hosts/IP literals (no URL scheme).
//
// Save rejects on failure so the calling card's try/catch can toast the error;
// it also stores the message in `saveError` for the inline alert.
//
// CGI: /cgi-bin/quecmanager/system/ping_profile.sh
// =============================================================================

const ENDPOINT = "/cgi-bin/quecmanager/system/ping_profile.sh";

interface PingProfileGetResponse {
  success: boolean;
  profile?: PingProfile;
  target_ipv4?: string;
  target_ipv6?: string;
  interval_override?: number | null;
  effective_interval?: number;
  error?: string;
  detail?: string;
}

interface PingProfileSaveResponse {
  success: boolean;
  error?: string;
  detail?: string;
}

export interface SavePingProfileArgs {
  profile: PingProfile;
  target_ipv4: string;
  target_ipv6: string;
}

export interface UsePingProfileReturn {
  profile: PingProfile | undefined;
  targetIpv4: string | undefined;
  targetIpv6: string | undefined;
  intervalOverride: number | null;
  effectiveInterval: number | undefined;
  isLoading: boolean;
  error: string | null;
  isSaving: boolean;
  saveError: string | null;
  save: (args: SavePingProfileArgs) => Promise<void>;
}

export function usePingProfile(): UsePingProfileReturn {
  const query = useQuery<PingProfileGetResponse>({
    queryKey: ["ping-profile"],
    queryFn: async () => {
      const response = await authFetch(ENDPOINT);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response.json();
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (args: SavePingProfileArgs) => {
      const response = await authFetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save",
          profile: args.profile,
          target_ipv4: args.target_ipv4,
          target_ipv6: args.target_ipv6,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const json: PingProfileSaveResponse = await response.json();
      if (!json.success) {
        throw new Error(json.detail || json.error || "Failed to save");
      }
      return args;
    },
    onSuccess: () => {
      void query.refetch();
    },
  });

  const data = query.data;

  const save = async (args: SavePingProfileArgs) => {
    await saveMutation.mutateAsync(args);
  };

  return {
    profile: data?.profile,
    targetIpv4: data?.target_ipv4,
    targetIpv6: data?.target_ipv6,
    intervalOverride: data?.interval_override ?? null,
    effectiveInterval: data?.effective_interval,
    isLoading: query.isLoading || query.isPending,
    error: query.error ? query.error.message : null,
    isSaving: saveMutation.isPending,
    saveError: saveMutation.error ? saveMutation.error.message : null,
    save,
  };
}
