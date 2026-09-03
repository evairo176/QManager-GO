"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authFetch } from "@/lib/auth-fetch";
import { normalizeSmsItem } from "@/types/sms";
import type {
  SmsMessage,
  SmsStorage,
  SmsInboxResponse,
  SmsActionResponse,
  RawSmsItem,
} from "@/types/sms";

// =============================================================================
// useSms — SMS Inbox Fetch & Mutation Hook
// =============================================================================
// Fetches inbox messages + storage status on mount (TanStack Query, no
// polling — the inbox only re-fetches after mutations or on manual refresh).
// Provides sendSms, deleteSms, deleteAllSms mutations.
//
// Backend endpoint:
//   GET/POST /cgi-bin/quecmanager/cellular/sms.sh
// =============================================================================

const CGI_ENDPOINT = "/cgi-bin/quecmanager/cellular/sms.sh";

export interface SmsData {
  messages: SmsMessage[];
  storage: SmsStorage;
}

export interface UseSmsReturn {
  /** Current SMS data (null before first fetch) */
  data: SmsData | null;
  /** True while initial fetch is in progress */
  isLoading: boolean;
  /** True while a send/delete operation is in progress */
  isSaving: boolean;
  /** Error message if any operation failed */
  error: string | null;
  /** Send an SMS message. Returns true on success. */
  sendSms: (phone: string, message: string) => Promise<boolean>;
  /** Delete a message by its storage indexes. Returns true on success.
   *  `storage` selects which modem memory (ME / SM) the indexes live in;
   *  the backend deletes one storage per call. */
  deleteSms: (indexes: number[], storage: "ME" | "SM") => Promise<boolean>;
  /** Delete all messages. Returns true on success. */
  deleteAllSms: () => Promise<boolean>;
  /** Re-fetch inbox data. Pass true for silent (no loading skeleton). */
  refresh: (silent?: boolean) => void;
}

export function useSms(): UseSmsReturn {
  const queryClient = useQueryClient();

  const inboxKey = ["sms-inbox"] as const;

  // ---------------------------------------------------------------------------
  // Fetch inbox messages + storage status
  // ---------------------------------------------------------------------------
  const query = useQuery<SmsData>({
    queryKey: inboxKey,
    queryFn: async () => {
      const resp = await authFetch(CGI_ENDPOINT);
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      }

      const json: SmsInboxResponse = await resp.json();

      if (!json.success) {
        throw new Error(json.detail || json.error || "Failed to fetch SMS inbox");
      }

      const rawMessages = (json.messages || []) as RawSmsItem[];

      return {
        messages: rawMessages.map(normalizeSmsItem),
        storage: json.storage || { used: 0, total: 0 },
      };
    },
    // The original fetched once on mount and after each mutation — no interval.
    refetchInterval: false,
  });

  const data = query.data ?? null;
  const isLoading = query.isLoading || query.isPending;

  const error = query.error
    ? query.error instanceof Error
      ? query.error.message
      : "Failed to fetch SMS inbox"
    : null;

  /** Silent re-fetch (no loading skeleton) after a mutation completes. */
  const refetchInboxSilent = () => {
    void queryClient.invalidateQueries({ queryKey: inboxKey });
  };

  // ---------------------------------------------------------------------------
  // Send SMS
  // ---------------------------------------------------------------------------
  const sendMutation = useMutation({
    mutationFn: async ({
      phone,
      message,
    }: {
      phone: string;
      message: string;
    }) => {
      const resp = await authFetch(CGI_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send", phone, message }),
      });

      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      }

      const json: SmsActionResponse = await resp.json();

      if (!json.success) {
        throw new Error(json.detail || json.error || "Failed to send SMS");
      }

      return json;
    },
    onSuccess: () => {
      // Delayed silent re-fetch — modem needs a moment to process the sent
      // message.
      setTimeout(() => {
        refetchInboxSilent();
      }, 1000);
    },
  });

  const sendSms = async (phone: string, message: string): Promise<boolean> => {
    try {
      await sendMutation.mutateAsync({ phone, message });
      return true;
    } catch {
      return false;
    }
  };

  // ---------------------------------------------------------------------------
  // Delete single message
  // ---------------------------------------------------------------------------
  const deleteMutation = useMutation({
    mutationFn: async ({
      indexes,
      storage,
    }: {
      indexes: number[];
      storage: "ME" | "SM";
    }) => {
      const resp = await authFetch(CGI_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", indexes, storage }),
      });

      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      }

      const json: SmsActionResponse = await resp.json();

      if (!json.success) {
        throw new Error(json.detail || json.error || "Failed to delete message");
      }

      return json;
    },
    onSuccess: () => {
      // Silent re-fetch to update inbox
      refetchInboxSilent();
    },
  });

  const deleteSms = async (
    indexes: number[],
    storage: "ME" | "SM",
  ): Promise<boolean> => {
    try {
      await deleteMutation.mutateAsync({ indexes, storage });
      return true;
    } catch {
      return false;
    }
  };

  // ---------------------------------------------------------------------------
  // Delete all messages
  // ---------------------------------------------------------------------------
  const deleteAllMutation = useMutation({
    mutationFn: async () => {
      const resp = await authFetch(CGI_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_all" }),
      });

      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      }

      const json: SmsActionResponse = await resp.json();

      if (!json.success) {
        throw new Error(
          json.detail || json.error || "Failed to delete all messages",
        );
      }

      return json;
    },
    onSuccess: () => {
      // Silent re-fetch to update inbox
      refetchInboxSilent();
    },
  });

  const deleteAllSms = async (): Promise<boolean> => {
    try {
      await deleteAllMutation.mutateAsync();
      return true;
    } catch {
      return false;
    }
  };

  return {
    data,
    isLoading,
    isSaving:
      sendMutation.isPending ||
      deleteMutation.isPending ||
      deleteAllMutation.isPending,
    error,
    sendSms,
    deleteSms,
    deleteAllSms,
    refresh: (silent = false) => {
      if (silent) {
        refetchInboxSilent();
      } else {
        void query.refetch();
      }
    },
  };
}
