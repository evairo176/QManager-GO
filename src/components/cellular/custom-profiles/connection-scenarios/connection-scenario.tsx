"use client";

import React from "react";
import { useTranslation } from "react-i18next";
import { GitBranch } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import ConnectionScenariosCard from "./connection-scenario-card";

const ConnectionScenariosComponent = () => {
  const { t } = useTranslation("cellular");

  return (
    <div className="@container/main mx-auto flex flex-col gap-6">
      <PageHeader
      icon={GitBranch}
      title={t("scenarios.page.title")}
      description={t("scenarios.page.description")}
    />
      <ConnectionScenariosCard />
    </div>
  );
};

export default ConnectionScenariosComponent;
