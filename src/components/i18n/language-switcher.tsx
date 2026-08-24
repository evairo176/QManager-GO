"use client";

import * as React from "react";
import { useTranslation } from "react-i18next";
import { Languages } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AVAILABLE_LANGUAGES } from "@/lib/i18n/available-languages";
import { fetchLanguagePackList } from "@/lib/i18n/language-pack-client";
import { DEFAULT_MANIFEST_URL } from "@/lib/i18n/language-pack-manifest";
import type { LanguageCode } from "@/types/i18n";

export function LanguageSwitcher({ className }: { className?: string }) {
  const { t, i18n } = useTranslation("common");
  const [installedCodes, setInstalledCodes] = React.useState<LanguageCode[]>([]);

  React.useEffect(() => {
    let mounted = true;
    // Best-effort — if the list CGI fails we still show bundled languages.
    (async () => {
      try {
        const res = await fetchLanguagePackList(DEFAULT_MANIFEST_URL);
        if (!mounted) return;
        setInstalledCodes(res.installed.map((i) => i.code));
      } catch {
        // ignore
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const visibleLanguages = React.useMemo(() => {
    return AVAILABLE_LANGUAGES.filter(
      (l) => l.bundled || installedCodes.includes(l.code),
    );
  }, [installedCodes]);

  const formatLabel = React.useCallback((lang: typeof AVAILABLE_LANGUAGES[number]) => {
    return lang.native_name === lang.english_name
      ? lang.native_name
      : `${lang.native_name} (${lang.english_name})`;
  }, []);

  const activeLang =
    visibleLanguages.find((l) => l.code === i18n.language) ??
    AVAILABLE_LANGUAGES.find((l) => l.code === i18n.language) ??
    AVAILABLE_LANGUAGES.find((l) => l.code === i18n.language.split("-")[0]);

  const handleChange = (value: string) => {
    i18n.changeLanguage(value);
  };

  // Wrapped in a Radix DropdownMenu — stop only the keys/clicks the parent menu
  // would intercept. Escape must bubble so users can dismiss the menu; Tab must
  // bubble so focus order works.
  const stopMenuKeys = (e: React.KeyboardEvent) => {
    const intercepted = ["ArrowDown", "ArrowUp", "Enter", " "];
    if (intercepted.includes(e.key)) {
      e.stopPropagation();
    }
  };

  return (
    <div
      className={className}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={stopMenuKeys}
    >
      <Select value={i18n.language} onValueChange={handleChange}>
        <SelectTrigger
          aria-label={t("language.switch_aria")}
          className="h-8 w-full justify-start gap-2 border-0 bg-transparent px-2 shadow-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Languages className="size-4" />
          <SelectValue>
            {activeLang ? formatLabel(activeLang) : i18n.language}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {visibleLanguages.map((lang) => (
            <SelectItem key={lang.code} value={lang.code}>
              {formatLabel(lang)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
