// =============================================================================
// sms.ts — SMS Center Types
// =============================================================================
// TypeScript interfaces for the SMS Center CGI endpoint.
//
// Backend endpoint: GET/POST /cgi-bin/quecmanager/cellular/sms.sh
//
// Note: The raw JSON from the backend (sms_tool -j recv shape) uses
// `index` (singular), `date`, `text` and lowercase `storage` ("me"/"sm"),
// which differs from the normalized `SmsMessage` shape below. The `useSms`
// hook normalizes raw items into this shape before consumers see them.
// =============================================================================

/** A single (possibly merged multi-part) SMS message */
export interface SmsMessage {
  /** Storage indexes for all parts of this message (used for deletion) */
  indexes: number[];
  /** Sender phone number or alphanumeric ID */
  sender: string;
  /** Message content (concatenated if multi-part) */
  content: string;
  /** Timestamp string (format: "MM/DD/YY HH:MM:SS") */
  timestamp: string;
  /**
   * Which modem memory this message lives in:
   *   "ME" — modem memory (where new incoming messages are routed)
   *   "SM" — SIM card (legacy storage; incoming used to land here)
   * Required so deletion targets the correct storage (AT+CPMS).
   */
  storage: "ME" | "SM";
}

/** Raw item as returned by the backend (`sms_tool -j recv` shape). */
export interface RawSmsItem {
  index?: number;
  indexes?: number[];
  sender?: string;
  date?: string;
  timestamp?: string;
  text?: string;
  content?: string;
  storage?: string;
}

/**
 * Normalize one raw backend item into the SmsMessage shape used by the UI.
 * The modem/backend speaks `index`/`date`/`text`/lowercase-storage; the UI
 * speaks `indexes`/`timestamp`/`content`/uppercase-storage. This function is
 * defensive: missing fields become safe defaults instead of undefined so no
 * downstream `.match()` / `.map()` crashes on a partial item.
 */
export function normalizeSmsItem(item: RawSmsItem): SmsMessage {
  const rawIndexes = Array.isArray(item.indexes)
    ? item.indexes
    : item.index !== undefined && item.index !== null
      ? [item.index]
      : [];
  const storageRaw = (item.storage ?? "me").toLowerCase();
  return {
    indexes: rawIndexes.filter((i): i is number => typeof i === "number"),
    sender: item.sender ?? "-",
    content: item.text ?? item.content ?? "",
    timestamp: item.date ?? item.timestamp ?? "",
    storage: storageRaw === "sm" ? "SM" : "ME",
  };
}

/** Storage status info */
export interface SmsStorage {
  /** Number of messages currently stored */
  used: number;
  /** Maximum storage capacity */
  total: number;
}

/** Response from GET /cgi-bin/quecmanager/cellular/sms.sh */
export interface SmsInboxResponse {
  success: boolean;
  messages: SmsMessage[];
  storage: SmsStorage;
  error?: string;
  detail?: string;
}

/** Generic POST response */
export interface SmsActionResponse {
  success: boolean;
  error?: string;
  detail?: string;
}
