"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { authFetch } from "@/lib/auth-fetch";
import type {
  TowerLockConfig,
  TowerModemState,
  TowerFailoverState,
  TowerScheduleConfig,
  TowerStatusResponse,
  TowerLockResponse,
  TowerSettingsResponse,
  TowerScheduleResponse,
  TowerFailoverStatusResponse,
  LteLockCell,
  NrSaLockCell,
} from "@/types/tower-locking";

// =============================================================================
// useTowerLocking — Tower Lock State, Lock/Unlock, Settings & Schedule Hook
// =============================================================================
// Manages the tower locking lifecycle: fetching current lock state from the
// modem, applying/clearing LTE and NR-SA tower locks, updating persist and
// failover settings, and managing the schedule.
//
// After a successful lock (when failover is enabled), the hook polls the
// lightweight failover_status.sh endpoint every 3s until the watcher
// process completes. This detects whether failover activated and updates
// the UI accordingly — without touching the modem.
//
// Backend endpoints:
//   GET  /cgi-bin/quecmanager/tower/status.sh           → full state
//   GET  /cgi-bin/quecmanager/tower/failover_status.sh  → lightweight flag check
//   POST /cgi-bin/quecmanager/tower/lock.sh             → apply/clear lock
//   POST /cgi-bin/quecmanager/tower/settings.sh         → persist + failover config
//   POST /cgi-bin/quecmanager/tower/schedule.sh         → schedule config + cron
// =============================================================================

const CGI_BASE = "/cgi-bin/quecmanager/tower";
const FAILOVER_POLL_INTERVAL = 3000; // 3s — watcher sleeps 20s then checks

const DEFAULT_FAILOVER_THRESHOLD = 20;
const DEFAULT_SCHEDULE: TowerScheduleConfig = {
  enabled: false,
  start_time: "08:00",
  end_time: "22:00",
  days: [1, 2, 3, 4, 5],
};

function normalizeTowerConfig(
  rawConfig: TowerStatusResponse["config"] | null | undefined,
  failoverEnabledFallback = false
): TowerLockConfig | null {
  if (!rawConfig) return null;

  const lteCells = Array.isArray(rawConfig.lte?.cells)
    ? rawConfig.lte.cells.slice(0, 3)
    : [];
  while (lteCells.length < 3) {
    lteCells.push(null);
  }

  const scheduleDays = Array.isArray(rawConfig.schedule?.days)
    ? rawConfig.schedule.days.filter(
        (day) => Number.isInteger(day) && day >= 0 && day <= 6
      )
    : DEFAULT_SCHEDULE.days;

  return {
    lte: {
      enabled: rawConfig.lte?.enabled === true,
      cells: lteCells,
    },
    nr_sa: {
      enabled: rawConfig.nr_sa?.enabled === true,
      pci: rawConfig.nr_sa?.pci ?? null,
      arfcn: rawConfig.nr_sa?.arfcn ?? null,
      scs: rawConfig.nr_sa?.scs ?? null,
      band: rawConfig.nr_sa?.band ?? null,
    },
    persist: rawConfig.persist === true,
    failover: {
      enabled:
        rawConfig.failover?.enabled ?? failoverEnabledFallback,
      threshold:
        rawConfig.failover?.threshold ?? DEFAULT_FAILOVER_THRESHOLD,
    },
    schedule: {
      enabled: rawConfig.schedule?.enabled === true,
      start_time:
        rawConfig.schedule?.start_time || DEFAULT_SCHEDULE.start_time,
      end_time: rawConfig.schedule?.end_time || DEFAULT_SCHEDULE.end_time,
      days: scheduleDays.length > 0 ? scheduleDays : DEFAULT_SCHEDULE.days,
    },
  };
}

export interface UseTowerLockingReturn {
  /** Tower lock configuration from config file */
  config: TowerLockConfig | null;
  /** Live modem lock state (from AT+QNWLOCK queries) */
  modemState: TowerModemState | null;
  /** Failover watcher state (from flag files) */
  failoverState: TowerFailoverState | null;
  /** True during initial data fetch */
  isLoading: boolean;
  /** True while an LTE lock/unlock operation is in progress */
  isLteLocking: boolean;
  /** True while an NR-SA lock/unlock operation is in progress */
  isNrLocking: boolean;
  /** Error message from the last operation */
  error: string | null;

