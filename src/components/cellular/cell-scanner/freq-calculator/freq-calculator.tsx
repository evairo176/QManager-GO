"use client";

import { useTranslation } from "react-i18next";
import FrequencyCalculator from "./calculator";

const FrequencyCalculatorComponent = () => {
  const { t } = useTranslation("cellular");

  return (
    <div className="@container/main mx-auto p-2">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">
          {t("cell_scanner.frequency_calculator.page.title")}
        </h1>
        <p className="text-muted-foreground">
          {t("cell_scanner.frequency_calculator.page.description")}
        </p>
      </div>
      <FrequencyCalculator />
    </div>
  );
};

export default FrequencyCalculatorComponent;
