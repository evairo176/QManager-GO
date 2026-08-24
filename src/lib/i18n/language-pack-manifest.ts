// lib/i18n/language-pack-manifest.ts
import type {
  LanguageCode,
  LanguageMeta,
  RemoteManifest,
  RemoteManifestEntry,
} from "@/types/i18n";

// Default manifest URL. Maintainer can repoint without a firmware update by
// passing a different `manifest_url` query/body param from the frontend.
export const DEFAULT_MANIFEST_URL =
  "https://raw.githubusercontent.com/dr-dolomite/QManager/development-home/language-packs/manifest.json";

export type ManifestParseResult =
  | { ok: true; manifest: RemoteManifest }
  | { ok: false; error: string };

const CODE_PATTERN = /^[a-zA-Z][a-zA-Z0-9-]{0,11}$/;

export function parseManifest(input: unknown): ManifestParseResult {
  if (!input || typeof input !== "object") {
    return { ok: false, error: "not_an_object" };
  }
  const raw = input as Record<string, unknown>;
  if (raw.manifest_version !== 1) {
    return { ok: false, error: "unsupported_manifest_version" };
  }
  if (typeof raw.generated_at !== "string" || !raw.generated_at) {
    return { ok: false, error: "missing_generated_at" };
  }
  if (!Array.isArray(raw.packs)) {
    return { ok: false, error: "missing_packs" };
  }
  const packs: RemoteManifestEntry[] = [];
  for (const entry of raw.packs) {
    const validated = validateEntry(entry);
    if (!validated) continue;
    packs.push(validated);
  }
  return {
    ok: true,
    manifest: {
      manifest_version: 1,
      generated_at: raw.generated_at,
      packs,
    },
  };
}

function validateEntry(raw: unknown): RemoteManifestEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.code !== "string" || !CODE_PATTERN.test(r.code)) return null;
  if (typeof r.native_name !== "string") return null;
  if (typeof r.english_name !== "string") return null;
  if (typeof r.rtl !== "boolean") return null;
  if (typeof r.version !== "string") return null;
  if (typeof r.completeness !== "number") return null;
  if (typeof r.size_bytes !== "number") return null;
  if (typeof r.sha256 !== "string" || r.sha256.length < 32) return null;
  if (typeof r.url !== "string" || !/^https?:\/\//.test(r.url)) return null;
  const contributors =
    Array.isArray(r.contributors) &&
    r.contributors.every((c) => typeof c === "string")
      ? (r.contributors as string[])
      : undefined;
  return {
    code: r.code as LanguageCode,
    native_name: r.native_name,
    english_name: r.english_name,
    rtl: r.rtl,
    version: r.version,
    completeness: Math.max(0, Math.min(1, r.completeness)),
    size_bytes: Math.max(0, r.size_bytes | 0),
    sha256: r.sha256,
    url: r.url,
    contributors,
  };
}

// Version strings are date-style (e.g., "2026.04.17"). Lexicographic compare
// works when zero-padded. Fall back to string compare otherwise.
export function compareVersion(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

// Catalog-view merging: returns per-entry state (built-in / installed /
// available / update-available) using the local catalog + installed list +
// manifest.
export type CatalogRowState =
  | { status: "built_in"; entry: LanguageMeta }
  | { status: "downloaded"; entry: LanguageMeta; version: string; updateAvailableVersion?: string; manifestEntry?: RemoteManifestEntry }
  | { status: "available"; manifestEntry: RemoteManifestEntry };

export interface CatalogBuildInput {
  catalog: readonly LanguageMeta[];
  installed: { code: LanguageCode; version: string }[];
  manifest: RemoteManifest | null;
}

export function buildCatalogView(input: CatalogBuildInput): {
  builtIn: CatalogRowState[];
  downloaded: CatalogRowState[];
  available: CatalogRowState[];
} {
  const { catalog, installed, manifest } = input;

  const installedMap = new Map(installed.map((i) => [i.code, i.version]));
  const manifestMap = new Map(
    (manifest?.packs ?? []).map((p) => [p.code, p]),
  );
  const catalogMap = new Map(catalog.map((e) => [e.code, e]));

  const builtIn: CatalogRowState[] = [];
  const downloaded: CatalogRowState[] = [];
  const seenDownloaded = new Set<LanguageCode>();

  for (const entry of catalog) {
    if (entry.bundled) {
      builtIn.push({ status: "built_in", entry });
    }
  }

  // Downloaded = installed - built-in
  for (const [code, version] of installedMap) {
    const catalogEntry = catalogMap.get(code);
    if (catalogEntry?.bundled) continue; // built-in, already handled
    const baseMeta: LanguageMeta =
      catalogEntry ??
      {
        code,
        native_name: manifestMap.get(code)?.native_name ?? code,
        english_name: manifestMap.get(code)?.english_name ?? code,
        rtl: manifestMap.get(code)?.rtl ?? false,
        bundled: false,
      };
    const manifestEntry = manifestMap.get(code);
    const updateAvailable =
      manifestEntry && version && compareVersion(manifestEntry.version, version) > 0
        ? manifestEntry.version
        : undefined;
    downloaded.push({
      status: "downloaded",
      entry: baseMeta,
      version: version || "",
      updateAvailableVersion: updateAvailable,
      manifestEntry,
    });
    seenDownloaded.add(code);
  }

  // Available = manifest - installed - bundled
  const available: CatalogRowState[] = [];
  for (const manifestEntry of manifest?.packs ?? []) {
    if (seenDownloaded.has(manifestEntry.code)) continue;
    if (catalogMap.get(manifestEntry.code)?.bundled) continue;
    available.push({ status: "available", manifestEntry });
  }

  return { builtIn, downloaded, available };
}
