"use client";

import { useTranslation } from "react-i18next";

import { LoginLanguagePicker } from "@/components/auth/login-language-picker";
import { ModeToggle } from "@/components/public/mode-toggle";

// =============================================================================
// LoginChrome — viewport-level chrome for the unauthenticated /login route.
// =============================================================================
// Two surfaces outside the login form: a top bar (lang/theme cluster) and
// a footer (copyright). The brand mark lives inside the form column itself
// (see <LoginComponent />), so the header is left to the utility cluster
// only — no second wordmark competing with the centered headline.
// =============================================================================

export function LoginChromeHeader() {
  return (
    <header className="flex w-full items-center justify-end gap-1.5 px-4 pt-4 sm:px-6 sm:pt-6">
      <LoginLanguagePicker variant="ghost" size="icon-sm" />
      <ModeToggle size="icon-sm" />
    </header>
  );
}

export function LoginChromeFooter() {
  const { t } = useTranslation("common");

  return (
    <footer className="px-4 pb-4 text-center sm:pb-6">
      <p className="text-muted-foreground text-xs">
        {t("overview.copyright", { year: new Date().getFullYear() })}
      </p>
    </footer>
  );
}
