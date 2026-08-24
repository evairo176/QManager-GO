"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  EyeIcon,
  EyeOffIcon,
  TriangleAlertIcon,
  XCircleIcon,
} from "lucide-react";

import { useLogin } from "@/hooks/use-auth";
import { LoginDeviceName } from "@/components/auth/login-device-name";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { resolveErrorMessage } from "@/lib/i18n/resolve-error";
import { DUR, EASE_OUT_EXPO } from "@/lib/motion";

// =============================================================================
// LoginComponent — centered brand mark, product headline, in-place recovery.
// =============================================================================
// Composition follows the shadcn Field reference: a centered cluster (logo →
// "Welcome to QManager" → device-name line) sits above the password field.
// Below the field, a quiet "Can't sign in?" toggle owns the recovery
// disclosure: the panel expands in place directly beneath the toggle, so the
// answer appears right where the question was asked. The toggle lives inside
// the password Field (not the input's positioning wrapper), so the Field's own
// gap-3 sets a calm, deliberate distance from the input above.
// =============================================================================

export default function LoginComponent() {
  const { t } = useTranslation("common");
  const { status, login } = useLogin();
  const shouldReduceMotion = useReducedMotion();
  const recoveryPanelId = useId();

  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [retryAfter, setRetryAfter] = useState(0);
  const [wasOffline, setWasOffline] = useState(false);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  // First mount per session animates; later visits (post-logout, deferred-
  // reboot return) skip the slide. Read once at mount so re-renders don't
  // re-evaluate sessionStorage.
  const [animateMount] = useState(() => {
    if (typeof window === "undefined") return false;
    const seen = window.sessionStorage.getItem("qm_login_mounted");
    if (!seen) window.sessionStorage.setItem("qm_login_mounted", "1");
    return !seen;
  });

  // Read the offline-arrival flag in a post-mount effect so the first
  // render matches the static-export prerender (no banner), then hydration
  // promotes the banner if applicable. Avoids the hydration-mismatch tax
  // of reading window.location.search during render.
  useEffect(() => {
    if (
      new URLSearchParams(window.location.search).get("reason") === "offline"
    ) {
      setWasOffline(true);
    }
  }, []);

  // Fresh-install devices belong on the dedicated onboarding wizard, not the
  // password gate.
  useEffect(() => {
    if (status === "setup_required") {
      window.location.href = "/setup/";
    }
  }, [status]);

  // Rate-limit countdown timer drives the button label ("Locked (Ns)").
  useEffect(() => {
    if (retryAfter <= 0) return;
    const id = setInterval(() => {
      setRetryAfter((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [retryAfter]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError("");
      setIsSubmitting(true);
      try {
        const result = await login(password);
        if (!result.success) {
          if (result.retry_after) {
            setRetryAfter(result.retry_after);
            // Static "rate_limited" copy: the live countdown lives on the
            // button label, so the error region stays still and assistive
            // tech doesn't re-announce every tick.
            setError(
              resolveErrorMessage(
                t,
                "rate_limited",
                undefined,
                "Too many failed attempts. Please try again later.",
              ),
            );
          } else {
            setError(
              resolveErrorMessage(
                t,
                result.error,
                undefined,
                "Invalid password.",
              ),
            );
          }
        }
      } finally {
        setIsSubmitting(false);
      }
    },
    [password, login, t],
  );

  const isPreparing = status === "loading" || status === "setup_required";

  return (
    <motion.div
      // DESIGN.md's signed motion curve (ease-out-quart, Apple Control Center
      // settle). useReducedMotion zeroes the duration so vestibular-sensitive
      // users see the column mount in place rather than slide. animateMount
      // gates the entrance to the first visit per session.
      initial={
        shouldReduceMotion || !animateMount ? false : { opacity: 0, y: 8 }
      }
      animate={
        shouldReduceMotion || !animateMount ? undefined : { opacity: 1, y: 0 }
      }
      transition={
        shouldReduceMotion || !animateMount
          ? { duration: 0 }
          : { duration: DUR.slow, ease: EASE_OUT_EXPO }
      }
      className="flex flex-col gap-6"
    >
      {isPreparing ? (
        <div
          role="status"
          aria-live="polite"
          className="text-muted-foreground flex flex-col items-center gap-3 py-12 text-sm"
        >
          <Spinner className="size-6" />
          <span>{t("state.loading")}</span>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <FieldGroup>
            {/* Brand + product headline + helper-text affordance, styled per
                the shadcn Field reference: gap-2 cluster, size-8 logo slot,
                text-xl/bold heading, muted helper text below. */}
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="flex size-12 items-center justify-center rounded-md">
                <img
                  src="/qmanager-logo.svg"
                  alt=""
                  aria-hidden="true"
                  className="size-full"
                />
              </div>
              <span className="sr-only">{t("overview.title")}</span>
              <h1 className="text-xl font-bold">{t("login.welcome")}</h1>
              {/* Meta row: which modem this gate guards, paired with the
                  recovery affordance. flex-wrap lets a long hostname stack the
                  name above the link rather than overflow the column. The name
                  line is self-contained (owns its fetch + states) and silently
                  absent on older firmware or unnamed devices, in which case the
                  link simply centers alone. */}
              <div className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1">
                <LoginDeviceName />
              </div>
            </div>

            {/* Banners share one shape: rounded-lg + tinted border + tinted
                bg + leading icon + tinted text. The role is carried by
                color + icon (warning ⇆ destructive) per DESIGN.md §5. */}
            {wasOffline && (
              <div className="border-warning/30 bg-warning/10 text-warning flex items-start gap-2 rounded-lg border px-4 py-3 text-sm">
                <TriangleAlertIcon
                  aria-hidden
                  className="size-4 shrink-0 translate-y-px"
                />
                <span>{t("login.session_expired")}</span>
              </div>
            )}

            <Field>
              <FieldLabel htmlFor="password">
                {t("login.password_label")}
              </FieldLabel>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isSubmitting}
                  // The password input is the page's primary action and the
                  // only interactive element above the fold for a focused
                  // user. autoFocus saves the click on every arrival.
                  autoFocus
                  className="pr-10"
                />

                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="text-muted-foreground hover:text-foreground absolute right-1 top-1/2 -translate-y-1/2"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                  aria-label={
                    showPassword
                      ? t("login.hide_password")
                      : t("login.show_password")
                  }
                >
                  {showPassword ? (
                    <EyeOffIcon className="size-4" />
                  ) : (
                    <EyeIcon className="size-4" />
                  )}
                </Button>
              </div>

              {/* Recovery affordance + in-place disclosure, kept inside the
                  password Field so the Field's own gap-3 (12px) sets the
                  spacing to the input above. (The toggle was previously
                  trapped in the input's positioning wrapper, where a
                  single-child `grid gap-8` could never apply a gap.) The
                  answer expands directly beneath the question; the inner gap
                  only spans the toggle↔panel while the panel is mounted, so a
                  closed disclosure collapses to just the toggle. */}
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => setRecoveryOpen((v) => !v)}
                  aria-expanded={recoveryOpen}
                  aria-controls={recoveryPanelId}
                  className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 inline-flex w-fit cursor-pointer items-center self-start rounded-sm px-1 py-0.5 text-sm underline-offset-4 transition-colors outline-none hover:underline focus-visible:ring-2"
                >
                  {t("login.recovery.toggle")}
                </button>

                <AnimatePresence initial={false}>
                  {recoveryOpen && (
                    <motion.div
                      key="recovery"
                      id={recoveryPanelId}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={
                        shouldReduceMotion
                          ? { duration: 0 }
                          : { duration: DUR.slow, ease: EASE_OUT_EXPO }
                      }
                      style={{ overflow: "hidden" }}
                    >
                      <div className="border-border bg-muted/40 text-muted-foreground space-y-2 rounded-lg border px-4 py-3 text-left text-sm leading-relaxed">
                        <p>{t("login.recovery.intro")}</p>
                        <ul className="list-disc space-y-1.5 pl-5">
                          <li>
                            {/* Trans + <code> mapping keeps the command semantic
                              and translatable without fragmenting the sentence
                              into before/after tokens that break under different
                              word orders. */}
                            <Trans
                              i18nKey="login.recovery.option_reset"
                              ns="common"
                              components={{
                                code: (
                                  <code className="bg-background text-foreground border-border rounded border px-1 py-0.5 font-mono text-[0.85em]" />
                                ),
                              }}
                            />
                          </li>
                          <li>{t("login.recovery.option_backup")}</li>
                        </ul>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </Field>

            {error && (
              // key={error} forces React to remount the alert when the
              // message text changes (rate-limit copy ⇆ wrong-password
              // copy). Mutating a persistent role="alert" is unreliable;
              // some screen readers only re-announce on element insertion.
              <div
                key={error}
                role="alert"
                className="border-destructive/30 bg-destructive/10 text-destructive flex items-start gap-2 rounded-lg border px-4 py-3 text-sm"
              >
                <XCircleIcon
                  aria-hidden
                  className="size-4 shrink-0 translate-y-px"
                />
                <span>{error}</span>
              </div>
            )}

            <Field>
              <Button
                type="submit"
                className="w-full"
                disabled={isSubmitting || retryAfter > 0}
              >
                {isSubmitting ? (
                  <>
                    <Spinner />
                    {t("login.signing_in")}
                  </>
                ) : retryAfter > 0 ? (
                  t("login.locked", { seconds: retryAfter })
                ) : (
                  t("login.submit")
                )}
              </Button>
            </Field>
          </FieldGroup>
        </form>
      )}
    </motion.div>
  );
}
