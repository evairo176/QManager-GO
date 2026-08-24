"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import { authFetch } from "@/lib/auth-fetch";
import {
  deriveKey,
  decryptPayload,
  base64Decode,
} from "@/lib/config-backup/crypto";
import {
  parseEnvelope,
  canonicalHeaderAad,
} from "@/lib/config-backup/format";
import type {
  BackupEnvelope,
  BackupPayload,
  RestoreProgress,
  RestoreUiState,
} from "@/types/config-backup";

const CGI_BASE = "/cgi-bin/quecmanager/system/config-backup";
const POLL_INTERVAL_MS = 500;

interface State {
  ui: RestoreUiState;
  envelope: BackupEnvelope | null;
  payload: BackupPayload | null;
  progress: RestoreProgress | null;
  error: string | null;
}

type Action =
  | { type: "reset" }
  | { type: "start_reading" }
  | { type: "envelope_parsed"; envelope: BackupEnvelope }
  | { type: "password_bad" }
  | { type: "decrypted"; payload: BackupPayload; needsModelWarning: boolean }
  | { type: "model_warning_ack" }
  | { type: "apply_started" }
  | { type: "progress"; progress: RestoreProgress }
  | { type: "apply_done"; progress: RestoreProgress }
  | { type: "error"; message: string };

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case "reset":
      return { ui: "idle", envelope: null, payload: null, progress: null, error: null };
    case "start_reading":
      return { ...s, ui: "reading", error: null };
    case "envelope_parsed":
      return { ...s, envelope: a.envelope, ui: "password_required" };
    case "password_bad":
      return { ...s, ui: "password_incorrect" };
    case "decrypted":
      return {
        ...s,
        payload: a.payload,
        ui: a.needsModelWarning ? "model_warning" : "ready",
      };
    case "model_warning_ack":
      return { ...s, ui: "ready" };
    case "apply_started":
      return { ...s, ui: "applying", progress: null };
    case "progress":
      return { ...s, progress: a.progress };
    case "apply_done": {
      const summary = a.progress.summary;
      const ui: RestoreUiState =
        summary && (summary.failed > 0 || summary.skipped > 0)
          ? "partial_success"
          : "success";
      return { ...s, progress: a.progress, ui };
    }
    case "error":
      return { ...s, error: a.message, ui: "failed" };
    default:
      return s;
  }
}

export function useConfigRestore(currentModel: string) {
  const [state, dispatch] = useReducer(reducer, {
    ui: "idle",
    envelope: null,
    payload: null,
    progress: null,
    error: null,
  });

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const readFile = useCallback(async (file: File) => {
    dispatch({ type: "start_reading" });
    try {
      const text = await file.text();
      const envelope = parseEnvelope(text);
      dispatch({ type: "envelope_parsed", envelope });
    } catch (e) {
      dispatch({ type: "error", message: e instanceof Error ? e.message : String(e) });
    }
  }, []);

  const tryPassword = useCallback(
    async (passphrase: string) => {
      if (!state.envelope) return;
      try {
        const salt = base64Decode(state.envelope.kdf.salt);
        const iv = base64Decode(state.envelope.cipher.iv);
        const ct = base64Decode(state.envelope.cipher.ciphertext);
        const key = await deriveKey(passphrase, salt, state.envelope.kdf.iter);
        const aad = canonicalHeaderAad(state.envelope);
        const pt = await decryptPayload(key, iv, ct, aad);
        const payload = JSON.parse(new TextDecoder().decode(pt)) as BackupPayload;
        const needsWarning =
          currentModel !== "" && state.envelope.device.model !== currentModel;
        dispatch({ type: "decrypted", payload, needsModelWarning: needsWarning });
      } catch {
        dispatch({ type: "password_bad" });
      }
    },
    [state.envelope, currentModel],
  );

  const confirmModelWarning = useCallback(() => {
    dispatch({ type: "model_warning_ack" });
  }, []);

  const startApply = useCallback(async () => {
    if (!state.payload) return;
    dispatch({ type: "apply_started" });
    try {
      const res = await authFetch(`${CGI_BASE}/apply.sh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state.payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error || `HTTP ${res.status}`);
      }
      // Start polling
      pollRef.current = setInterval(async () => {
        try {
          const r = await authFetch(`${CGI_BASE}/apply_status.sh`);
          if (!r.ok) return;
          const p = (await r.json()) as RestoreProgress;
          dispatch({ type: "progress", progress: p });
          if (p.status === "done" || p.status === "cancelled") {
            stopPolling();
            dispatch({ type: "apply_done", progress: p });
          }
        } catch {
          /* ignore transient polling errors */
        }
      }, POLL_INTERVAL_MS);
    } catch (e) {
      dispatch({ type: "error", message: e instanceof Error ? e.message : String(e) });
    }
  }, [state.payload, stopPolling]);

  const cancel = useCallback(async () => {
    await authFetch(`${CGI_BASE}/apply_cancel.sh`, { method: "POST" }).catch(() => {});
  }, []);

  const reset = useCallback(() => {
    stopPolling();
    dispatch({ type: "reset" });
  }, [stopPolling]);

  return {
    state,
    readFile,
    tryPassword,
    confirmModelWarning,
    startApply,
    cancel,
    reset,
  };
}
