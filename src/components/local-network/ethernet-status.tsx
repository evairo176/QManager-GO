"use client";

import { useTranslation } from "react-i18next";
import { EthernetPort } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import EthernetStatusCard from "./ethernet-card";
import LanConfigCard from "./lan-config-card";

const EthernetStatusComponent = () => {
  const { t } = useTranslation("local-network");
  return (
    <div className="@container/main mx-auto flex flex-col gap-6">
      <PageHeader
        icon={EthernetPort}
        title={t("ethernet.page_title")}
        description={t("ethernet.page_description")}
      />
      <div className="grid grid-cols-1 @3xl/main:grid-cols-2 grid-flow-row gap-4">
        <EthernetStatusCard />
        <LanConfigCard />
      </div>
    </div>
  );
};

export default EthernetStatusComponent;
