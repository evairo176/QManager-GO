// lib/config-backup/crypto.ts

const PBKDF2_ITER = 200_000;

function toFixedBuffer(u: Uint8Array): Uint8Array<ArrayBuffer> {
  return new Uint8Array(u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength)) as Uint8Array<ArrayBuffer>;
}

export function randomBytes(len: number): Uint8Array<ArrayBuffer> {
  const buf = new Uint8Array(len);
  crypto.getRandomValues(buf);
  return buf;
}

export function base64Encode(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

export function base64Decode(b64: string): Uint8Array<ArrayBuffer> {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

/** Derive a 256-bit AES-GCM key from a passphrase + salt via PBKDF2-SHA256. */
export async function deriveKey(
  passphrase: string,
  salt: Uint8Array,
  iter: number = PBKDF2_ITER,
): Promise<CryptoKey> {
  const passKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    { name: "PBKDF2" },
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", iterations: iter, salt: toFixedBuffer(salt) },
    passKey,
    { name: "AES-GCM", length: 256 },
    false, // non-extractable
    ["encrypt", "decrypt"],
  );
}

/** Encrypt plaintext → ciphertext (includes 16-byte GCM tag appended). */
export async function encryptPayload(
  key: CryptoKey,
  iv: Uint8Array,
  plaintext: Uint8Array,
  aad: Uint8Array,
): Promise<Uint8Array<ArrayBuffer>> {
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: toFixedBuffer(iv), additionalData: toFixedBuffer(aad), tagLength: 128 },
    key,
    toFixedBuffer(plaintext),
  );
  return new Uint8Array(ct);
}

/** Decrypt ciphertext (with appended tag) → plaintext. Throws on auth failure. */
export async function decryptPayload(
  key: CryptoKey,
  iv: Uint8Array,
  ciphertext: Uint8Array,
  aad: Uint8Array,
): Promise<Uint8Array<ArrayBuffer>> {
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: toFixedBuffer(iv), additionalData: toFixedBuffer(aad), tagLength: 128 },
    key,
    toFixedBuffer(ciphertext),
  );
  return new Uint8Array(pt);
}

export const CRYPTO_PARAMS = {
  KDF_ITER: PBKDF2_ITER,
  SALT_LEN: 16,
  IV_LEN: 12,
  KEY_BITS: 256,
} as const;
