"use client";

import { useTranslation } from "react-i18next";
import { Settings2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import CellularSettingsCard from "./cellular-settings-card";
import CellularAMBRCard from "./cellular-ambr";
import { useCellularSettings } from "@/hooks/use-cellular-settings";

const CellularSettingsComponent = () => {
  const { t } = useTranslation("cellular");
  const { settings, ambr, isLoading, isSaving, error, saveSettings, refresh } =
    useCellularSettings();

  return (
    <div className="@container/main mx-auto flex flex-col gap-6">
      <PageHeader
      icon={Settings2}
      title={t("core_settings.basic.page.title")}
      description={t("core_settings.basic.page.description")}
    />
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
