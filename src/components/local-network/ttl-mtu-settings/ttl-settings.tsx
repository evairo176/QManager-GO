"use client";

import { useTranslation } from "react-i18next";
import { Timer } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import TTLSettingsCard from "./ttl-settings-card";
import MTUSettingsCard from "./mtu-settings-card";

const TTLandMTUSettingsComponent = () => {
  const { t } = useTranslation("local-network");

  return (
    <div className="@container/main mx-auto flex flex-col gap-6">
      <PageHeader
      icon={Timer}
      title={t("ttl_mtu.page_title")}
      description={t("ttl_mtu.page_description")}
    />
      <div className="grid grid-cols-1 @3xl/main:grid-cols-2 grid-flow-row gap-4">
        <TTLSettingsCard />
        <MTUSettingsCard />
      </div>
    </div>
  );
};

export default TTLandMTUSettingsComponent;
