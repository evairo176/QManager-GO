import { beforeAll, describe, expect, test } from "bun:test";
import i18next from "i18next";
import { resolveErrorMessage } from "@/lib/i18n/resolve-error";

const enErrors = {
  unknown: "Unknown error",
  unknown_with_detail: "Modem reported: {{detail}}",
  modem_busy: "Modem is busy — try again",
  install_in_progress: "Another install is in progress",
};

beforeAll(async () => {
  await i18next.init({
    lng: "en",
    ns: ["errors"],
    defaultNS: "errors",
    fallbackLng: "en",
    interpolation: { escapeValue: false },
    resources: {
      en: { errors: enErrors },
    },
  });
});

describe("resolveErrorMessage", () => {
  const t = i18next.getFixedT("en", "errors");

  test("returns translated message for a known code", () => {
    expect(resolveErrorMessage(t, "modem_busy", undefined, "fallback")).toBe(
      "Modem is busy — try again",
    );
  });

  test("returns translated message even when detail is also present", () => {
    expect(
      resolveErrorMessage(t, "install_in_progress", "extra", "fallback"),
    ).toBe("Another install is in progress");
  });

  test("returns unknown_with_detail for an unknown code with detail", () => {
    expect(
      resolveErrorMessage(t, "not_in_catalog", "Modem says: E:90", "fallback"),
    ).toBe("Modem reported: Modem says: E:90");
  });

  test("returns fallback for unknown code with no detail", () => {
    expect(resolveErrorMessage(t, "not_in_catalog", undefined, "fallback")).toBe(
      "fallback",
    );
  });

  test("returns detail for missing code with detail", () => {
    expect(resolveErrorMessage(t, undefined, "raw detail", "fallback")).toBe(
      "raw detail",
    );
  });

  test("returns fallback for missing code and missing detail", () => {
    expect(resolveErrorMessage(t, undefined, undefined, "fallback")).toBe(
      "fallback",
    );
  });

  test("empty-string code is treated as missing", () => {
    expect(resolveErrorMessage(t, "", "raw", "fallback")).toBe("raw");
  });
});
