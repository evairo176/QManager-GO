// lib/i18n/__tests__/language-pack-manifest.test.ts
import { describe, expect, test } from "bun:test";
import {
  buildCatalogView,
  compareVersion,
  parseManifest,
} from "../language-pack-manifest";
import type { LanguageMeta, RemoteManifest } from "@/types/i18n";

const sampleManifestRaw = {
  manifest_version: 1,
  generated_at: "2026-04-17T00:00:00Z",
  packs: [
    {
      code: "fr",
      native_name: "Français",
      english_name: "French",
      rtl: false,
      version: "2026.04.17",
      completeness: 0.92,
      size_bytes: 38500,
      sha256: "a".repeat(64),
      url: "https://example.com/fr.tar.gz",
      contributors: ["alice"],
    },
    {
      code: "ar",
      native_name: "العربية",
      english_name: "Arabic",
      rtl: true,
      version: "2026.03.01",
      completeness: 0.78,
      size_bytes: 42000,
      sha256: "b".repeat(64),
      url: "https://example.com/ar.tar.gz",
    },
  ],
};

describe("parseManifest", () => {
  test("accepts a well-formed manifest", () => {
    const res = parseManifest(sampleManifestRaw);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.manifest.packs).toHaveLength(2);
    expect(res.manifest.packs[0].code).toBe("fr");
    expect(res.manifest.packs[1].rtl).toBe(true);
  });

  test("rejects wrong manifest_version", () => {
    const res = parseManifest({ ...sampleManifestRaw, manifest_version: 2 });
    expect(res.ok).toBe(false);
  });

  test("drops malformed entries but keeps valid ones", () => {
    const res = parseManifest({
      ...sampleManifestRaw,
      packs: [
        sampleManifestRaw.packs[0],
        { code: "!bad", native_name: "x", english_name: "x", rtl: false, version: "v", completeness: 0, size_bytes: 0, sha256: "short", url: "ftp://x" },
      ],
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.manifest.packs).toHaveLength(1);
    expect(res.manifest.packs[0].code).toBe("fr");
  });

  test("rejects non-object input", () => {
    expect(parseManifest(null).ok).toBe(false);
    expect(parseManifest("").ok).toBe(false);
    expect(parseManifest(42).ok).toBe(false);
  });

  test("rejects missing packs array", () => {
    const res = parseManifest({ manifest_version: 1, generated_at: "2026-04-17T00:00:00Z" });
    expect(res.ok).toBe(false);
  });
});

describe("compareVersion", () => {
  test("returns 0 for equal versions", () => {
    expect(compareVersion("2026.04.17", "2026.04.17")).toBe(0);
  });

  test("returns negative when a precedes b", () => {
    expect(compareVersion("2026.03.01", "2026.04.17")).toBeLessThan(0);
  });

  test("returns positive when a follows b", () => {
    expect(compareVersion("2026.05.01", "2026.04.17")).toBeGreaterThan(0);
  });
});

describe("buildCatalogView", () => {
  const catalog: LanguageMeta[] = [
    { code: "en", native_name: "English", english_name: "English", rtl: false, bundled: true },
    { code: "zh-CN", native_name: "简体中文", english_name: "Simplified Chinese", rtl: false, bundled: true },
    { code: "fr", native_name: "Français", english_name: "French", rtl: false, bundled: false },
    { code: "ar", native_name: "العربية", english_name: "Arabic", rtl: true, bundled: false },
  ];
  const manifest: RemoteManifest = {
    manifest_version: 1,
    generated_at: "2026-04-17T00:00:00Z",
    packs: [
      {
        code: "fr",
        native_name: "Français",
        english_name: "French",
        rtl: false,
        version: "2026.04.17",
        completeness: 0.92,
        size_bytes: 38500,
        sha256: "a".repeat(64),
        url: "https://example.com/fr.tar.gz",
      },
      {
        code: "ar",
        native_name: "العربية",
        english_name: "Arabic",
        rtl: true,
        version: "2026.03.01",
        completeness: 0.78,
        size_bytes: 42000,
        sha256: "b".repeat(64),
        url: "https://example.com/ar.tar.gz",
      },
    ],
  };

  test("splits built-in, downloaded, and available correctly", () => {
    const view = buildCatalogView({
      catalog,
      installed: [{ code: "fr", version: "2026.04.17" }],
      manifest,
    });
    expect(view.builtIn.map((r) => r.entry.code)).toEqual(["en", "zh-CN"]);
    expect(view.downloaded.map((r) => r.entry.code)).toEqual(["fr"]);
    expect(view.available.map((r) => r.status === "available" ? r.manifestEntry.code : "")).toEqual(["ar"]);
  });

  test("flags update-available when manifest version beats installed", () => {
    const view = buildCatalogView({
      catalog,
      installed: [{ code: "fr", version: "2026.03.01" }],
      manifest,
    });
    const fr = view.downloaded.find((r) => r.entry.code === "fr");
    expect(fr?.status).toBe("downloaded");
    if (fr?.status !== "downloaded") return;
    expect(fr.updateAvailableVersion).toBe("2026.04.17");
  });

  test("handles missing manifest gracefully", () => {
    const view = buildCatalogView({
      catalog,
      installed: [{ code: "fr", version: "2026.04.17" }],
      manifest: null,
    });
    expect(view.available).toHaveLength(0);
    expect(view.downloaded).toHaveLength(1);
    const fr = view.downloaded[0];
    if (fr.status !== "downloaded") throw new Error("bad state");
    expect(fr.updateAvailableVersion).toBeUndefined();
  });
});
