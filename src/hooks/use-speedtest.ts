import { useState, useEffect, useCallback, useRef } from "react";
import { authFetch } from "@/lib/auth-fetch";
import type {
  SpeedtestCheckResponse,
  SpeedtestStartResponse,
  SpeedtestStatusResponse,
  SpeedtestFinalResult,
  SpeedtestProgressLine,
  SpeedtestServerEntry,
  SpeedtestServersResponse,
} from "@/types/speedtest";

// =============================================================================
// useSpeedtest — Speedtest Lifecycle Hook
// =============================================================================
// Manages the full speedtest lifecycle:
//   1. Check if speedtest-cli is available (on mount)
//   2. Detect if a test is already running (on dialog open via refreshStatus)
//   3. Start a new test
//   4. Poll progress every 500ms while running
//   5. Surface final result on completion
//
// Polling only activates when a test is running. This prevents unnecessary
// CGI forks while the user is just viewing the dashboard.
// =============================================================================

const CGI_BASE = "/cgi-bin/quecmanager/at_cmd";
const POLL_INTERVAL_MS = 500;

export type SpeedtestPhase =
  | "idle"
  | "initializing"
  | "ping"
  | "download"
  | "upload"
  | "complete"
  | "error";

export interface UseSpeedtestReturn {
  /** Whether speedtest-cli binary is available on the system */
  isAvailable: boolean | null;
  /** Current phase of the speedtest lifecycle */
  phase: SpeedtestPhase;
  /** 0–1 progress within the current phase */
  progress: number;
  /** Latest progress data from the running test */
  currentProgress: SpeedtestProgressLine | null;
  /** Final result (persists after completion, also loaded from cache) */
  result: SpeedtestFinalResult | null;
  /** Error message if something went wrong */
  error: string | null;
  /** Whether a test is actively running */
  isRunning: boolean;
  /** Nearby servers available for selection */
  servers: SpeedtestServerEntry[];
  /** Currently selected server ID (null = automatic) */
  selectedServer: number | null;
  /** Whether servers are being fetched */
  isLoadingServers: boolean;
  /** Start a new speedtest */
  start: () => Promise<void>;
  /** Refresh status (detect if a test is running from another tab) */
  refreshStatus: () => Promise<void>;
  /** Fetch nearby servers */
  fetchServers: () => Promise<void>;
  /** Set server selection (null = automatic) */
  setSelectedServer: (id: number | null) => void;
}

