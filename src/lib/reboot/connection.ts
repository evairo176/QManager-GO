// lib/reboot/connection.ts
//
// Connection-health evaluation for the dashboard auto-logout poller.
//
// The pure reducer (evaluateConnection) decides what to do given the previous
// state and whether the latest poll succeeded. Keeping it pure makes it unit-
// testable under Bun (no DOM). The hook layer (use-auto-logout) owns the timer
// and applies the resulting action; the reconnecting banner subscribes to the
// reported status via a same-tab event.

/** Consecutive failures before showing the "reconnecting" banner. */
export const WARN_AT = 2;

/** Consecutive failures before giving up and redirecting away. ~9s at the 3s poll in use-auto-logout. */
export const FAILURE_THRESHOLD = 3;

export interface ConnectionState {
  consecutiveFailures: number;
}

export const INITIAL_CONNECTION_STATE: ConnectionState = {
  consecutiveFailures: 0,
};

export type ConnectionAction = "none" | "redirect";

export interface ConnectionEvaluation {
  state: ConnectionState;
  /** Whether the reconnecting banner should be visible. */
  showBanner: boolean;
  /** Whether the caller should redirect away (reboot countdown or login). */
  action: ConnectionAction;
}

export function evaluateConnection(
  prev: ConnectionState,
  pollSucceeded: boolean
): ConnectionEvaluation {
  if (pollSucceeded) {
    return {
      state: { consecutiveFailures: 0 },
      showBanner: false,
      action: "none",
    };
  }

  const consecutiveFailures = prev.consecutiveFailures + 1;
  return {
    state: { consecutiveFailures },
    showBanner: consecutiveFailures >= WARN_AT,
    action: consecutiveFailures >= FAILURE_THRESHOLD ? "redirect" : "none",
  };
}

// ── Reconnecting-status signal (same-tab event, mirrors pending-reboot) ──────

const RECONNECTING_KEY = "qm_reconnecting";
const RECONNECTING_EVENT = "qmanager:connection-changed";

/** Publish whether the "reconnecting" banner should currently show. */
export function reportConnectionState(reconnecting: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (reconnecting) {
      window.sessionStorage.setItem(RECONNECTING_KEY, "1");
    } else {
      window.sessionStorage.removeItem(RECONNECTING_KEY);
    }
    window.dispatchEvent(new Event(RECONNECTING_EVENT));
  } catch {
    /* sessionStorage unavailable — banner simply won't show */
  }
}

function readReconnecting(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(RECONNECTING_KEY) === "1";
  } catch {
    return false;
  }
}

// React subscription hook for the reconnecting flag. (Imported lazily by the
// banner component.)
import { useEffect, useState } from "react";

export function useConnectionStatus(): { reconnecting: boolean } {
  const [reconnecting, setReconnecting] = useState(false);

  useEffect(() => {
    setReconnecting(readReconnecting());
    const sync = () => setReconnecting(readReconnecting());
    window.addEventListener(RECONNECTING_EVENT, sync);
    return () => window.removeEventListener(RECONNECTING_EVENT, sync);
  }, []);

  return { reconnecting };
}
