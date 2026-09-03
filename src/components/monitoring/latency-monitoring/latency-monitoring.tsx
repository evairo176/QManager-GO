"use client";

import { useTranslation } from "react-i18next";
import { Gauge } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import LatencyMonitoringCard, {
  useLatencyMonitoring,
} from "./latency-monitoring-card";
import PingEntriesCard from "./ping-entries-card";

const LatencyMonitoringComponent = () => {
  const { t } = useTranslation("monitoring");
  const { viewMode, setViewMode, chartData, total, tableData } =
    useLatencyMonitoring();

  return (
    <div className="@container/main mx-auto flex flex-col gap-6">
      <PageHeader
      icon={Gauge}
      title={t("latency.page_title")}
      description={t("latency.page_description")}
    />
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
