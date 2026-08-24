"use client";

import { useTranslation } from "react-i18next";
import SystemLogsCard from "./system-logs-card";

const SystemLogsComponent = () => {
  const { t } = useTranslation("system-settings");

  return (
    <div className="@container/main mx-auto p-2">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">
          {t("system_logs.page_title")}
        </h1>
        <p className="text-muted-foreground">
          {t("system_logs.page_description")}
        </p>
      </div>
      <div className="grid grid-cols-1 grid-flow-row gap-4">
        <SystemLogsCard />
      </div>
    </div>
  );
};

export default SystemLogsComponent;
