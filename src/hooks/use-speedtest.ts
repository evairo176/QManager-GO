import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { authFetch } from "@/lib/auth-fetch";
import { useLiveInterval } from "@/components/realtime-provider";
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
  const [phase, setPhase] = useState<SpeedtestPhase>("idle");
  const [progress, setProgress] = useState(0);
  const [currentProgress, setCurrentProgress] =
    useState<SpeedtestProgressLine | null>(null);
  const [result, setResult] = useState<SpeedtestFinalResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedServer, setSelectedServer] = useState<number | null>(null);
  const [pollingEnabled, setPollingEnabled] = useState(false);

  const mountedRef = useRef(true);

  const liveInterval = useLiveInterval(POLL_INTERVAL_MS);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Check availability (once on mount)
  // ---------------------------------------------------------------------------

  const availabilityQuery = useQuery<SpeedtestCheckResponse>({
    queryKey: ["speedtest-check"],
    queryFn: async () => {
      const resp = await authFetch(`${CGI_BASE}/speedtest_check.sh`);
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      }
      return resp.json();
    },
    staleTime: Infinity,
    retry: false,
  });

  const isAvailable: boolean | null = availabilityQuery.isPending
    ? null
    : availabilityQuery.isError
      ? false
      : (availabilityQuery.data?.available ??
        (availabilityQuery.data as unknown as { installed?: boolean })
          ?.installed ??
        true);

  // ---------------------------------------------------------------------------
  // Fetch nearby servers (on demand)
  // ---------------------------------------------------------------------------

  const serversQuery = useQuery<SpeedtestServersResponse>({
    queryKey: ["speedtest-servers"],
    queryFn: async () => {
      const resp = await authFetch(`${CGI_BASE}/speedtest_servers.sh`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return resp.json();
    },
    enabled: false, // Fetched only when the user opens the server picker
  });

  const servers: SpeedtestServerEntry[] =
    serversQuery.data?.success && serversQuery.data.servers
      ? serversQuery.data.servers
      : [];

  const fetchServers = async () => {
    await serversQuery.refetch();
  };

  // ---------------------------------------------------------------------------
  // Core status polling — active only while a test is running
  // ---------------------------------------------------------------------------

  const statusQuery = useQuery<SpeedtestStatusResponse>({
    queryKey: ["speedtest-status"],
    queryFn: async () => {
      const resp = await authFetch(`${CGI_BASE}/speedtest_status.sh`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return resp.json();
    },
    enabled: pollingEnabled,
    refetchInterval: pollingEnabled ? liveInterval : false,
  });

  // Drive phase/progress/result state from each polled status.
  useEffect(() => {
    const data = statusQuery.data;
    if (!data || !mountedRef.current) return;

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
        setPollingEnabled(false);
        break;

      case "running": {
        const p = data.progress || (data as unknown as { current?: SpeedtestProgressLine }).current;
        const newPhase = (data.phase || "initializing") as SpeedtestPhase;
        setPhase(newPhase);

        if (p && typeof p === "object") {
          setCurrentProgress(p);
          if (p.type === "ping" && p.ping) setProgress(p.ping.progress ?? 0.5);
          else if (p.type === "download" && p.download) setProgress(p.download.progress ?? 0.5);
          else if (p.type === "upload" && p.upload) setProgress(p.upload.progress ?? 0.5);
          else setProgress(0);
        }
        break;
      }

      case "complete":
      case "completed":
        setPhase("complete");
        setProgress(1);
        setResult(
          data.result ||
            ((data as unknown as { current?: SpeedtestProgressLine }).current?.type === "result"
              ? (data as unknown as { current?: SpeedtestProgressLine }).current
              : null),
        );
        setCurrentProgress(null);
        setPollingEnabled(false);
        break;

      case "error":
        setPhase("error");
        setError(data.detail || data.error);
        setCurrentProgress(null);
        setPollingEnabled(false);
        break;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusQuery.data]);

  // ---------------------------------------------------------------------------
  // Start a new test
  // ---------------------------------------------------------------------------

  const start = async () => {
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
          setPollingEnabled(true);
          return;
        }
        setPhase("error");
        setError(data.detail || data.error || "Unknown error");
        return;
      }

      // Success — begin polling for progress
      setPollingEnabled(true);
    } catch (err) {
      if (mountedRef.current) {
        setPhase("error");
        setError(
          err instanceof Error ? err.message : "Failed to start speedtest",
        );
      }
    }
  };

  // ---------------------------------------------------------------------------
  // Refresh status — called on dialog open to detect in-progress tests
  // or load cached results from a previous run
  // ---------------------------------------------------------------------------

  const refreshStatus = async () => {
    try {
      const resp = await authFetch(`${CGI_BASE}/speedtest_status.sh`);
      if (!resp.ok) return;
      const data: SpeedtestStatusResponse = await resp.json();
      if (!mountedRef.current) return;

      if (data.status === "running") {
        const newPhase = (data.phase || "initializing") as SpeedtestPhase;
        setPhase(newPhase);
        if (data.progress) setCurrentProgress(data.progress);
        setPollingEnabled(true);
      } else if (data.status === "complete") {
        setPhase("complete");
        setResult(data.result);
        setProgress(1);
      }
      // idle or error — user can start a new test
    } catch {
      // Silent failure
    }
  };

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
    isLoadingServers: serversQuery.isFetching,
    start,
    refreshStatus,
    fetchServers,
    setSelectedServer,
  };
}
