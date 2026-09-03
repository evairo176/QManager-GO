"use client";

import { useTranslation } from "react-i18next";
import { Forward } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { useSmsForwarding } from "@/hooks/use-sms-forwarding";
import SmsForwardingCard from "./sms-forwarding-card";
import DeliveryHealthCard from "./delivery-health-card";

// The hook is lifted to the center so both cards read one source of truth and
// share a single fetch/poll loop: the left card controls the relay, the right
// card reports on it (live state, preview, test, delivery failures).
const ForwardingCenterComponent = () => {
  const { t } = useTranslation("cellular");
  const fwd = useSmsForwarding();

  return (
    <div className="@container/main mx-auto flex flex-col gap-6">
      <PageHeader
      icon={Forward}
      title={t("sms.forwarding.page.title")}
      description={t("sms.forwarding.page.description")}
    />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:items-stretch">
        <SmsForwardingCard fwd={fwd} />
        <DeliveryHealthCard fwd={fwd} />
      </div>
    </div>
  );
};

export default ForwardingCenterComponent;
