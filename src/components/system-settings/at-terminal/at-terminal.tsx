"use client";

import { useTranslation } from "react-i18next";
import ATTerminalCard from "@/components/system-settings/at-terminal/at-terminal-card";

const ATTerminal = () => {
  const { t } = useTranslation("system-settings");
  return (
    <div className="@container/main mx-auto p-2">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">{t("at_terminal.page_title")}</h1>
        <p className="text-muted-foreground">{t("at_terminal.page_description")}</p>
      </div>
      <ATTerminalCard />
    </div>
  );
};

export default ATTerminal;
