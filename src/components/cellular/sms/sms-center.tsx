"use client";

import { useTranslation } from "react-i18next";
import { MessageCircle } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import SmsInboxCard from "./sms-inbox-card";
import { useSms } from "@/hooks/use-sms";

const SmsCenterComponent = () => {
  const { t } = useTranslation("cellular");
  const {
    data,
    isLoading,
    isSaving,
    error,
    sendSms,
    deleteSms,
    deleteAllSms,
    refresh,
  } = useSms();

  return (
    <div className="@container/main mx-auto flex flex-col gap-6">
      <PageHeader
      icon={MessageCircle}
      title={t("sms.page.title")}
      description={t("sms.page.description")}
    />
      <div className="grid grid-cols-1 grid-flow-row gap-4">
        <SmsInboxCard
          data={data}
          isLoading={isLoading}
          isSaving={isSaving}
          error={error}
          onSend={sendSms}
          onDelete={deleteSms}
          onDeleteAll={deleteAllSms}
          onRefresh={() => refresh()}
        />
      </div>
    </div>
  );
};

export default SmsCenterComponent;
