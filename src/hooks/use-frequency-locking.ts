"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { authFetch } from "@/lib/auth-fetch";
import { resolveErrorMessage } from "@/lib/i18n/resolve-error";
import type {
  FreqLockModemState,
  FreqLockStatusResponse,
  FreqLockResponse,
  NrFreqLockEntry,
} from "@/types/frequency-locking";

// =============================================================================
// useFrequencyLocking — Frequency Lock State & Lock/Unlock Hook
// =============================================================================
// Manages the frequency locking lifecycle: fetching current lock state from the
// modem, applying/clearing LTE and NR5G frequency locks.
//
// Simpler than useTowerLocking — no config file, no failover, no schedule.
// State lives entirely in the modem (LTE auto-saves, NR5G via save_ctrl).
//
// Also returns tower lock state for mutual exclusion gating.
//
// Backend endpoints:
//   GET  /cgi-bin/quecmanager/frequency/status.sh  → full state + tower gate
//   POST /cgi-bin/quecmanager/frequency/lock.sh    → apply/clear lock
// =============================================================================

const CGI_BASE = "/cgi-bin/quecmanager/frequency";

export interface UseFrequencyLockingReturn {
  /** Live modem frequency lock state */
  modemState: FreqLockModemState | null;
  /** True during initial data fetch */
  isLoading: boolean;
  /** True while an LTE freq lock/unlock is in progress */
  isLteLocking: boolean;
  /** True while an NR freq lock/unlock is in progress */
  isNrLocking: boolean;
  /** Error message from the last operation */
  error: string | null;

  /** Lock LTE to specific EARFCNs (1-2). */
  lockLte: (earfcns: number[]) => Promise<boolean>;
  /** Clear LTE frequency lock. */
  unlockLte: () => Promise<boolean>;
  /** Lock NR to specific EARFCN+SCS entries (1-4 in UI, up to 32 supported). */
  lockNr: (entries: NrFreqLockEntry[]) => Promise<boolean>;
  /** Clear NR frequency lock. */
  unlockNr: () => Promise<boolean>;

  /** Whether LTE tower lock is active (blocks LTE freq lock) */
  towerLockLteActive: boolean;
  /** Whether NR tower lock is active (blocks NR freq lock) */
  towerLockNrActive: boolean;

  /** Manually refresh state. */
  refresh: () => void;
}

export function useFrequencyLocking(): UseFrequencyLockingReturn {
  const { t } = useTranslation("errors");
  const [modemState, setModemState] = useState<FreqLockModemState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLteLocking, setIsLteLocking] = useState(false);
  const [isNrLocking, setIsNrLocking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Fetch frequency lock status (modem queries + tower lock gating)
  // ---------------------------------------------------------------------------
  const MAX_RETRIES = 3;

  const fetchStatus = useCallback(async () => {
    try {
      const resp = await authFetch(`${CGI_BASE}/status.sh`);
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      }

      const data: FreqLockStatusResponse = await resp.json();
      if (!mountedRef.current) return;

      if (!data.success) {
        setError(resolveErrorMessage(t, data.error, undefined, "Failed to fetch frequency lock status"));
        return;
      }

      if (data.modem_state !== null && data.modem_state !== undefined) {
        setModemState(data.modem_state);
      }
      setError(null);
      retryCountRef.current = 0;
    } catch (err) {
      if (!mountedRef.current) return;
      const msg =
        err instanceof Error
          ? err.message
          : "Failed to fetch frequency lock status";
      setError(msg);

      // Auto-retry with exponential backoff (2s, 4s, 8s)
      if (retryCountRef.current < MAX_RETRIES) {
        const delay = Math.pow(2, retryCountRef.current + 1) * 1000;
        retryCountRef.current += 1;
        retryTimerRef.current = setTimeout(() => {
          if (mountedRef.current) {
            fetchStatus();
          }
        }, delay);
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [t]);

  // Initial fetch
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // ---------------------------------------------------------------------------
  // Generic lock/unlock helper
  // ---------------------------------------------------------------------------
  const sendLockRequest = useCallback(
    async (
      body: Record<string, unknown>,
      setLocking: (v: boolean) => void
    ): Promise<boolean> => {
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

        const data: FreqLockResponse = await resp.json();
        if (!mountedRef.current) return false;

        if (!data.success) {
          setError(resolveErrorMessage(t, data.error, data.detail, "Frequency lock operation failed"));
          return false;
        }

        // Wait for modem to reconnect after lock/unlock (3-5s typical)
        await new Promise((resolve) => setTimeout(resolve, 5000));

        // Re-fetch state
        await fetchStatus();

        return true;
      } catch (err) {
        if (!mountedRef.current) return false;
        setError(
          err instanceof Error
            ? err.message
            : "Frequency lock operation failed"
        );
        return false;
      } finally {
        if (mountedRef.current) {
          setLocking(false);
        }
      }
    },
    [fetchStatus, t]
  );

  // ---------------------------------------------------------------------------
  // LTE Lock/Unlock
  // ---------------------------------------------------------------------------
  const lockLte = useCallback(
    async (earfcns: number[]): Promise<boolean> => {
      if (earfcns.length === 0 || earfcns.length > 2) {
        setError("LTE frequency lock requires 1-2 EARFCNs");
        return false;
      }
      return sendLockRequest(
        { type: "lte", action: "lock", earfcns },
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
  // NR Lock/Unlock
  // ---------------------------------------------------------------------------
  const lockNr = useCallback(
    async (entries: NrFreqLockEntry[]): Promise<boolean> => {
      if (entries.length === 0 || entries.length > 32) {
        setError("NR frequency lock requires 1-32 entries");
        return false;
      }
      return sendLockRequest(
        { type: "nr", action: "lock", entries },
        setIsNrLocking
      );
    },
    [sendLockRequest]
  );

  const unlockNr = useCallback(async (): Promise<boolean> => {
    return sendLockRequest(
      { type: "nr", action: "unlock" },
      setIsNrLocking
    );
  }, [sendLockRequest]);

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------
  const towerLockLteActive = modemState?.tower_lock_lte_active ?? false;
  const towerLockNrActive = modemState?.tower_lock_nr_active ?? false;

  // ---------------------------------------------------------------------------
  // Manual refresh
  // ---------------------------------------------------------------------------
  const refresh = useCallback(() => {
    setIsLoading(true);
    fetchStatus();
  }, [fetchStatus]);

  return {
    modemState,
    isLoading,
    isLteLocking,
    isNrLocking,
    error,
    lockLte,
    unlockLte,
    lockNr,
    unlockNr,
    towerLockLteActive,
    towerLockNrActive,
    refresh,
  };
}
