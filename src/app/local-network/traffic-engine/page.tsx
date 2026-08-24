import { Suspense } from "react";
import TrafficEngine from "@/components/local-network/traffic-engine/traffic-engine";

const TrafficEnginePage = () => {
  return (
    <Suspense fallback={null}>
      <TrafficEngine />
    </Suspense>
  );
};

export default TrafficEnginePage;
