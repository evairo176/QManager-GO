"use client";

import { useEffect, useState } from "react";
import { isLoggedIn } from "@/hooks/use-auth";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { Spinner } from "@/components/ui/spinner";

// =============================================================================
// /setup — First-time onboarding wizard route
// =============================================================================
// Guards:
//   - Already logged in + onboarding completed → redirect /dashboard/
//   - setup_required is false (password already set, not logged in) → /login/
// Renders OnboardingWizard when setup_required is confirmed.
// =============================================================================

const CHECK_ENDPOINT = "/cgi-bin/quecmanager/auth/check.sh";

export default function SetupPage() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Guard 1: already logged in
    if (isLoggedIn()) {
      window.location.href = "/dashboard/";
      return;
    }

    // Guard 2: confirm setup_required via backend
    fetch(CHECK_ENDPOINT)
      .then((r) => r.json())
      .then((data) => {
        if (!data.setup_required) {
          // Password already set — go to normal login
          window.location.href = "/login/";
          return;
        }
        setReady(true);
      })
      .catch(() => {
        // On error, fall back to login page
        window.location.href = "/login/";
      });
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <Spinner className="size-6 text-muted-foreground" />
      </div>
    );
  }

  return <OnboardingWizard />;
}
