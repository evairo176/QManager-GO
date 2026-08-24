"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { authFetch } from "@/lib/auth-fetch";
import { resolveErrorMessage } from "@/lib/i18n/resolve-error";
import type { NeighbourCellResult } from "@/components/cellular/cell-scanner/neighbourcell/neighbour-scan-result";

// Poll interval while a scan is running (ms)
const SCAN_POLL_INTERVAL = 1000;

type ScanStatus = "idle" | "running" | "complete" | "error";

interface NeighbourScanStatusResponse {
  status: ScanStatus;
  results?: NeighbourCellResult[];
  message?: string;
}

interface UseNeighbourScannerReturn {
  status: ScanStatus;
  results: NeighbourCellResult[];
  error: string | null;
  elapsedSeconds: number;
  startScan: () => Promise<void>;
}

export function useNeighbourScanner(): UseNeighbourScannerReturn {
  const { t } = useTranslation("errors");
  const [status, setStatus] = useState<ScanStatus>("idle");
  const [results, setResults] = useState<NeighbourCellResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    stopTimer();
    const startTime = Date.now();
    setElapsedSeconds(0);
    timerRef.current = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
  }, [stopTimer]);

  // --- Poll for scan status --------------------------------------------------
  const pollStatus = useCallback(async () => {
    try {
      const res = await authFetch(
        `/cgi-bin/quecmanager/at_cmd/neighbour_scan_status.sh?_t=${Date.now()}`,
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data: NeighbourScanStatusResponse = await res.json();

      switch (data.status) {
        case "running":
          setStatus("running");
          break;

        case "complete":
          setStatus("complete");
          setResults(data.results ?? []);
          setError(null);
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
          stopTimer();
          break;

        case "error":
          setStatus("error");
          setError(data.message ?? "Scan failed");
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
          stopTimer();
          break;

        default:
          // "idle" — scan might have finished between start and first poll
          if (pollRef.current) {
            setStatus("idle");
            clearInterval(pollRef.current);
            pollRef.current = null;
            stopTimer();
          }
          break;
      }
    } catch {
      // Network error during poll — keep retrying
    }
  }, [stopTimer]);

  // --- Start a new scan ------------------------------------------------------
  const startScan = useCallback(async () => {
    setStatus("running");
    setError(null);
    startTimer();

    try {
      const res = await authFetch(
        "/cgi-bin/quecmanager/at_cmd/neighbour_scan_start.sh",
        { method: "POST" },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();

      if (!data.success) {
        if (data.error === "already_running") {
          setStatus("running");
        } else {
          setStatus("error");
          setError(resolveErrorMessage(t, data.error, data.detail, "Failed to start scan"));
          stopTimer();
          return;
        }
      }

      // Begin polling for results
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(pollStatus, SCAN_POLL_INTERVAL);
    } catch {
      setStatus("error");
      setError("Failed to connect to scanner");
      stopTimer();
    }
  }, [pollStatus, startTimer, stopTimer, t]);

  // --- Check for existing results on mount -----------------------------------
  useEffect(() => {
    pollStatus();
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      stopTimer();
    };
  }, [pollStatus, stopTimer]);

  return { status, results, error, elapsedSeconds, startScan };
}
