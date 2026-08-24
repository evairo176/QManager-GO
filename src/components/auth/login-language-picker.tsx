"use client";

import * as React from "react";
import { useTranslation } from "react-i18next";
import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AVAILABLE_LANGUAGES } from "@/lib/i18n/available-languages";
import { fetchLanguagePackList } from "@/lib/i18n/language-pack-client";
import { DEFAULT_MANIFEST_URL } from "@/lib/i18n/language-pack-manifest";
import { cn } from "@/lib/utils";
import type { LanguageCode } from "@/types/i18n";

// =============================================================================
// LoginLanguagePicker — Icon-only Ghost button + radio menu for pre-auth pages.
// =============================================================================
// A slimmed-down sibling of components/i18n/language-switcher.tsx that fits
// the login chrome: no inline label, no border, opens a small radio list of
// bundled + installed language packs. Selection persists via i18next's normal
// changeLanguage flow — no auth required because the i18n preference is
// client-side.
//
// Positioning is the caller's job (the login page wrapper applies
// `fixed top-4 right-4`). Keeping this component layout-agnostic means it can
// be reused later in /setup/ or any other pre-auth shell without changes.
// =============================================================================

interface LoginLanguagePickerProps {
  className?: string;
  // Defaults preserve the original ghost / icon-sm floating-button treatment so
  // existing callers (legacy /setup/ chrome, anywhere else this gets dropped in
  // unstyled) keep their look. The login Card overrides to outline / icon-touch
  // so the trigger matches the ModeToggle sitting next to it in CardAction.
  variant?: "ghost" | "outline";
  size?: "icon-sm" | "icon-touch";
}

export function LoginLanguagePicker({
  className,
  variant = "ghost",
  size = "icon-sm",
}: LoginLanguagePickerProps) {
  const { t, i18n } = useTranslation("common");
  const [installedCodes, setInstalledCodes] = React.useState<LanguageCode[]>([]);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetchLanguagePackList(DEFAULT_MANIFEST_URL);
        if (!mounted) return;
        setInstalledCodes(res.installed.map((i) => i.code));
      } catch {
        // Best-effort: if the list CGI fails (older firmware, network blip),
        // we still render the bundled languages.
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const visibleLanguages = React.useMemo(
    () =>
      AVAILABLE_LANGUAGES.filter(
        (l) => l.bundled || installedCodes.includes(l.code),
      ),
    [installedCodes],
  );

  const formatLabel = (lang: typeof AVAILABLE_LANGUAGES[number]) =>
    lang.native_name === lang.english_name
      ? lang.native_name
      : `${lang.native_name} (${lang.english_name})`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant}
          size={size}
          aria-label={t("language.switch_aria")}
          // text-foreground (not muted) for outdoor-readable contrast against
          // a tablet glass in direct sunlight, per PRODUCT.md accessibility
          // floor. Glyph size adapts to the button size: size-5 (20px) inside
          // the 44px icon-touch button gives outdoor-readable shape recognition
          // and matches the Sun/Moon glyph in ModeToggle (h-[1.2rem]);
          // size-4 (16px) inside the 32px icon-sm button keeps the icon-to-
          // button ratio in the ~0.5 sweet spot on the indoor login surface.
          className={cn(variant === "ghost" && "text-foreground", className)}
        >
          <Languages className={size === "icon-sm" ? "size-4" : "size-5"} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="min-w-[10rem]">
        <DropdownMenuRadioGroup
          value={i18n.language}
          onValueChange={(value) => i18n.changeLanguage(value)}
        >
          {visibleLanguages.map((lang) => (
            <DropdownMenuRadioItem key={lang.code} value={lang.code}>
              {formatLabel(lang)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
