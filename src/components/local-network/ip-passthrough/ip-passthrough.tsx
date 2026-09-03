"use client";

import { useTranslation } from "react-i18next";
import { ArrowLeftRight } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import IPPassthroughCard from "./ip-passthrough-card";

const IPPassthroughComponent = () => {
  const { t } = useTranslation("local-network");
  return (
    <div className="@container/main mx-auto flex flex-col gap-6">
      <PageHeader
      icon={ArrowLeftRight}
      title={t("ippt.page_title")}
      description={t("ippt.page_description")}
    />
      <div className="grid grid-cols-1 @3xl/main:grid-cols-2 grid-flow-row gap-4">
        <IPPassthroughCard />
      </div>
    </div>
  );
};

export default IPPassthroughComponent;
