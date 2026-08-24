"use client";

import { useTranslation } from "react-i18next";
import NetworkPriorityCard from "./network-priority-card";

const NetworkPrioritySettings = () => {
  const { t } = useTranslation("cellular");

  return (
    <div className="@container/main mx-auto p-2">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">
          {t("core_settings.network_priority.page.title")}
        </h1>
        <p className="text-muted-foreground">
          {t("core_settings.network_priority.page.description")}
        </p>
      </div>
      <div className="grid grid-cols-1 @3xl/main:grid-cols-2 grid-flow-row gap-4">
        <NetworkPriorityCard />
      </div>
    </div>
  );
};

export default NetworkPrioritySettings;
