"use client";

import { useTranslation } from "react-i18next";
import { ListOrdered } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import NetworkPriorityCard from "./network-priority-card";

const NetworkPrioritySettings = () => {
  const { t } = useTranslation("cellular");

  return (
    <div className="@container/main mx-auto flex flex-col gap-6">
      <PageHeader
      icon={ListOrdered}
      title={t("core_settings.network_priority.page.title")}
      description={t("core_settings.network_priority.page.description")}
    />
      <div className="grid grid-cols-1 @3xl/main:grid-cols-2 grid-flow-row gap-4">
        <NetworkPriorityCard />
      </div>
    </div>
  );
};

export default NetworkPrioritySettings;
