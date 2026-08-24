import i18n, { type i18n as I18nInstance } from "i18next";
import { initReactI18next } from "react-i18next";
import HttpBackend from "i18next-http-backend";
import { resources, ALL_NAMESPACES, DEFAULT_NAMESPACE } from "./resources";
import {
  AVAILABLE_LANGUAGES,
  BUNDLED_CODES,
  DEFAULT_LANGUAGE,
} from "./available-languages";
import type { LanguageCode } from "@/types/i18n";

export const LANG_STORAGE_KEY = "qmanager_lang";

function resolveDetectedLanguage(): LanguageCode {
  if (typeof localStorage !== "undefined") {
    const stored = localStorage.getItem(LANG_STORAGE_KEY);
    // Accept any code listed in the catalog — bundled or not. The HTTP backend
    // loads non-bundled packs from /locales/<code>/<ns>.json on demand. If the
    // pack isn't installed, i18next falls back to EN gracefully.
    if (stored && AVAILABLE_LANGUAGES.some((l) => l.code === stored)) {
      return stored;
    }
  }

  const nav = typeof navigator !== "undefined" ? navigator.language : "";
  if (nav) {
    if (BUNDLED_CODES.includes(nav)) return nav;
    const base = nav.split("-")[0];
    if (BUNDLED_CODES.includes(base)) return base;
  }

  return DEFAULT_LANGUAGE;
}

export async function createI18n(): Promise<I18nInstance> {
  const initial = resolveDetectedLanguage();

  // Only wire the HTTP backend in actual browser contexts where a device HTTP
  // server is reachable. In SSR / test environments (no window) the backend
  // would attempt network requests that hang; bundled languages are fully
  // covered by `resources` so nothing is lost.
  const isBrowser = typeof window !== "undefined";

  const instance = i18n.createInstance();
  const builder = instance.use(initReactI18next);
  if (isBrowser) builder.use(HttpBackend);

  await builder.init({
    resources,
    lng: initial,
    fallbackLng: DEFAULT_LANGUAGE,
    defaultNS: DEFAULT_NAMESPACE,
    ns: [...ALL_NAMESPACES],
    interpolation: { escapeValue: false },
    returnNull: false,
    react: { useSuspense: false },
    ...(isBrowser
      ? {
          backend: {
            // Installed packs live at /www/locales/<code>/<ns>.json; in the
            // static export this URL resolves to the file on the device's HTTP
            // server.
            loadPath: "/locales/{{lng}}/{{ns}}.json",
            // Avoid crashes when a non-bundled pack is requested but not installed.
            allowMultiLoading: false,
          },
          partialBundledLanguages: true,
        }
      : {}),
  });

  return instance;
}

export function persistLanguage(code: LanguageCode): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(LANG_STORAGE_KEY, code);
}
