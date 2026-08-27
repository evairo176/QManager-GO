"use client";

import { useQuery } from "@tanstack/react-query";
import { authFetch } from "@/lib/auth-fetch";
import { requestRebootLater } from "@/lib/reboot";

const ENDPOINT = "/cgi-bin/quecmanager/system/pending_reboot.sh";

interface PendingRebootResponse {
  verizon: boolean;
}

/**
 * Polls the backend once on app load for any boot-emitted pending-reboot flags.
 * The CGI clears its own flags on read (clear-on-read), so this is a
 * fire-once query per boot cycle.
 *
 * Call this hook inside a top-level authenticated client component so it runs
 * once the user session is established. TanStack Query's cache-keying
 * (["boot-pending-reboot"]) prevents re-fire on subsequent navigations or
 * React Strict Mode double-invoke — the queryFn runs only once per cache
 * entry, and a successful read clears the backend flag.
 */
export function useBootPendingReboot(): void {
  useQuery({
    queryKey: ["boot-pending-reboot"],
    queryFn: async () => {
      const resp = await authFetch(ENDPOINT);
      if (!resp.ok) return null;
      const data = (await resp.json()) as PendingRebootResponse;
      if (data.verizon) {
        requestRebootLater("verizon_revert");
      }
      return data;
    },
    // The CGI is clear-on-read: never re-run this in the same session, and
    // don't retry on failure — the banner is best-effort.
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  });
}