  /**
   * Lock LTE to specific cells (1-3 EARFCN+PCI pairs).
   * @returns success boolean
   */
  lockLte: (cells: LteLockCell[]) => Promise<boolean>;
  /** Clear LTE tower lock. */
  unlockLte: () => Promise<boolean>;
  /**
   * Lock NR-SA to a specific cell (PCI + ARFCN + SCS + Band).
   * @returns success boolean
   */
  lockNrSa: (cell: NrSaLockCell) => Promise<boolean>;
  /** Clear NR-SA tower lock. */
  unlockNrSa: () => Promise<boolean>;

  /**
   * Update persist and failover settings.
   * Persist changes are sent to the modem immediately via AT command.
   */
  updateSettings: (
    persist: boolean,
    failover: { enabled: boolean; threshold: number }
  ) => Promise<boolean>;

  /** Update schedule configuration and manage cron entries. */
  updateSchedule: (schedule: TowerScheduleConfig) => Promise<boolean>;

  /** True while the failover watcher is running (anti-spam guard) */
  isWatcherRunning: boolean;

  /** Manually refresh all tower lock state. */
  refresh: () => void;
}

export function useTowerLocking(): UseTowerLockingReturn {
  const [config, setConfig] = useState<TowerLockConfig | null>(null);
  const [modemState, setModemState] = useState<TowerModemState | null>(null);
  const [failoverState, setFailoverState] =
    useState<TowerFailoverState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLteLocking, setIsLteLocking] = useState(false);
  const [isNrLocking, setIsNrLocking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const failoverPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (failoverPollRef.current) {
        clearInterval(failoverPollRef.current);
        failoverPollRef.current = null;
      }
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Fetch full tower lock status (modem queries + config + failover flags)
  // ---------------------------------------------------------------------------
  const MAX_RETRIES = 3;

  const fetchStatus = useCallback(async (isRetry = false) => {
    try {
      const resp = await authFetch(`${CGI_BASE}/status.sh`);
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      }

      const data: TowerStatusResponse = await resp.json();
      if (!mountedRef.current) return;

      if (!data.success) {
        setError(data.error || "Failed to fetch tower lock status");
        return;
      }

      // Fix: use explicit null/undefined checks instead of truthy checks.
      // Objects like {enabled: false} are truthy but would pass, while
      // the truthy check is really guarding against null/undefined.
      if (data.modem_state !== null && data.modem_state !== undefined) {
        setModemState(data.modem_state);
      }
      if (data.config !== null && data.config !== undefined) {
        setConfig(
          normalizeTowerConfig(
            data.config,
            data.failover_state?.enabled === true
          )
        );
      }
      if (data.failover_state !== null && data.failover_state !== undefined) {
        setFailoverState(data.failover_state);
      }
      setError(null);
      retryCountRef.current = 0; // Reset retry counter on success
    } catch (err) {
      if (!mountedRef.current) return;
      const msg =
        err instanceof Error ? err.message : "Failed to fetch tower lock status";
      setError(msg);

      // Auto-retry with exponential backoff (2s, 4s, 8s)
      if (retryCountRef.current < MAX_RETRIES) {
        const delay = Math.pow(2, retryCountRef.current + 1) * 1000;
        retryCountRef.current += 1;
        retryTimerRef.current = setTimeout(() => {
          if (mountedRef.current) {
            fetchStatus(true);
          }
        }, delay);
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // ---------------------------------------------------------------------------
  // Failover status polling (lightweight — no modem contact)
  // ---------------------------------------------------------------------------
  const startFailoverPolling = useCallback(() => {
    if (failoverPollRef.current) {
      clearInterval(failoverPollRef.current);
      failoverPollRef.current = null;
    }

    failoverPollRef.current = setInterval(async () => {
      if (!mountedRef.current) {
        if (failoverPollRef.current) {
          clearInterval(failoverPollRef.current);
          failoverPollRef.current = null;
        }
        return;
      }

      try {
        const resp = await authFetch(`${CGI_BASE}/failover_status.sh`);
        if (!resp.ok) return;

        const data: TowerFailoverStatusResponse = await resp.json();
        if (!mountedRef.current) return;

        // Watcher still running — keep polling
        if (data.watcher_running) return;

        // Watcher finished — stop polling and update state
        if (failoverPollRef.current) {
          clearInterval(failoverPollRef.current);
          failoverPollRef.current = null;
        }

        setFailoverState({
          enabled: data.enabled,
          activated: data.activated,
          watcher_running: false,
        });

        // If failover activated, locks were cleared — re-fetch to get new state
        if (data.activated) {
          await fetchStatus();
        }
      } catch {
        // Network error — silent, retry next interval
      }
    }, FAILOVER_POLL_INTERVAL);
  }, [fetchStatus]);

  // ---------------------------------------------------------------------------
  // Generic lock/unlock helper
  // ---------------------------------------------------------------------------
  const isWatcherRunning = failoverState?.watcher_running ?? false;
  const modemReportsUnlocked =
    modemState?.lte_locked === false && modemState?.nr_locked === false;
  const hasAnyActiveLock =
    modemState?.lte_locked === true ||
    modemState?.nr_locked === true ||
    (!modemReportsUnlocked &&
      (config?.lte?.enabled === true || config?.nr_sa?.enabled === true));

  const sendLockRequest = useCallback(
    async (
      body: Record<string, unknown>,
      setLocking: (v: boolean) => void
    ): Promise<boolean> => {
      // Anti-spam: block new LOCK operations while failover watcher is running.
      // Unlock operations are allowed through — the backend will stop the
      // watcher before sending the AT unlock command.
      if (
        body.action === "lock" &&
        failoverState?.watcher_running &&
        hasAnyActiveLock
      ) {
        setError("Please wait — failover check is still in progress");
        return false;
      }

      setError(null);
      setLocking(true);

      try {
        const resp = await authFetch(`${CGI_BASE}/lock.sh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
        }

        const data: TowerLockResponse = await resp.json();
        if (!mountedRef.current) return false;

        if (!data.success) {
          setError(data.detail || data.error || "Tower lock operation failed");
          return false;
        }

        // Wait for modem to reconnect after lock/unlock command (3-5s typical).
        // isLocking stays true so the spinner remains visible to the user.
        await new Promise((resolve) => setTimeout(resolve, 5000));

        // Re-fetch full state — modem should have reconnected by now
        await fetchStatus();

        // On unlock, stop any active failover polling — the backend killed the
        // watcher before sending the AT command, so there's nothing to poll.
        if (body.action === "unlock" && failoverPollRef.current) {
          clearInterval(failoverPollRef.current);
          failoverPollRef.current = null;
        }

        // If failover is armed, the backend has spawned the watcher because
        // the user had Signal Failover already enabled. Only update runtime
        // state (watcher_running / activated); never force enabled=true —
        // that's the user's explicit toggle and lives in config.failover.
        if (data.failover_armed) {
          setFailoverState((prev) =>
            prev
              ? { ...prev, activated: false, watcher_running: true }
              : { enabled: true, activated: false, watcher_running: true }
          );
          startFailoverPolling();
        }

        return true;
      } catch (err) {
        if (!mountedRef.current) return false;
        setError(
          err instanceof Error
            ? err.message
            : "Tower lock operation failed"
        );
        return false;
      } finally {
        if (mountedRef.current) {
          setLocking(false);
        }
      }
    },
    [
      fetchStatus,
      startFailoverPolling,
      failoverState?.watcher_running,
      hasAnyActiveLock,
    ]
  );

  // ---------------------------------------------------------------------------
  // LTE Lock/Unlock
  // ---------------------------------------------------------------------------
  const lockLte = useCallback(
    async (cells: LteLockCell[]): Promise<boolean> => {
      if (cells.length === 0) {
        setError("At least one EARFCN + PCI pair is required");
        return false;
      }
      return sendLockRequest(
        { type: "lte", action: "lock", cells },
        setIsLteLocking
      );
    },
    [sendLockRequest]
  );

  const unlockLte = useCallback(async (): Promise<boolean> => {
    return sendLockRequest(
      { type: "lte", action: "unlock" },
      setIsLteLocking
    );
  }, [sendLockRequest]);

  // ---------------------------------------------------------------------------
  // NR-SA Lock/Unlock
  // ---------------------------------------------------------------------------
  const lockNrSa = useCallback(
    async (cell: NrSaLockCell): Promise<boolean> => {
      return sendLockRequest(
        {
          type: "nr_sa",
          action: "lock",
          pci: cell.pci,
          arfcn: cell.arfcn,
          scs: cell.scs,
          band: cell.band,
        },
        setIsNrLocking
      );
    },
    [sendLockRequest]
  );

  const unlockNrSa = useCallback(async (): Promise<boolean> => {
    return sendLockRequest(
      { type: "nr_sa", action: "unlock" },
      setIsNrLocking
    );
  }, [sendLockRequest]);

  // ---------------------------------------------------------------------------
  // Update Settings (persist + failover)
  // ---------------------------------------------------------------------------
  const updateSettings = useCallback(
    async (
      persist: boolean,
      failover: { enabled: boolean; threshold: number }
    ): Promise<boolean> => {
      setError(null);

      try {
        const resp = await authFetch(`${CGI_BASE}/settings.sh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            persist,
            failover_enabled: failover.enabled,
            failover_threshold: failover.threshold,
          }),
        });

        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
        }

        const data: TowerSettingsResponse = await resp.json();
        if (!mountedRef.current) return false;

        if (!data.success) {
          setError(data.detail || data.error || "Failed to update settings");
          return false;
        }

        // Optimistic update of config
        setConfig((prev) =>
          prev
            ? {
                ...prev,
                persist,
                failover: {
                  enabled: failover.enabled,
                  threshold: failover.threshold,
                },
              }
            : prev
        );

        // Update failoverState to match (prevents badge desync).
        // When disabling failover, the backend kills the watcher daemon,
        // so clear watcher_running. When the backend spawned the watcher
        // (enabled failover with active lock), set watcher_running.
        if (data.watcher_spawned) {
          setFailoverState((prev) =>
            prev
              ? { ...prev, enabled: true, activated: false, watcher_running: true }
              : { enabled: true, activated: false, watcher_running: true }
          );
          startFailoverPolling();
        } else {
          setFailoverState((prev) =>
            prev
              ? {
                  ...prev,
                  enabled: failover.enabled,
                  ...(failover.enabled ? {} : { watcher_running: false }),
                }
              : { enabled: failover.enabled, activated: false, watcher_running: false }
          );
        }

        return true;
      } catch (err) {
        if (!mountedRef.current) return false;
        setError(
          err instanceof Error ? err.message : "Failed to update settings"
        );
        return false;
      }
    },
    [startFailoverPolling]
  );

  // ---------------------------------------------------------------------------
  // Update Schedule
  // ---------------------------------------------------------------------------
  const updateSchedule = useCallback(
    async (schedule: TowerScheduleConfig): Promise<boolean> => {
      setError(null);

      try {
        const resp = await authFetch(`${CGI_BASE}/schedule.sh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(schedule),
        });

        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
        }

        const data: TowerScheduleResponse = await resp.json();
        if (!mountedRef.current) return false;

        if (!data.success) {
          setError(data.detail || data.error || "Failed to update schedule");
          return false;
        }

        // Optimistic update of config
        setConfig((prev) =>
          prev ? { ...prev, schedule } : prev
        );

        return true;
      } catch (err) {
        if (!mountedRef.current) return false;
        setError(
          err instanceof Error ? err.message : "Failed to update schedule"
        );
        return false;
      }
    },
    []
  );

  // ---------------------------------------------------------------------------
  // Manual refresh
  // ---------------------------------------------------------------------------
  const refresh = useCallback(() => {
    setIsLoading(true);
    fetchStatus();
  }, [fetchStatus]);

  return {
    config,
    modemState,
    failoverState,
    isLoading,
    isLteLocking,
    isNrLocking,
    isWatcherRunning,
    error,
    lockLte,
    unlockLte,
    lockNrSa,
    unlockNrSa,
    updateSettings,
    updateSchedule,
    refresh,
  };
}
