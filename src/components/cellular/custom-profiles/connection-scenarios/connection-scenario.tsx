"use client";

import React from "react";
import { useTranslation } from "react-i18next";
import ConnectionScenariosCard from "./connection-scenario-card";

const ConnectionScenariosComponent = () => {
  const { t } = useTranslation("cellular");

  return (
    <div className="@container/main mx-auto p-2">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">{t("scenarios.page.title")}</h1>
        <p className="text-muted-foreground">
          {t("scenarios.page.description")}
        </p>
      </div>
      <ConnectionScenariosCard />
    </div>
  );
};

export default ConnectionScenariosComponent;
