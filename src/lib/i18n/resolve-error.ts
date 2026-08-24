import type { TFunction } from "i18next";

/**
 * Resolve a backend error response into a user-facing message.
 *
 * Backends emit two shapes:
 *   { error: "<code>", detail?: "<string>" }
 *   { success: false, error: "<code>", detail?: "<string>" }
 *
 * This helper normalizes both. It tries (in order):
 *   1. Known code — return `t(code)` from the errors namespace.
 *   2. Unknown code WITH detail — return "Modem reported: {detail}"
 *      (`errors.unknown_with_detail` interpolated).
 *   3. No code but detail — return the detail verbatim.
 *   4. Neither — return the fallback string (provided by caller).
 *
 * The caller passes `t` already bound to `useTranslation("errors")` OR
 * any other hook via the cross-namespace shape — we resolve with explicit
 * `ns: "errors"` so the caller doesn't need a separate errors hook.
 */
export function resolveErrorMessage(
  t: TFunction,
  code: string | undefined | null,
  detail: string | undefined | null,
  fallback: string,
): string {
  const trimmedCode = code?.trim();
  const trimmedDetail = detail?.trim();

  if (trimmedCode) {
    // defaultValue: "" lets us detect missing translations without
    // rendering the key string.
    const translated = t(trimmedCode, { ns: "errors", defaultValue: "" });
    if (translated) return translated;
    if (trimmedDetail) {
      return t("unknown_with_detail", {
        ns: "errors",
        detail: trimmedDetail,
      });
    }
    return fallback;
  }

  if (trimmedDetail) return trimmedDetail;
  return fallback;
}
