"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

// =============================================================================
// RealtimeContext — global live-data master switch.
//
// Turning realtime OFF stops every polling hook (refetchInterval → false), so
// the modem's AT/CPU usage drops when the dashboard isn't being watched. The
// preference persists in localStorage AND in qmanager.conf [settings].realtime
// so it survives reloads and is respected across devices.
//
// Polling hooks consume the interval through useLiveInterval(ms) instead of a
// literal refetchInterval, so one switch controls all of them.
// =============================================================================

const STORAGE_KEY = "qm_realtime_enabled";

interface RealtimeContextValue {
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  /** Resolve a desired interval against the current switch state. */
  liveInterval: (ms: number | undefined) => number | false;
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabledState] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === null ? true : stored === "1";
  });

  // Persist + notify backend so the pref is durable.
  const setEnabled = useCallback((v: boolean) => {
    setEnabledState(v);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, v ? "1" : "0");
      window.dispatchEvent(new CustomEvent("qm:realtime", { detail: v }));
    }
  }, []);

  // Read the backend preference once on mount (settings.sh GET returns it).
  useEffect(() => {
    let cancelled = false;
    fetch("/cgi-bin/quecmanager/system/realtime.sh")
      .then((r) => r.json())
      .then((json) => {
        if (cancelled || !json || typeof json.enabled !== "boolean") return;
        setEnabledState(json.enabled);
        if (typeof window !== "undefined") {
          window.localStorage.setItem(STORAGE_KEY, json.enabled ? "1" : "0");
        }
      })
      .catch(() => {
        /* offline — keep local pref */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Reflect external changes (other tabs / navigation).
  useEffect(() => {
    const onRealtime = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (typeof detail === "boolean") setEnabledState(detail);
    };
    window.addEventListener("qm:realtime", onRealtime);
    return () => window.removeEventListener("qm:realtime", onRealtime);
  }, []);

  const value = useMemo<RealtimeContextValue>(
    () => ({
      enabled,
      setEnabled,
      liveInterval: (ms) => (enabled ? (ms ?? false) : false),
    }),
    [enabled, setEnabled],
  );

  return (
    <RealtimeContext.Provider value={value}>
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtime(): RealtimeContextValue {
  const ctx = useContext(RealtimeContext);
  if (!ctx) {
    // Fallback: no provider (e.g. login page) — always on.
    return { enabled: true, setEnabled: () => {}, liveInterval: (ms) => ms ?? false };
  }
  return ctx;
}

/**
 * useLiveInterval(ms) — returns the given interval when realtime is ON,
 * `false` when OFF. Drop this into useQuery's refetchInterval.
 */
export function useLiveInterval(ms: number | undefined): number | false {
  const { liveInterval } = useRealtime();
  return liveInterval(ms);
}
