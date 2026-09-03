"use client";

import { Activity } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import AdaptivePollingCard from "@/components/system-settings/adaptive-polling/adaptive-polling-card";

const AdaptivePollingSettings = () => {
  return (
    <div className="@container/main mx-auto flex flex-col gap-6">
      <PageHeader
        icon={Activity}
        title="Adaptive Polling"
        description="Controls how often the modem is queried for status data based on whether the UI is active."
      />
      <div className="grid grid-cols-1 @3xl/main:grid-cols-2 grid-flow-row gap-4">
        <AdaptivePollingCard />
      </div>
    </div>
  );
};

export default AdaptivePollingSettings;
