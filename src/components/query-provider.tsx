"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

/**
 * TanStack Query provider for QManager.
 *
 * Global defaults tuned for a modem UI:
 * - staleTime: 5s — polling hooks set their own refetchInterval, so a short
 *   staleTime keeps other views fresh without hammering the modem.
 * - retry: 1 — AT/HTTP failures are common on the modem; one retry smooths
 *   transient blips without piling up load on a 1-core device.
 * - refetchOnWindowFocus: false — the modem is polled on intervals; refetching
 *   on focus only adds load. Polling hooks opt in with refetchInterval.
 */
export function QQueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5000,
            retry: 1,
            refetchOnWindowFocus: false,
            refetchOnReconnect: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}
