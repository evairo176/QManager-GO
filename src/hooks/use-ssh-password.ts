"use client";

import { useCallback, useState } from "react";
import { authFetch } from "@/lib/auth-fetch";
import type {
  SshPasswordChangeRequest,
  SshPasswordChangeResponse,
} from "@/types/ssh-password";

// =============================================================================
// useSshPassword — Mutation hook for changing the SSH root password
// =============================================================================
// Posts to /cgi-bin/quecmanager/system/ssh_password.sh. Returns true on
// success, false on any failure (error message is populated in `error`).
// The QManager web session is NOT affected by a successful change.
// =============================================================================

const CGI_ENDPOINT = "/cgi-bin/quecmanager/system/ssh_password.sh";

function humanizeError(code: string, detail?: string): string {
  switch (code) {
    case "missing_fields":
      return "Both current and new password are required.";
    case "password_weak":
      return detail || "New password does not meet the policy.";
    case "invalid_password":
      return "Current password is incorrect.";
    case "shadow_unreadable":
      return "Could not read system password file.";
    case "no_password_set":
      return "Root account has no password set. Set one from the device shell first.";
    case "hash_parse_failed":
      return "Unsupported password hash format on this device.";
    case "hash_tool_missing":
      return "Password validation tool is not installed on this device.";
    case "passwd_failed":
      return "Failed to apply the new password.";
    case "method_not_allowed":
      return "Unexpected request method.";
    default:
      return detail || "SSH password change failed.";
  }
}

export interface UseSshPasswordReturn {
  changePassword: (
    currentPassword: string,
    newPassword: string,
    enforceStrong: boolean
  ) => Promise<boolean>;
  isPending: boolean;
  error: string | null;
  clearError: () => void;
}

export function useSshPassword(): UseSshPasswordReturn {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const changePassword = useCallback(
    async (
      currentPassword: string,
      newPassword: string,
      enforceStrong: boolean
    ): Promise<boolean> => {
      setError(null);
      setIsPending(true);

      try {
        const body: SshPasswordChangeRequest = {
          current_password: currentPassword,
          new_password: newPassword,
          enforce_strong: enforceStrong,
        };

        const resp = await authFetch(CGI_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!resp.ok && resp.status !== 400 && resp.status !== 401) {
          setError(`Request failed (HTTP ${resp.status}).`);
          return false;
        }

        const data = (await resp.json()) as SshPasswordChangeResponse;

        if (!data.success) {
          setError(humanizeError(data.error, data.detail));
          return false;
        }

        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "SSH password change failed.");
        return false;
      } finally {
        setIsPending(false);
      }
    },
    []
  );

  return { changePassword, isPending, error, clearError };
}
