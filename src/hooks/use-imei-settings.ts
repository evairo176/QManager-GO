"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { authFetch } from "@/lib/auth-fetch";
import { enterRebootFlow } from "@/lib/reboot";
import { resolveErrorMessage } from "@/lib/i18n/resolve-error";
import type {
  BackupImeiConfig,
  ImeiSettingsResponse,
  ImeiSaveRequest,
  ImeiSaveResponse,
} from "@/types/imei-settings";

// =============================================================================
// useImeiSettings — One-Shot IMEI Fetch & Save Hook
// =============================================================================
// Fetches current IMEI (from poller cache) and backup config on mount.
// Provides saveImei for writing new IMEI, saveBackup for backup config,
// and rebootDevice for triggering reboot.
//
// Backend endpoint:
//   GET/POST /cgi-bin/quecmanager/cellular/imei.sh
// =============================================================================

const CGI_ENDPOINT = "/cgi-bin/quecmanager/cellular/imei.sh";

export interface UseImeiSettingsReturn {
  /** Current device IMEI (null before first fetch) */
  currentImei: string | null;
  /** Whether backup IMEI is enabled (null before first fetch) */
  backupEnabled: boolean | null;
  /** Backup IMEI value (null before first fetch) */
  backupImei: string | null;
  /** True while initial fetch is in progress */
  isLoading: boolean;
  /** True while a save operation is in progress */
  isSaving: boolean;
  /** Error message if fetch or save failed */
  error: string | null;
  /** Write new IMEI to modem NVM. Returns true on success. */
  saveImei: (imei: string) => Promise<boolean>;
  /** Save backup IMEI configuration. Returns true on success. */
  saveBackup: (config: BackupImeiConfig) => Promise<boolean>;
  /** Trigger device reboot. Returns true if command was sent. */
  rebootDevice: () => Promise<boolean>;
  /** Re-fetch IMEI data */
  refresh: () => void;
}

export function useImeiSettings(): UseImeiSettingsReturn {
  const { t } = useTranslation("errors");

  const query = useQuery<ImeiSettingsResponse>({
    queryKey: ["imei-settings"],
    queryFn: async () => {
      const resp = await authFetch(CGI_ENDPOINT);
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      }

      const data: ImeiSettingsResponse = await resp.json();

      if (!data.success) {
        throw new Error(
          resolveErrorMessage(t, data.error, undefined, "Failed to fetch IMEI settings")
        );
      }

      return data;
    },
  });

  const saveImeiMutation = useMutation({
    mutationFn: async (imei: string): Promise<boolean> => {
      const request: ImeiSaveRequest = { action: "set_imei", imei };
      const resp = await authFetch(CGI_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });

      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      }

      const data: ImeiSaveResponse = await resp.json();

      if (!data.success) {
        throw new Error(resolveErrorMessage(t, data.error, data.detail, "Failed to write IMEI"));
      }

      return true;
    },
    onSuccess: () => {
      // Silent re-fetch to update local state (no skeleton)
      void query.refetch();
    },
  });

  const saveBackupMutation = useMutation({
    mutationFn: async (config: BackupImeiConfig): Promise<boolean> => {
      const request: ImeiSaveRequest = {
        action: "save_backup",
        enabled: config.enabled,
        backup_imei: config.imei,
      };
      const resp = await authFetch(CGI_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });

      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      }

      const data: ImeiSaveResponse = await resp.json();

      if (!data.success) {
        throw new Error(
          resolveErrorMessage(t, data.error, data.detail, "Failed to save backup configuration")
        );
      }

      return true;
    },
    onSuccess: () => {
      void query.refetch();
    },
  });

  const rebootMutation = useMutation({
    mutationFn: async (): Promise<boolean> => {
      const resp = await authFetch(CGI_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reboot" }),
      });

      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      }

      const data: ImeiSaveResponse = await resp.json();
      if (data.success) {
        enterRebootFlow("imei");
      }
      return data.success;
    },
  });

  const saveImei = async (imei: string): Promise<boolean> => {
    try {
      return await saveImeiMutation.mutateAsync(imei);
    } catch {
      return false;
    }
  };

  const saveBackup = async (config: BackupImeiConfig): Promise<boolean> => {
    try {
      return await saveBackupMutation.mutateAsync(config);
    } catch {
      return false;
    }
  };

  const rebootDevice = async (): Promise<boolean> => {
    try {
      return await rebootMutation.mutateAsync();
    } catch {
      return false;
    }
  };

  return {
    currentImei: query.data?.current_imei ?? null,
    backupEnabled: query.data?.backup.enabled ?? null,
    backupImei: query.data?.backup.imei ?? null,
    isLoading: query.isLoading || query.isPending,
    isSaving: saveImeiMutation.isPending || saveBackupMutation.isPending,
    error:
      query.error?.message ??
      saveImeiMutation.error?.message ??
      saveBackupMutation.error?.message ??
      null,
    saveImei,
    saveBackup,
    rebootDevice,
    refresh: () => {
      void query.refetch();
    },
  };
}
