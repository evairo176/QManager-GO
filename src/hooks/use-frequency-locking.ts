"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
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

  const query = useQuery<FreqLockStatusResponse>({
    queryKey: ["frequency-locking"],
    queryFn: async () => {
      const resp = await authFetch(`${CGI_BASE}/status.sh`);
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      }

      const data: FreqLockStatusResponse = await resp.json();

      if (!data.success) {
        throw new Error(
          resolveErrorMessage(t, data.error, undefined, "Failed to fetch frequency lock status")
        );
      }

      return data;
    },
    // Auto-retry with exponential backoff (2s, 4s, 8s) — mirrors the old
    // retryCountRef/manual setTimeout logic.
    retry: 3,
    retryDelay: (attemptIndex) => Math.pow(2, attemptIndex + 1) * 1000,
  });

  // Generic lock/unlock helper
  const sendLockRequest = async (
    body: Record<string, unknown>
  ): Promise<boolean> => {
    const resp = await authFetch(`${CGI_BASE}/lock.sh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
    }

    const data: FreqLockResponse = await resp.json();

    if (!data.success) {
      throw new Error(
        resolveErrorMessage(t, data.error, data.detail, "Frequency lock operation failed")
      );
    }

    // Wait for modem to reconnect after lock/unlock (3-5s typical)
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Re-fetch state
    await query.refetch();

    return true;
  };

  const lteMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>): Promise<boolean> => {
      return sendLockRequest(body);
    },
  });

  const nrMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>): Promise<boolean> => {
      return sendLockRequest(body);
    },
  });

  const lockLte = async (earfcns: number[]): Promise<boolean> => {
    if (earfcns.length === 0 || earfcns.length > 2) {
      return false;
    }
    try {
      return await lteMutation.mutateAsync({ type: "lte", action: "lock", earfcns });
    } catch {
      return false;
    }
  };

  const unlockLte = async (): Promise<boolean> => {
    try {
      return await lteMutation.mutateAsync({ type: "lte", action: "unlock" });
    } catch {
      return false;
    }
  };

  const lockNr = async (entries: NrFreqLockEntry[]): Promise<boolean> => {
    if (entries.length === 0 || entries.length > 32) {
      return false;
    }
    try {
      return await nrMutation.mutateAsync({ type: "nr", action: "lock", entries });
    } catch {
      return false;
    }
  };

  const unlockNr = async (): Promise<boolean> => {
    try {
      return await nrMutation.mutateAsync({ type: "nr", action: "unlock" });
    } catch {
      return false;
    }
  };

  const modemState = query.data?.modem_state ?? null;

  return {
    modemState,
    isLoading: query.isLoading || query.isPending,
    isLteLocking: lteMutation.isPending,
    isNrLocking: nrMutation.isPending,
    error:
      query.error?.message ??
      lteMutation.error?.message ??
      nrMutation.error?.message ??
      null,
    lockLte,
    unlockLte,
    lockNr,
    unlockNr,
    towerLockLteActive: modemState?.tower_lock_lte_active ?? false,
    towerLockNrActive: modemState?.tower_lock_nr_active ?? false,
    refresh: () => {
      void query.refetch();
    },
  };
}
