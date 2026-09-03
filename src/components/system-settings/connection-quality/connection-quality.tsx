"use client";

import { Gauge } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import ConnectivitySensitivityCard from "@/components/system-settings/connection-quality/connectivity-sensitivity-card";
import QualityThresholdsCard from "@/components/system-settings/connection-quality/quality-thresholds-card";

const ConnectionQualitySettings = () => {
  return (
    <div className="@container/main mx-auto flex flex-col gap-6">
      <PageHeader
        icon={Gauge}
        title="Connection Quality"
        description="Probe sensitivity, and when latency or packet loss is flagged as an event."
      />
      <div className="grid grid-cols-1 @3xl/main:grid-cols-2 grid-flow-row gap-4">
        <ConnectivitySensitivityCard />
        <QualityThresholdsCard />
      </div>
    </div>
  );
};

export default ConnectionQualitySettings;
