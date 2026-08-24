"use client";

import { CheckCircle2Icon } from "lucide-react";
import { cn } from "@/lib/utils";

// =============================================================================
// PasswordRequirements — live checklist of password complexity rules
// =============================================================================
// Shown under a password input. Each rule is evaluated against the current
// password and greys out (unmet) or turns success-green (met) in real time.
//
// The rules here MUST stay in sync with server-side validation in:
//   scripts/www/cgi-bin/quecmanager/auth/login.sh
//   scripts/www/cgi-bin/quecmanager/auth/password.sh

interface Rule {
  key: string;
  label: string;
  test: (pw: string) => boolean;
}

const RULES: Rule[] = [
  { key: "length",    label: "At least 5 characters", test: (pw) => pw.length >= 5 },
  { key: "uppercase", label: "Uppercase letter",      test: (pw) => /[A-Z]/.test(pw) },
  { key: "lowercase", label: "Lowercase letter",      test: (pw) => /[a-z]/.test(pw) },
  { key: "number",    label: "Number",                test: (pw) => /[0-9]/.test(pw) },
];

/** Returns true when the password satisfies every rule shown in the checklist. */
export function isPasswordValid(pw: string, enforceStrong: boolean = true): boolean {
  if (!enforceStrong) return pw.length >= 5;
  return RULES.every((r) => r.test(pw));
}

export function PasswordRequirements({
  password,
  enforceStrong = true,
  className,
  id,
}: {
  password: string;
  enforceStrong?: boolean;
  className?: string;
  id?: string;
}) {
  const activeRules = enforceStrong ? RULES : RULES.filter((r) => r.key === "length");

  return (
    <ul
      id={id}
      className={cn("flex flex-col gap-1 text-xs", className)}
      aria-label="Password requirements"
    >
      {activeRules.map((rule) => {
        const met = rule.test(password);
        return (
          <li key={rule.key} className="flex items-center gap-2">
            <CheckCircle2Icon
              aria-hidden
              className={cn(
                "size-3.5 shrink-0 transition-colors duration-200",
                met ? "text-success" : "text-muted-foreground/40"
              )}
            />
            <span
              className={cn(
                "transition-colors duration-200",
                met ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {rule.label}
            </span>
            <span className="sr-only">{met ? " (met)" : " (not met)"}</span>
          </li>
        );
      })}
    </ul>
  );
}
