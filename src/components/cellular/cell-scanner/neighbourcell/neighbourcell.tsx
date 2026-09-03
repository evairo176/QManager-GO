"use client";

import { useTranslation } from "react-i18next";
import { Radar } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import NeighbourCellScanner from "./neighbour-scanner";

const NeighbourcellComponent = () => {
  const { t } = useTranslation("cellular");

  return (
    <div className="@container/main mx-auto p-4 md:p-6">
      <PageHeader
      icon={Radar}
      title={t("cell_scanner.neighbour.page.title")}
      description={t("cell_scanner.neighbour.page.description")}
    />
      <NeighbourCellScanner />
    </div>
  );
};

export default NeighbourcellComponent;
