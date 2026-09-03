"use client";

import { useTranslation } from "react-i18next";
import { TerminalSquare } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import ATTerminalCard from "@/components/system-settings/at-terminal/at-terminal-card";

const ATTerminal = () => {
  const { t } = useTranslation("system-settings");
  return (
    <div className="@container/main mx-auto flex flex-col gap-6">
      <PageHeader
        icon={TerminalSquare}
        title={t("at_terminal.page_title")}
        description={t("at_terminal.page_description")}
      />
      <ATTerminalCard />
    </div>
  );
};

export default ATTerminal;
