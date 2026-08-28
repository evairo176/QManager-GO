"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRealtime } from "@/components/realtime-provider";

export interface StorageMount {
  mount_point: string;
  filesystem: string;
  total_bytes: number;
  used_bytes: number;
  free_bytes: number;
  used_percent: number;
  label: string;
  read_only?: boolean;
}

interface StorageState {
  mounts: StorageMount[];
  loading: boolean;
  error: string | null;
}

/**
 * Fetches filesystem usage from the modem's storage endpoint.
 * Polls every ~10s while realtime is enabled, otherwise fetches once
 * (plus a manual refresh).
 */
export function useStorage() {
  const { enabled: realtime } = useRealtime();
  const [state, setState] = useState<StorageState>({
    mounts: [],
    loading: true,
    error: null,
  });
  const aliveRef = useRef(true);

  const fetchStorage = useCallback(async () => {
    try {
      const res = await fetch(
        "/cgi-bin/quecmanager/system/storage.sh",
        { cache: "no-store" },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!aliveRef.current) return;
      if (!json.success) throw new Error(json.detail || "Failed to load storage");
      setState({
        mounts: Array.isArray(json.storage) ? json.storage : [],
        loading: false,
        error: null,
      });
    } catch (err) {
      if (!aliveRef.current) return;
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : "Failed to load storage",
      }));
    }
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    void fetchStorage();
    if (!realtime) return;
    const id = setInterval(fetchStorage, 10_000);
    return () => {
      clearInterval(id);
    };
  }, [fetchStorage, realtime]);

  useEffect(() => {
    return () => {
      aliveRef.current = false;
    };
  }, []);

  return { ...state, refresh: fetchStorage };
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = "B";
  for (const u of units) {
    value /= 1024;
    unit = u;
    if (value < 1024) break;
  }
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${unit}`;
}
