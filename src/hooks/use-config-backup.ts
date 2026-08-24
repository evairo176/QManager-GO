"use client";

import { useCallback, useState } from "react";
import { authFetch } from "@/lib/auth-fetch";
import {
  deriveKey,
  encryptPayload,
  randomBytes,
  base64Encode,
  CRYPTO_PARAMS,
} from "@/lib/config-backup/crypto";
import {
  buildEnvelope,
  canonicalHeaderAad,
  envelopeFilename,
} from "@/lib/config-backup/format";
import type {
  BackupEnvelopeHeader,
  BackupSectionKey,
} from "@/types/config-backup";

type BackupStage = "idle" | "collecting" | "encrypting" | "downloading" | "done" | "error";
type BackupRunResult = { ok: true } | { ok: false; error: string };

interface CollectResponse {
  schema: 1;
  header: BackupEnvelopeHeader;
  payload: { schema: 1; sections: Partial<Record<BackupSectionKey, unknown>> };
}

export interface UseConfigBackupReturn {
  stage: BackupStage;
  error: string | null;
  runBackup: (selected: BackupSectionKey[], passphrase: string) => Promise<BackupRunResult>;
  reset: () => void;
}

const CGI_BASE = "/cgi-bin/quecmanager/system/config-backup";

export function useConfigBackup(): UseConfigBackupReturn {
  const [stage, setStage] = useState<BackupStage>("idle");
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setStage("idle");
    setError(null);
  }, []);

  const runBackup = useCallback(async (selected: BackupSectionKey[], passphrase: string): Promise<BackupRunResult> => {
    setError(null);
    try {
      if (selected.length === 0) throw new Error("no_sections_selected");
      if (passphrase.length < 10) throw new Error("passphrase_too_short");

      // --- 1. Collect plaintext from server ---
      setStage("collecting");
      const url = `${CGI_BASE}/collect.sh?sections=${encodeURIComponent(selected.join(","))}`;
      const res = await authFetch(url, { method: "GET" });
      if (!res.ok) throw new Error(`collect_failed: HTTP ${res.status}`);
      const data = (await res.json()) as CollectResponse;

      // --- 2. Encrypt in the browser ---
      setStage("encrypting");
      const salt = randomBytes(CRYPTO_PARAMS.SALT_LEN);
      const iv = randomBytes(CRYPTO_PARAMS.IV_LEN);
      const key = await deriveKey(passphrase, salt);
      const aad = canonicalHeaderAad(data.header);
      const plaintext = new TextEncoder().encode(JSON.stringify(data.payload));
      const ct = await encryptPayload(key, iv, plaintext, aad);

      const envelope = buildEnvelope(data.header, {
        kdf: {
          algo: "PBKDF2-SHA256",
          iter: CRYPTO_PARAMS.KDF_ITER,
          salt: base64Encode(salt),
        },
        cipher: {
          algo: "AES-256-GCM",
          iv: base64Encode(iv),
          ciphertext: base64Encode(ct),
        },
      });

      // --- 3. Trigger download ---
      setStage("downloading");
      const blob = new Blob([JSON.stringify(envelope)], { type: "application/octet-stream" });
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objUrl;
      a.download = envelopeFilename(data.header.device.model, new Date());
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objUrl);

      setStage("done");
      return { ok: true };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
      setStage("error");
      return { ok: false, error: message };
    }
  }, []);

  return { stage, error, runBackup, reset };
}
