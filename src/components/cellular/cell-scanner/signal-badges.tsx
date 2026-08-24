"use client";

import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";

export function SignalBadge({ strength }: { strength: number }) {
  const { t } = useTranslation("cellular");

  if (strength >= -85)
    return (
      <Badge className="bg-success/15 text-success hover:bg-success/20 border-success/30">
        {t("cell_scanner.signal_badge.good")}
      </Badge>
    );
  if (strength >= -100)
    return (
      <Badge className="bg-warning/15 text-warning hover:bg-warning/20 border-warning/30">
        {t("cell_scanner.signal_badge.fair")}
      </Badge>
    );
  return (
    <Badge className="bg-destructive/15 text-destructive hover:bg-destructive/20 border-destructive/30">
      {t("cell_scanner.signal_badge.bad")}
    </Badge>
  );
}

export function NetworkTypeBadge({ type }: { type: string }) {
  return <Badge variant="default">{type}</Badge>;
}
