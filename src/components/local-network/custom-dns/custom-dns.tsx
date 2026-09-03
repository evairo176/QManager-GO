"use client";

import { useTranslation } from "react-i18next";
import { Globe2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import CustomDNSCard from "./custom-dns-card";

const CustomDNSComponent = () => {
  const { t } = useTranslation("local-network");
  return (
    <div className="@container/main mx-auto flex flex-col gap-6">
      <PageHeader
      icon={Globe2}
      title={t("dns.page_title")}
      description={t("dns.page_description")}
    />
      <div className="grid grid-cols-1 @3xl/main:grid-cols-2 grid-flow-row gap-4">
        <CustomDNSCard />
      </div>
    </div>
  );
};

export default CustomDNSComponent;
