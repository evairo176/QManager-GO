"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { authFetch } from "@/lib/auth-fetch";
import { resolveErrorMessage } from "@/lib/i18n/resolve-error";
import { useLiveInterval } from "@/components/realtime-provider";

// =============================================================================
// useSmsForwarding — Fetch & Save Hook for SMS Forwarding
// =============================================================================
// Reads the forwarding daemon's settings + its persistent failure state, and
// provides save / test / clear-failures actions.
//
// The daemon is the only server-side inbox reader: when it abandons a message
// after 3 failed sends it appends to a failure list that this hook surfaces so
// the UI can raise a persistent alert even when the user wasn't on the page.
//
// Backend: GET/POST /cgi-bin/quecmanager/cellular/sms_forwarding.sh
// =============================================================================

const CGI_ENDPOINT = "/cgi-bin/quecmanager/cellular/sms_forwarding.sh";
// Poll the failure state while mounted so a background failure surfaces without
// a manual refresh. Quiet interval — the daemon itself polls every 15s.
const FAILURE_POLL_MS = 20000;

// ─── Types ─────────────────────────────────────────────────────────────────

export interface SmsForwardingSettings {
  enabled: boolean;
  target_phone: string;
}

export interface SmsForwardingFailure {
  sender: string;
  timestamp: string;
  last_error: string;
}

export interface SmsForwardingData {
  settings: SmsForwardingSettings;
  failures: SmsForwardingFailure[];
  failure_count: number;
}

export interface SmsForwardingSavePayload {
  enabled: boolean;
  target_phone: string;
}

export interface UseSmsForwardingReturn {
  data: SmsForwardingData | null;
  isLoading: boolean;
  isSaving: boolean;
  isSendingTest: boolean;
  isClearing: boolean;
  error: string | null;
  saveSettings: (payload: SmsForwardingSavePayload) => Promise<boolean>;
  sendTest: () => Promise<boolean>;
  clearFailures: () => Promise<boolean>;
  refresh: () => void;
}

// ─── Hook ──────────────────────────────────────────────────────────────────

export function useSmsForwarding(): UseSmsForwardingReturn {
  const { t } = useTranslation("errors");
  const queryClient = useQueryClient();

  const liveInterval = useLiveInterval(FAILURE_POLL_MS);

  const dataKey = ["sms-forwarding"] as const;

  // ---------------------------------------------------------------------------
  // Fetch settings + failure state (with a quiet background poll for failures)
  // ---------------------------------------------------------------------------
  const query = useQuery<SmsForwardingData>({
    queryKey: dataKey,
    queryFn: async () => {
      const resp = await authFetch(CGI_ENDPOINT);
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      }

      const json = await resp.json();

      if (!json.success) {
        throw new Error(
          resolveErrorMessage(
            t,
            json.error,
            json.detail,
            "Failed to fetch forwarding settings",
          ),
        );
      }

      return {
        settings: {
          enabled: !!json.settings?.enabled,
          target_phone: json.settings?.target_phone ?? "",
        },
        failures: Array.isArray(json.failures) ? json.failures : [],
        failure_count:
          typeof json.failure_count === "number"
            ? json.failure_count
            : Array.isArray(json.failures)
              ? json.failures.length
              : 0,
      };
    },
    // Quiet background poll so a background failure surfaces without a manual
    // refresh. TanStack keeps prior data during the refetch, so the poll can
    // never clobber a working view with a loading/error state.
    refetchInterval: liveInterval,
  });

  const data = query.data ?? null;
  const isLoading = query.isLoading || query.isPending;

  const refetchSilent = () => {
    void queryClient.invalidateQueries({ queryKey: dataKey });
  };

  // ---------------------------------------------------------------------------
  // Save settings
  // ---------------------------------------------------------------------------
  const saveMutation = useMutation({
    mutationFn: async (payload: SmsForwardingSavePayload) => {
      const resp = await authFetch(CGI_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save_settings", ...payload }),
      });

      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      }

      const json = await resp.json();

      if (!json.success) {
        throw new Error(
          resolveErrorMessage(
            t,
            json.error,
            json.detail,
            "Failed to save settings",
          ),
        );
      }

      return json;
    },
    onSuccess: () => {
      refetchSilent();
    },
  });

  const saveSettings = async (
    payload: SmsForwardingSavePayload,
  ): Promise<boolean> => {
    try {
      await saveMutation.mutateAsync(payload);
      return true;
    } catch {
      return false;
    }
  };

  // ---------------------------------------------------------------------------
  // Send a test forward to the configured target
  // ---------------------------------------------------------------------------
  const testMutation = useMutation({
    mutationFn: async () => {
      const resp = await authFetch(CGI_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send_test" }),
      });

      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      }

      const json = await resp.json();

      if (!json.success) {
        throw new Error(
          resolveErrorMessage(
            t,
            json.error,
            json.detail,
            "Failed to send test message",
          ),
        );
      }

      return json;
    },
  });

  const sendTest = async (): Promise<boolean> => {
    try {
      await testMutation.mutateAsync();
      return true;
    } catch {
      return false;
    }
  };

  // ---------------------------------------------------------------------------
  // Clear (acknowledge) the failure state
  // ---------------------------------------------------------------------------
  const clearMutation = useMutation({
    mutationFn: async () => {
      const resp = await authFetch(CGI_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clear_failures" }),
      });

      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      }

      const json = await resp.json();

      if (!json.success) {
        throw new Error(
          resolveErrorMessage(
            t,
            json.error,
            json.detail,
            "Failed to clear alerts",
          ),
        );
      }

      return json;
    },
    onSuccess: () => {
      refetchSilent();
    },
  });

  const clearFailures = async (): Promise<boolean> => {
    try {
      await clearMutation.mutateAsync();
      return true;
    } catch {
      return false;
    }
  };

  // The original hook surfaced both fetch AND mutation failures through
  // `error` (the card toasts `error` when a save fails). Preserve that: a
  // failed save/test/clear shows in `error` too.
  const mutationError =
    saveMutation.error || testMutation.error || clearMutation.error;
  const queryError = query.error;
  const error =
    mutationError || queryError
      ? mutationError instanceof Error
        ? mutationError.message
        : queryError instanceof Error
          ? queryError.message
          : "Failed to fetch forwarding settings"
      : null;

  return {
    data,
    isLoading,
    isSaving: saveMutation.isPending,
    isSendingTest: testMutation.isPending,
    isClearing: clearMutation.isPending,
    error,
    saveSettings,
    sendTest,
    clearFailures,
    refresh: () => {
      void query.refetch();
    },
  };
}
