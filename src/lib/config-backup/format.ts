// lib/config-backup/format.ts
import type { BackupEnvelope, BackupEnvelopeHeader } from "@/types/config-backup";

const SUPPORTED_VERSIONS = new Set([1]);

/** Canonical JSON with fixed top-level key order for AAD. */
export function canonicalHeaderAad(header: BackupEnvelopeHeader): Uint8Array {
  const ordered = {
    magic: header.magic,
    version: header.version,
    created_at: header.created_at,
    device: {
      model: header.device.model,
      firmware: header.device.firmware,
      imei: header.device.imei,
      qmanager_version: header.device.qmanager_version,
    },
    sections_included: [...header.sections_included].sort(),
  };
  return new TextEncoder().encode(JSON.stringify(ordered));
}

export function buildEnvelope(
  header: BackupEnvelopeHeader,
  crypto: Pick<BackupEnvelope, "kdf" | "cipher">,
): BackupEnvelope {
  return { ...header, ...crypto };
}

export function parseEnvelope(blob: string): BackupEnvelope {
  let obj: unknown;
  try {
    obj = JSON.parse(blob);
  } catch {
    throw new Error("invalid_envelope: not JSON");
  }
  if (typeof obj !== "object" || obj === null) {
    throw new Error("invalid_envelope: not an object");
  }
  const e = obj as Partial<BackupEnvelope>;
  if (e.magic !== "QMBACKUP") {
    throw new Error("invalid_envelope: wrong magic");
  }
  if (typeof e.version !== "number" || !SUPPORTED_VERSIONS.has(e.version)) {
    throw new Error(`wrong_version: ${e.version}`);
  }
  if (!e.device || !e.kdf || !e.cipher || !Array.isArray(e.sections_included)) {
    throw new Error("invalid_envelope: missing fields");
  }
  if (
    typeof e.kdf.salt !== "string" ||
    typeof e.kdf.iter !== "number" ||
    typeof e.cipher.iv !== "string" ||
    typeof e.cipher.ciphertext !== "string"
  ) {
    throw new Error("invalid_envelope: missing crypto fields");
  }
  return e as BackupEnvelope;
}

export function envelopeFilename(model: string, created: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const ts =
    created.getUTCFullYear().toString() +
    pad(created.getUTCMonth() + 1) +
    pad(created.getUTCDate()) +
    "-" +
    pad(created.getUTCHours()) +
    pad(created.getUTCMinutes()) +
    pad(created.getUTCSeconds());
  const safeModel = model.replace(/[^A-Za-z0-9_-]/g, "_");
  return `qmanager-${safeModel}-${ts}.qmbackup`;
}
