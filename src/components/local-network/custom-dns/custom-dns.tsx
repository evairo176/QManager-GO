"use client";

import { useTranslation } from "react-i18next";
import CustomDNSCard from "./custom-dns-card";

const CustomDNSComponent = () => {
  const { t } = useTranslation("local-network");
  return (
    <div className="@container/main mx-auto p-2">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">{t("dns.page_title")}</h1>
        <p className="text-muted-foreground">{t("dns.page_description")}</p>
      </div>
      <div className="grid grid-cols-1 @3xl/main:grid-cols-2 grid-flow-row gap-4">
        <CustomDNSCard />
      </div>
    </div>
  );
};

export default CustomDNSComponent;
