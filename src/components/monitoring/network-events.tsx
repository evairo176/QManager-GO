"use client";

import { PieChart } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import NetworkEventsCard from "./network-events-card";

const NetworkEventsComponent = () => {
  return (
    <div className="@container/main mx-auto flex flex-col gap-6">
      <PageHeader
        icon={PieChart}
        title="Network Events"
        description="Band changes, connection drops, signal transitions, and other cellular events logged by the poller."
      />
      <div className="grid grid-cols-1 @3xl/main:grid-cols-2 grid-flow-row gap-4">
        <NetworkEventsCard />
      </div>
    </div>
  );
};

export default NetworkEventsComponent;
