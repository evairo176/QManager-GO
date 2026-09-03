"use client";

import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Router } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { useAboutDevice } from "@/hooks/use-about-device";
import DeviceInformationCard from "./device-information-card";
import AboutQManagerCard from "./about-qmanager-card";

const AboutDeviceComponent = () => {
  const { t } = useTranslation("system-settings");
  const { data, isLoading, error, refresh } = useAboutDevice();

  const handleRetry = () => {
    refresh();
    toast.info(t("about_device.device_info.error.retrying"));
  };

  return (
    <div className="@container/main mx-auto flex flex-col gap-6">
      <PageHeader
        icon={Router}
        title={t("about_device.page.title")}
        description={t("about_device.page.subtitle")}
      />
      <div className="grid grid-cols-1 @3xl/main:grid-cols-2 grid-flow-row gap-4">
        <DeviceInformationCard
          data={data}
          isLoading={isLoading}
          error={error}
          onRetry={handleRetry}
        />
        <AboutQManagerCard data={data} isLoading={isLoading} />
      </div>
    </div>
  );
};

export default AboutDeviceComponent;
