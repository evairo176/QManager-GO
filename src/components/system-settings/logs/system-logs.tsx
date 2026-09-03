"use client";

import { useTranslation } from "react-i18next";
import { ScrollText } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import SystemLogsCard from "./system-logs-card";

const SystemLogsComponent = () => {
  const { t } = useTranslation("system-settings");

  return (
    <div className="@container/main mx-auto flex flex-col gap-6">
      <PageHeader
        icon={ScrollText}
        title={t("system_logs.page_title")}
        description={t("system_logs.page_description")}
      />
      <div className="grid grid-cols-1 grid-flow-row gap-4">
        <SystemLogsCard />
      </div>
    </div>
  );
};

export default SystemLogsComponent;
