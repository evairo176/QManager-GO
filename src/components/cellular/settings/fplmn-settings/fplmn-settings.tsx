"use client";

import { useTranslation } from "react-i18next";
import { ListChecks } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import FPLMNCard from "./fplmn-card";

const FPLMNSettingsComponent = () => {
  const { t } = useTranslation("cellular");

  return (
    <div className="@container/main mx-auto flex flex-col gap-6">
      <PageHeader
      icon={ListChecks}
      title={t("core_settings.fplmn.page.title")}
      description={t("core_settings.fplmn.page.description")}
    />
      <div className="grid grid-cols-1 @3xl/main:grid-cols-2 grid-flow-row gap-4">
        <FPLMNCard />
      </div>
    </div>
  );
};

export default FPLMNSettingsComponent;
