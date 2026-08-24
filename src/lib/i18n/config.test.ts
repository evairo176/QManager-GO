import { describe, it, expect, beforeEach } from "bun:test";
import { createI18n, LANG_STORAGE_KEY } from "./config";

function mockLocalStorage(initial: Record<string, string> = {}): void {
  const store = new Map<string, string>(Object.entries(initial));
  // @ts-expect-error test shim
  globalThis.localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() {
      return store.size;
    },
  };
}

function mockNavigator(language: string): void {
  // @ts-expect-error test shim
  globalThis.navigator = { language };
}

describe("config.createI18n", () => {
  beforeEach(() => {
    mockLocalStorage();
    mockNavigator("en-US");
  });

  it("falls back to English when no storage and no navigator match", async () => {
    mockLocalStorage();
    mockNavigator("xx-ZZ");
    const i18n = await createI18n();
    expect(i18n.language).toBe("en");
    expect(i18n.t("actions.save", { ns: "common" })).toBe("Save");
  });

  it("respects localStorage value", async () => {
    mockLocalStorage({ [LANG_STORAGE_KEY]: "zh-CN" });
    const i18n = await createI18n();
    expect(i18n.language).toBe("zh-CN");
    expect(i18n.t("actions.save", { ns: "common" })).toBe("保存");
  });

  it("normalizes navigator.language to bundled base code", async () => {
    mockLocalStorage();
    mockNavigator("en-GB");
    const i18n = await createI18n();
    expect(i18n.language).toBe("en");
  });

  it("matches zh-CN exactly", async () => {
    mockLocalStorage();
    mockNavigator("zh-CN");
    const i18n = await createI18n();
    expect(i18n.language).toBe("zh-CN");
    expect(i18n.t("actions.save", { ns: "common" })).toBe("保存");
  });

  it("exposes fallback to English for missing keys", async () => {
    mockLocalStorage({ [LANG_STORAGE_KEY]: "zh-CN" });
    const i18n = await createI18n();
    const out = i18n.t("nonsense.key", { ns: "common" });
    expect(typeof out).toBe("string");
  });
});
