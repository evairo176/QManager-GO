"use client";

import * as React from "react";
import { I18nextProvider } from "react-i18next";
import type { i18n as I18nInstance } from "i18next";
import { createI18n, LANG_STORAGE_KEY } from "@/lib/i18n/config";
import { isRtl } from "@/lib/i18n/available-languages";

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [instance, setInstance] = React.useState<I18nInstance | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    createI18n().then((i18n) => {
      if (cancelled) return;
      applyHtmlAttributes(i18n.language);
      i18n.on("languageChanged", (lng: string) => {
        applyHtmlAttributes(lng);
        try {
          localStorage.setItem(LANG_STORAGE_KEY, lng);
        } catch {
          // localStorage may be unavailable in private mode — ignore
        }
      });
      setInstance(i18n);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!instance) {
    // First-paint gap while i18next initializes from bundled resources.
    // Bundled init is synchronous-ish; this renders for a single tick.
    return null;
  }

  return <I18nextProvider i18n={instance}>{children}</I18nextProvider>;
}

function applyHtmlAttributes(lng: string): void {
  if (typeof document === "undefined") return;
  document.documentElement.lang = lng;
  document.documentElement.dir = isRtl(lng) ? "rtl" : "ltr";
}
