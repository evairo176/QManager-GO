// lib/config-backup/crypto.test.ts
import { describe, it, expect } from "bun:test";
import {
  deriveKey,
  encryptPayload,
  decryptPayload,
  randomBytes,
  base64Encode,
  base64Decode,
  CRYPTO_PARAMS,
} from "./crypto";

describe("crypto", () => {
  it("roundtrips a payload", async () => {
    const salt = randomBytes(CRYPTO_PARAMS.SALT_LEN);
    const iv = randomBytes(CRYPTO_PARAMS.IV_LEN);
    const key = await deriveKey("correct-horse-battery", salt);
    const plaintext = new TextEncoder().encode('{"hello":"world"}');
    const aad = new TextEncoder().encode('{"magic":"QMBACKUP"}');

    const ct = await encryptPayload(key, iv, plaintext, aad);
    const pt = await decryptPayload(key, iv, ct, aad);

    expect(new TextDecoder().decode(pt)).toBe('{"hello":"world"}');
  });

  it("fails with wrong password", async () => {
    const salt = randomBytes(CRYPTO_PARAMS.SALT_LEN);
    const iv = randomBytes(CRYPTO_PARAMS.IV_LEN);
    const goodKey = await deriveKey("correct-password", salt);
    const badKey = await deriveKey("wrong-password", salt);
    const plaintext = new TextEncoder().encode("secret");
    const aad = new Uint8Array();

    const ct = await encryptPayload(goodKey, iv, plaintext, aad);
    await expect(decryptPayload(badKey, iv, ct, aad)).rejects.toThrow();
  });

  it("fails with tampered AAD", async () => {
    const salt = randomBytes(CRYPTO_PARAMS.SALT_LEN);
    const iv = randomBytes(CRYPTO_PARAMS.IV_LEN);
    const key = await deriveKey("pw", salt);
    const plaintext = new TextEncoder().encode("secret");
    const aad1 = new TextEncoder().encode("header-v1");
    const aad2 = new TextEncoder().encode("header-v2");

    const ct = await encryptPayload(key, iv, plaintext, aad1);
    await expect(decryptPayload(key, iv, ct, aad2)).rejects.toThrow();
  });

  it("base64 roundtrips binary data", () => {
    const bytes = new Uint8Array([0, 1, 2, 253, 254, 255]);
    expect(base64Decode(base64Encode(bytes))).toEqual(bytes);
  });
});
