"use client";

import { useTranslation } from "react-i18next";
import NeighbourCellScanner from "./neighbour-scanner";

const NeighbourcellComponent = () => {
  const { t } = useTranslation("cellular");

  return (
    <div className="@container/main mx-auto p-4 md:p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">
          {t("cell_scanner.neighbour.page.title")}
        </h1>
        <p className="text-muted-foreground">
          {t("cell_scanner.neighbour.page.description")}
        </p>
      </div>
      <NeighbourCellScanner />
    </div>
  );
};

export default NeighbourcellComponent;
