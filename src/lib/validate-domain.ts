// Shared hostname validation for the DPI surfaces (CDN hostlist + Traffic
// Masquerade SNI). Returns an i18n key under the `local-network` namespace's
// `shared.*` section, or null when the value is valid. Callers resolve the key
// with their own `t()` so the message stays localized.
//
// One source of truth keeps the two surfaces from drifting apart (they had
// three slightly different copies of this regex before). The character class
// intentionally allows underscores: some CDN hostnames use them, and accepting
// them never rejects a value the stricter rules would have allowed.
const DOMAIN_REGEX = /^[a-zA-Z0-9]([a-zA-Z0-9._-]*[a-zA-Z0-9])?$/;

export function validateDomainKey(
  value: string,
  existing?: string[],
): string | null {
  const trimmed = value.trim();
  if (!trimmed) return "shared.validation_domain_required";
  if (!DOMAIN_REGEX.test(trimmed))
    return "shared.validation_domain_invalid_format";
  if (!trimmed.includes(".")) return "shared.validation_domain_needs_dot";
  if (trimmed.length > 253) return "shared.validation_domain_too_long";
  if (existing?.some((d) => d.toLowerCase() === trimmed.toLowerCase()))
    return "shared.validation_domain_duplicate";
  return null;
}
