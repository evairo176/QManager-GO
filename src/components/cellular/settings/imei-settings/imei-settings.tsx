"use client";

import { useTranslation } from "react-i18next";
import { Fingerprint } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import IMEISettingsCard from "./imei-settings-card";
import BackupIMEICard from "./backup-imei-card";
import { useImeiSettings } from "@/hooks/use-imei-settings";
import IMEIToolsCard from "./imei-tools-card";

const IMEISettings = () => {
  const { t } = useTranslation("cellular");
  const {
    currentImei,
    backupEnabled,
    backupImei,
    isLoading,
    isSaving,
    saveImei,
    saveBackup,
    rebootDevice,
  } = useImeiSettings();

  return (
    <div className="@container/main mx-auto flex flex-col gap-6">
      <PageHeader
      icon={Fingerprint}
      title={t("core_settings.imei.page.title")}
      description={t("core_settings.imei.page.description")}
    />
      <div className="grid grid-cols-1 @3xl/main:grid-cols-2 grid-flow-row gap-4">
        <IMEISettingsCard
          currentImei={currentImei}
          isLoading={isLoading}
          isSaving={isSaving}
          onSave={saveImei}
          onReboot={rebootDevice}
        />
        <BackupIMEICard
          backupEnabled={backupEnabled}
          backupImei={backupImei}
          isLoading={isLoading}
          isSaving={isSaving}
          onSave={saveBackup}
        />
        <IMEIToolsCard/>
      </div>
    </div>
  );
};

export default IMEISettings;
