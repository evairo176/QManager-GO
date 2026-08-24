import { describe, it, expect } from "bun:test";
import {
  AVAILABLE_LANGUAGES,
  BUNDLED_CODES,
  DEFAULT_LANGUAGE,
  getLanguage,
  isRtl,
} from "./available-languages";

describe("available-languages", () => {
  it("bundles EN and zh-CN", () => {
    expect(BUNDLED_CODES).toEqual(["en", "zh-CN"]);
  });

  it("has 5 catalog entries (2 bundled + 3 downloadable placeholders, all LTR)", () => {
    expect(AVAILABLE_LANGUAGES).toHaveLength(5);
    const bundled = AVAILABLE_LANGUAGES.filter((l) => l.bundled);
    const downloadable = AVAILABLE_LANGUAGES.filter((l) => !l.bundled);
    expect(bundled).toHaveLength(2);
    expect(downloadable).toHaveLength(3);
  });

  it("contains no RTL languages in v1 — RTL support parked", () => {
    const rtlLanguages = AVAILABLE_LANGUAGES.filter((l) => l.rtl);
    expect(rtlLanguages).toHaveLength(0);
  });

  it("default language is English", () => {
    expect(DEFAULT_LANGUAGE).toBe("en");
  });

  it("every language carries a non-empty native name", () => {
    for (const lang of AVAILABLE_LANGUAGES) {
      expect(lang.native_name.length).toBeGreaterThan(0);
    }
  });

  it("no duplicate codes", () => {
    const codes = AVAILABLE_LANGUAGES.map((l) => l.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("getLanguage returns entry by code", () => {
    expect(getLanguage("zh-CN")?.english_name).toBe("Simplified Chinese");
    expect(getLanguage("xx")).toBeUndefined();
  });

  it("isRtl returns false for every supported language (RTL parked in v1)", () => {
    expect(isRtl("en")).toBe(false);
    expect(isRtl("zh-CN")).toBe(false);
    expect(isRtl("fr")).toBe(false);
    expect(isRtl("de")).toBe(false);
    // ar is no longer in the catalog — getLanguage returns undefined,
    // isRtl falls back to false.
    expect(isRtl("ar")).toBe(false);
  });
});
