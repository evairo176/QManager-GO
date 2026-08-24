"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { LanguageCode, LanguagePackInstallState } from "@/types/i18n";
import {
  cancelLanguagePackInstall,
  fetchLanguagePackList,
  getLanguagePackInstallStatus,
  removeLanguagePack,
  startLanguagePackInstall,
  type LanguagePackListResponse,
} from "@/lib/i18n/language-pack-client";
import { DEFAULT_MANIFEST_URL } from "@/lib/i18n/language-pack-manifest";
import { resolveErrorMessage } from "@/lib/i18n/resolve-error";

const STATUS_POLL_INTERVAL_MS = 1500;

export interface UseLanguagePacksReturn {
  list: LanguagePackListResponse | null;
  isLoading: boolean;
  isRefetching: boolean;
  listError: string | null;
  install: LanguagePackInstallState;
  startInstall: (code: LanguageCode) => Promise<{ ok: boolean; error?: string }>;
  cancelInstall: () => Promise<void>;
  remove: (code: LanguageCode) => Promise<{ ok: boolean; error?: string }>;
  refetch: () => Promise<void>;
  manifestUrl: string;
}

export function useLanguagePacks(manifestUrl: string = DEFAULT_MANIFEST_URL): UseLanguagePacksReturn {
  const { t } = useTranslation(["system-settings", "errors"]);
  const [list, setList] = useState<LanguagePackListResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefetching, setIsRefetching] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [install, setInstall] = useState<LanguagePackInstallState>({
    state: "idle",
    progress: 0,
  });

  const mountedRef = useRef(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const installActiveRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const fetchList = useCallback(
    async (silent = false) => {
      if (!silent) setIsLoading(true);
      else setIsRefetching(true);
      setListError(null);
      try {
        const result = await fetchLanguagePackList(manifestUrl);
        if (!mountedRef.current) return;
        setList(result);
      } catch (err) {
        if (!mountedRef.current) return;
        setListError(err instanceof Error ? err.message : "Failed to fetch list");
      } finally {
        if (mountedRef.current) {
          if (!silent) setIsLoading(false);
          else setIsRefetching(false);
        }
      }
    },
    [manifestUrl],
  );

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  // Poll install status ONLY while an install is active. Starts in startInstall,
  // stops on terminal state.
  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    installActiveRef.current = false;
  }, []);

  const startPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    installActiveRef.current = true;
    pollRef.current = setInterval(async () => {
      try {
        const status = await getLanguagePackInstallStatus();
        if (!mountedRef.current) return;
        setInstall(status);
        if (
          status.state === "success" ||
          status.state === "failed" ||
          status.state === "cancelled" ||
          status.state === "idle"
        ) {
          stopPolling();
          // Refresh list after a successful or cancelled install; a new pack
          // may have appeared on disk.
          await fetchList(true);
        }
      } catch (err) {
        if (!mountedRef.current) return;
        setInstall({
          state: "failed",
          progress: 100,
          message: err instanceof Error ? err.message : "Poll failed",
        });
        stopPolling();
      }
    }, STATUS_POLL_INTERVAL_MS);
  }, [fetchList, stopPolling]);

  const startInstall = useCallback(
    async (code: LanguageCode) => {
      setInstall({ state: "running", code, progress: 0, message: "" });
      const res = await startLanguagePackInstall(code, manifestUrl);
      if (!res.ok) {
        const message = resolveErrorMessage(
          t,
          res.error,
          undefined,
          t("languages.toast.install_failed_generic", { ns: "system-settings" }),
        );
        setInstall({ state: "failed", code, progress: 100, message });
        return res;
      }
      startPolling();
      return res;
    },
    [manifestUrl, startPolling, t],
  );

  const cancelInstall = useCallback(async () => {
    try {
      await cancelLanguagePackInstall();
    } catch {
      // Swallow — poller will surface failure state.
    }
  }, []);

  const remove = useCallback(
    async (code: LanguageCode) => {
      const res = await removeLanguagePack(code);
      if (res.ok) {
        await fetchList(true);
      }
      return res;
    },
    [fetchList],
  );

  return {
    list,
    isLoading,
    isRefetching,
    listError,
    install,
    startInstall,
    cancelInstall,
    remove,
    refetch: () => fetchList(true),
    manifestUrl,
  };
}
