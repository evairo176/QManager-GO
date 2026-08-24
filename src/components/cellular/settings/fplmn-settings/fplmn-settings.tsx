"use client";

import { useTranslation } from "react-i18next";
import FPLMNCard from "./fplmn-card";

const FPLMNSettingsComponent = () => {
  const { t } = useTranslation("cellular");

  return (
    <div className="@container/main mx-auto p-2">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">
          {t("core_settings.fplmn.page.title")}
        </h1>
        <p className="text-muted-foreground">
          {t("core_settings.fplmn.page.description")}
        </p>
      </div>
      <div className="grid grid-cols-1 @3xl/main:grid-cols-2 grid-flow-row gap-4">
        <FPLMNCard />
      </div>
    </div>
  );
};

export default FPLMNSettingsComponent;