export function useSpeedtest(): UseSpeedtestReturn {
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [phase, setPhase] = useState<SpeedtestPhase>("idle");
  const [progress, setProgress] = useState(0);
  const [currentProgress, setCurrentProgress] =
    useState<SpeedtestProgressLine | null>(null);
  const [result, setResult] = useState<SpeedtestFinalResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [servers, setServers] = useState<SpeedtestServerEntry[]>([]);
  const [selectedServer, setSelectedServer] = useState<number | null>(null);
  const [isLoadingServers, setIsLoadingServers] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  // ---------------------------------------------------------------------------
  // Cleanup on unmount
  // ---------------------------------------------------------------------------
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Check availability (once on mount)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const check = async () => {
      try {
        const resp = await authFetch(`${CGI_BASE}/speedtest_check.sh`);
        if (!resp.ok) {
          setIsAvailable(false);
          return;
        }
        const data: SpeedtestCheckResponse = await resp.json();
        if (mountedRef.current) setIsAvailable(data.available);
      } catch {
        if (mountedRef.current) setIsAvailable(false);
      }
    };
    check();
  }, []);

  // ---------------------------------------------------------------------------
  // Fetch nearby servers
  // ---------------------------------------------------------------------------
  const fetchServers = useCallback(async () => {
    setIsLoadingServers(true);
    try {
      const resp = await authFetch(`${CGI_BASE}/speedtest_servers.sh`);
      if (!resp.ok) return;
      const data: SpeedtestServersResponse = await resp.json();
      if (!mountedRef.current) return;
      if (data.success && data.servers) {
        setServers(data.servers);
      }
    } catch {
      // Non-fatal — user can still run with auto-select
    } finally {
      if (mountedRef.current) setIsLoadingServers(false);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Stop polling helper
  // ---------------------------------------------------------------------------
  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Core poll function
  // Uses functional setState to avoid stale closures in setInterval.
  // No dependency on any React state — safe to capture in setInterval.
  // ---------------------------------------------------------------------------
  const pollStatus = useCallback(async () => {
    try {
      const resp = await authFetch(`${CGI_BASE}/speedtest_status.sh`);
      if (!resp.ok) return;
      const data: SpeedtestStatusResponse = await resp.json();
      if (!mountedRef.current) return;

      switch (data.status) {
        case "idle":
          // Server says idle. Don't reset if viewing results.
          setPhase((prev) => {
            if (prev === "complete" || prev === "error" || prev === "idle")
              return prev;
            return "idle";
          });
          setProgress(0);
          setCurrentProgress(null);
          stopPolling();
          break;

        case "running": {
          const p = data.progress;
          const newPhase = (data.phase || "initializing") as SpeedtestPhase;
          setPhase(newPhase);

          if (p && typeof p === "object") {
            setCurrentProgress(p);
            if (p.type === "ping") setProgress(p.ping.progress);
            else if (p.type === "download") setProgress(p.download.progress);
            else if (p.type === "upload") setProgress(p.upload.progress);
            else setProgress(0);
          }
          break;
        }

        case "complete":
          setPhase("complete");
          setProgress(1);
          setResult(data.result);
          setCurrentProgress(null);
          stopPolling();
          break;

        case "error":
          setPhase("error");
          setError(data.detail || data.error);
          setCurrentProgress(null);
          stopPolling();
          break;
      }
    } catch {
      // Network error during poll — not critical, retry next interval
    }
  }, [stopPolling]);

  // ---------------------------------------------------------------------------
  // Start polling helper
  // ---------------------------------------------------------------------------
  const startPolling = useCallback(() => {
    if (pollRef.current) return; // Already polling
    pollStatus(); // Immediate first poll
    pollRef.current = setInterval(pollStatus, POLL_INTERVAL_MS);
  }, [pollStatus]);

  // ---------------------------------------------------------------------------
  // Start a new test
  // ---------------------------------------------------------------------------
  const start = useCallback(async () => {
    setError(null);
    setResult(null);
    setPhase("initializing");
    setProgress(0);
    setCurrentProgress(null);

    try {
      const body: Record<string, unknown> = {};
      if (selectedServer !== null) {
        body.server_id = selectedServer;
      }

      const resp = await authFetch(`${CGI_BASE}/speedtest_start.sh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!resp.ok) {
        setPhase("error");
        setError("Failed to start speedtest (HTTP error)");
        return;
      }

      const data: SpeedtestStartResponse = await resp.json();
      if (!mountedRef.current) return;

      if (!data.success) {
        if (data.error === "already_running") {
          // Another tab/instance started it — follow along
          startPolling();
          return;
        }
        setPhase("error");
        setError(data.detail || data.error || "Unknown error");
        return;
      }

      // Success — begin polling for progress
      startPolling();
    } catch (err) {
      if (mountedRef.current) {
        setPhase("error");
        setError(
          err instanceof Error ? err.message : "Failed to start speedtest"
        );
      }
    }
  }, [startPolling, selectedServer]);

  // ---------------------------------------------------------------------------
  // Refresh status — called on dialog open to detect in-progress tests
  // or load cached results from a previous run
  // ---------------------------------------------------------------------------
  const refreshStatus = useCallback(async () => {
    try {
      const resp = await authFetch(`${CGI_BASE}/speedtest_status.sh`);
      if (!resp.ok) return;
      const data: SpeedtestStatusResponse = await resp.json();
      if (!mountedRef.current) return;

      if (data.status === "running") {
        const newPhase = (data.phase || "initializing") as SpeedtestPhase;
        setPhase(newPhase);
        if (data.progress) setCurrentProgress(data.progress);
        startPolling();
      } else if (data.status === "complete") {
        setPhase("complete");
        setResult(data.result);
        setProgress(1);
      }
      // idle or error — user can start a new test
    } catch {
      // Silent failure
    }
  }, [startPolling]);

  return {
    isAvailable,
    phase,
    progress,
    currentProgress,
    result,
    error,
    isRunning:
      phase === "initializing" ||
      phase === "ping" ||
      phase === "download" ||
      phase === "upload",
    servers,
    selectedServer,
    isLoadingServers,
    start,
    refreshStatus,
    fetchServers,
    setSelectedServer,
  };
}
