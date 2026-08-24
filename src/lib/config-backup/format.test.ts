// lib/config-backup/format.test.ts
import { describe, it, expect } from "bun:test";
import {
  buildEnvelope,
  parseEnvelope,
  canonicalHeaderAad,
  envelopeFilename,
} from "./format";
import type { BackupEnvelopeHeader } from "@/types/config-backup";

const HEADER: BackupEnvelopeHeader = {
  magic: "QMBACKUP",
  version: 1,
  created_at: "2026-04-13T10:30:00Z",
  device: {
    model: "RM520N-GL",
    firmware: "RM520NGLAAR03A07M4G",
    imei: "860000000000000",
    qmanager_version: "0.1.16",
  },
  sections_included: ["network_mode_apn", "bands"],
};

describe("format", () => {
  it("canonical AAD has stable key order", () => {
    const a = canonicalHeaderAad(HEADER);
    // Rebuild with shuffled object key insertion order
    const shuffled: BackupEnvelopeHeader = {
      sections_included: HEADER.sections_included,
      device: HEADER.device,
      version: 1,
      created_at: HEADER.created_at,
      magic: "QMBACKUP",
    };
    const b = canonicalHeaderAad(shuffled);
    expect(new TextDecoder().decode(a)).toBe(new TextDecoder().decode(b));
  });

  it("parseEnvelope rejects a non-QMBACKUP blob", () => {
    expect(() => parseEnvelope('{"magic":"NOPE","version":1}')).toThrow(/invalid_envelope/);
  });

  it("parseEnvelope rejects a future version", () => {
    const blob = JSON.stringify({ ...HEADER, version: 99, kdf: {}, cipher: {} });
    expect(() => parseEnvelope(blob)).toThrow(/wrong_version/);
  });

  it("buildEnvelope round-trips", () => {
    const env = buildEnvelope(HEADER, {
      kdf: { algo: "PBKDF2-SHA256", iter: 200000, salt: "AAAA" },
      cipher: { algo: "AES-256-GCM", iv: "BBBB", ciphertext: "CCCC" },
    });
    const parsed = parseEnvelope(JSON.stringify(env));
    expect(parsed.magic).toBe("QMBACKUP");
    expect(parsed.kdf.salt).toBe("AAAA");
  });

  it("envelopeFilename uses UTC time", () => {
    // 2026-04-13T10:30:00Z, regardless of host timezone
    const d = new Date(Date.UTC(2026, 3, 13, 10, 30, 0));
    const name = envelopeFilename("RM520N-GL", d);
    expect(name).toBe("qmanager-RM520N-GL-20260413-103000.qmbackup");
  });

  it("parseEnvelope rejects missing crypto fields", () => {
    const blob = JSON.stringify({
      ...HEADER,
      kdf: {},
      cipher: {},
    });
    expect(() => parseEnvelope(blob)).toThrow(/missing crypto fields/);
  });
});
