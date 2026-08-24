"use client";

import { InfoIcon } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";
import { Alert, AlertDescription } from "@/components/ui/alert";

// =============================================================================
// ProfileOverrideAlert — Reusable "managed by Custom SIM Profile" banner
// =============================================================================
// Used on every screen that is gated by an active Custom SIM Profile (APN,
// TTL/HL, Scenarios, Band Locking). The matching gate logic — which decides
// *when* to show this — lives in each screen and is keyed off the active
// profile's settings (apn.name, ttl/hl, scenario_id).
// =============================================================================

interface ProfileOverrideAlertProps {
  /** Display name of the active profile (e.g., "Home LTE"). */
  profileName: string;
  /** What is being controlled by the profile, already translated by the
   *  caller — e.g., t("core_settings.apn.controls_label") → "APN
   *  configuration". The alert composes it into "<controls> is managed by
   *  the <profileName> Custom SIM Profile." */
  controls: string;
}

export function ProfileOverrideAlert({
  profileName,
  controls,
}: ProfileOverrideAlertProps) {
  const { t } = useTranslation("common");

  return (
    <Alert className="mb-4">
      <InfoIcon className="size-4" />
      <AlertDescription>
        <p>
          <Trans
            i18nKey="profile_override.banner"
            ns="common"
            values={{ controls, profile_name: profileName }}
            components={{ strong: <span className="font-semibold" /> }}
          >
            {t("profile_override.banner", {
              controls,
              profile_name: profileName,
            })}
          </Trans>
        </p>
      </AlertDescription>
    </Alert>
  );
}

export default ProfileOverrideAlert;
