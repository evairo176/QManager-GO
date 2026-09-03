"use client";

import { useTranslation } from "react-i18next";
import { Calculator } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import FrequencyCalculator from "./calculator";

const FrequencyCalculatorComponent = () => {
  const { t } = useTranslation("cellular");

  return (
    <div className="@container/main mx-auto flex flex-col gap-6">
      <PageHeader
      icon={Calculator}
      title={t("cell_scanner.frequency_calculator.page.title")}
      description={t("cell_scanner.frequency_calculator.page.description")}
    />
      <FrequencyCalculator />
    </div>
  );
};

export default FrequencyCalculatorComponent;
