"use client";

import React from "react";

import { useTranslation } from "react-i18next";
import ProfileInputComponent from "./profile-input";
import ProfileViewComponent from "./profile-view";
import { useSimProfiles } from "@/hooks/use-sim-profiles";
import { useCurrentSettings } from "@/hooks/use-current-settings";

// -----------------------------------------------------------------------------
// Custom SIM Profiles — coordinator
// -----------------------------------------------------------------------------
// Owns the shared data layer so the two cards stay in sync: the left card
// (add/edit) and the right card (saved list) both read one `useSimProfiles`
// instance, so creating/updating a profile on the left immediately refreshes
// the list on the right. `useCurrentSettings` is fetched once on mount — its
// live ICCID drives the SIM-mismatch badge in the list and prefills the form's
// "Load from SIM" action. `editingId` is the Edit hand-off: a row's Edit menu
// flips the left card into edit mode for that profile.
const CustomProfileComponent = () => {
  const { t } = useTranslation("cellular");

  const sim = useSimProfiles();
  const currentSettings = useCurrentSettings(true);
  const [editingId, setEditingId] = React.useState<string | null>(null);

  return (
    <div className="@container/main mx-auto p-2">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">
          {t("custom_profiles.page.title")}
        </h1>
        <p className="text-muted-foreground">
          {t("custom_profiles.page.description")}
        </p>
      </div>
      <div className="grid grid-cols-1 @3xl/main:grid-cols-2 grid-flow-row gap-4">
        <ProfileInputComponent
          sim={sim}
          currentSettings={currentSettings}
          editingId={editingId}
          onDoneEditing={() => setEditingId(null)}
        />
        <ProfileViewComponent
          sim={sim}
          currentIccid={currentSettings.settings?.iccid ?? null}
          onEdit={setEditingId}
        />
      </div>
    </div>
  );
};

export default CustomProfileComponent;
