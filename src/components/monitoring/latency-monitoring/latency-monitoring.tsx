"use client";

import { useTranslation } from "react-i18next";
import LatencyMonitoringCard, {
  useLatencyMonitoring,
} from "./latency-monitoring-card";
import PingEntriesCard from "./ping-entries-card";

const LatencyMonitoringComponent = () => {
  const { t } = useTranslation("monitoring");
  const { viewMode, setViewMode, chartData, total, tableData } =
    useLatencyMonitoring();

  return (
    <div className="@container/main mx-auto p-2">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">{t("latency.page_title")}</h1>
        <p className="text-muted-foreground">
          {t("latency.page_description")}
        </p>
      </div>
      <div className="grid grid-cols-1 @3xl/main:grid-cols-2 grid-flow-row gap-4">
        <LatencyMonitoringCard
          viewMode={viewMode}
          setViewMode={setViewMode}
          chartData={chartData}
          total={total}
        />
        <PingEntriesCard
          entries={tableData.entries}
          emptyMessage={tableData.emptyMessage}
          isRealtime={tableData.isRealtime}
        />
      </div>
    </div>
  );
};

export default LatencyMonitoringComponent;
