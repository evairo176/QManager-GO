// types/i18n.ts
export type LanguageCode = string; // BCP-47 (e.g., "en", "zh-CN", "fr", "ar")

export type Namespace =
  | "common"
  | "sidebar"
  | "dashboard"
  | "cellular"
  | "local-network"
  | "monitoring"
  | "system-settings"
  | "onboarding"
  | "events"
  | "errors"
  | "at-commands";

export interface LanguageMeta {
  code: LanguageCode;
  native_name: string;
  english_name: string;
  rtl: boolean;
  bundled: boolean;
}

export type LanguageInstallStep =
  | "start"
  | "fetch_catalog"
  | "download"
  | "verify"
  | "extract"
  | "validate"
  | "install"
  | "done"
  | "cancelled"
  | "failed";

export interface LanguagePackInstallState {
  state: "idle" | "running" | "success" | "failed" | "cancelled";
  code?: LanguageCode;
  progress?: number; // 0–100
  /** Stable enum the frontend translates. Empty for older worker builds. */
  step?: LanguageInstallStep | string;
  /** Human fallback emitted by the worker. Used when step is unknown. */
  message?: string;
  error?: string;
}

export interface RemoteManifestEntry {
  code: LanguageCode;
  native_name: string;
  english_name: string;
  rtl: boolean;
  version: string;
  completeness: number;
  size_bytes: number;
  sha256: string;
  url: string;
  contributors?: string[];
}

export interface RemoteManifest {
  manifest_version: 1;
  generated_at: string;
  packs: RemoteManifestEntry[];
}
