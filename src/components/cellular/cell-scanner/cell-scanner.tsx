"use client";

import { useTranslation } from "react-i18next";
import { Scan } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import FullScannerComponent from "./scanner";

const CellScannerComponent = () => {
  const { t } = useTranslation("cellular");

  return (
    <div className="@container/main mx-auto p-4 md:p-6">
      <PageHeader
      icon={Scan}
      title={t("cell_scanner.page.title")}
      description={t("cell_scanner.page.description")}
    />
      <FullScannerComponent />
    </div>
  );
};

export default CellScannerComponent;
