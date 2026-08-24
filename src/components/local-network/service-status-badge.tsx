"use client";

import { Badge } from "@/components/ui/badge";
import { CheckCircle2Icon, MinusCircleIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

export function ServiceStatusBadge({
  status,
  installed = true,
}: {
  status: string;
  installed?: boolean;
}) {
  const { t } = useTranslation("local-network");
  if (status === "running") {
    return (
      <Badge
        variant="outline"
        className="border-success/30 bg-success/15 text-success hover:bg-success/20"
      >
        <CheckCircle2Icon className="size-3" />
        {t("shared.status_active")}
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="border-muted-foreground/30 bg-muted/50 text-muted-foreground"
    >
      <MinusCircleIcon className="size-3" />
      {installed ? t("shared.status_inactive") : t("shared.status_not_installed")}
    </Badge>
  );
}
