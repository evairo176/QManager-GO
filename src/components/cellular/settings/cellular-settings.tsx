"use client";

import { useTranslation } from "react-i18next";
import CellularSettingsCard from "./cellular-settings-card";
import CellularAMBRCard from "./cellular-ambr";
import { useCellularSettings } from "@/hooks/use-cellular-settings";

const CellularSettingsComponent = () => {
  const { t } = useTranslation("cellular");
  const { settings, ambr, isLoading, isSaving, error, saveSettings, refresh } =
    useCellularSettings();

  return (
    <div className="@container/main mx-auto p-2">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">{t("core_settings.basic.page.title")}</h1>
        <p className="text-muted-foreground">
          {t("core_settings.basic.page.description")}
        </p>
      </div>
      {error && !isLoading && (
        <div role="alert" className="mb-4 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {t("core_settings.basic.page.error_load")}
          <button type="button" className="ml-2 underline" onClick={refresh}>
            {t("common:actions.retry")}
          </button>
        </div>
      )}
      <div className="grid grid-cols-1 @3xl/main:grid-cols-2 grid-flow-row gap-4">
        <CellularSettingsCard
          settings={settings}
          isLoading={isLoading}
          isSaving={isSaving}
          onSave={saveSettings}
        />
        <CellularAMBRCard ambr={ambr} isLoading={isLoading} />
      </div>
    </div>
  );
};

export default CellularSettingsComponent;
