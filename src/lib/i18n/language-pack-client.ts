// lib/i18n/language-pack-client.ts
import { authFetch } from "@/lib/auth-fetch";
import type { LanguageCode, LanguagePackInstallState, RemoteManifest } from "@/types/i18n";
import { parseManifest } from "./language-pack-manifest";

const CGI_BASE = "/cgi-bin/quecmanager/system/language-packs";

export interface InstalledPack {
  code: LanguageCode;
  version: string;
}

export interface LanguagePackListResponse {
  installed: InstalledPack[];
  manifest: RemoteManifest | null;
  manifest_error: string | null;
}

export async function fetchLanguagePackList(
  manifestUrl: string,
): Promise<LanguagePackListResponse> {
  const url = `${CGI_BASE}/list.sh?manifest_url=${encodeURIComponent(manifestUrl)}`;
  const resp = await authFetch(url);
  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
  }
  const raw = await resp.json();
  const installed: InstalledPack[] = Array.isArray(raw.installed) ? raw.installed : [];
  let manifest: RemoteManifest | null = null;
  if (raw.manifest && !raw.manifest_error) {
    const parsed = parseManifest(raw.manifest);
    if (parsed.ok) manifest = parsed.manifest;
  }
  const manifestError: string | null =
    typeof raw.manifest_error === "string" ? raw.manifest_error : null;
  return { installed, manifest, manifest_error: manifestError };
}

export async function startLanguagePackInstall(
  code: LanguageCode,
  manifestUrl: string,
): Promise<{ ok: boolean; error?: string }> {
  const resp = await authFetch(`${CGI_BASE}/install.sh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, manifest_url: manifestUrl }),
  });
  if (resp.status === 409) {
    return { ok: false, error: "install_in_progress" };
  }
  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    return { ok: false, error: body.error || `http_${resp.status}` };
  }
  return { ok: true };
}

export async function getLanguagePackInstallStatus(): Promise<LanguagePackInstallState> {
  const resp = await authFetch(`${CGI_BASE}/install_status.sh`);
  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
  }
  const raw = await resp.json();
  return {
    state: raw.state ?? "idle",
    code: raw.code || undefined,
    progress: typeof raw.progress === "number" ? raw.progress : 0,
    message: raw.message || undefined,
  };
}

export async function cancelLanguagePackInstall(): Promise<void> {
  const resp = await authFetch(`${CGI_BASE}/install_cancel.sh`, { method: "POST" });
  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
  }
}

export async function removeLanguagePack(
  code: LanguageCode,
): Promise<{ ok: boolean; error?: string }> {
  const resp = await authFetch(`${CGI_BASE}/remove.sh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    return { ok: false, error: body.error || `http_${resp.status}` };
  }
  return { ok: true };
}
