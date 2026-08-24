"use client";

import React from "react";
import { Settings, LockIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { bandsToDisplay } from "@/types/connection-scenario";
import type { Scenario } from "./scenario-item";

interface ActiveConfigCardProps {
  scenario: Scenario | undefined;
  isActive: boolean;
  isActivating?: boolean;
  onEdit?: () => void;
  onActivate?: () => void;
  /** True when the active profile's schedule controls scenario selection. */
  scheduleLocked?: boolean;
  /** "HH:MM" of the next scheduled transition (shown while locked). */
  nextChangeAt?: string | null;
}

export const ActiveConfigCard = ({
  scenario,
  isActive,
  isActivating,
  onEdit,
  onActivate,
  scheduleLocked = false,
  nextChangeAt = null,
}: ActiveConfigCardProps) => {
  const { t } = useTranslation("cellular");

  if (!scenario) return null;
  const Icon = scenario.icon;
  const isCustom = !scenario.isDefault;

  return (
    <Card className="@container/card">
      <CardContent className="px-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "p-2.5 rounded-xl bg-linear-to-br text-white",
                scenario.gradient,
              )}
            >
              <Icon className="size-6" />
            </div>
            <div className="grid">
              <h4 className="font-semibold">
                {t("scenarios.active_config_card.configuration", { name: scenario.name })}
              </h4>
              {scheduleLocked ? (
                <Badge
                  variant="outline"
                  className="bg-info/15 text-info hover:bg-info/20 border-info/30"
                >
                  <LockIcon className="size-3" />
                  {t("scenarios.schedule_lock.badge")}
                </Badge>
              ) : isActivating ? (
                <Badge
                  variant="outline"
                  className="bg-info/15 text-info hover:bg-info/20 border-info/30"
                >
                  <Spinner className="h-2 w-2" />
                  {t("state.applying", { ns: "common" })}
                </Badge>
              ) : isActive ? (
                <Badge
                  variant="outline"
                  className="bg-success/15 text-success hover:bg-success/20 border-success/30"
                >
                  <div className="w-2 h-2 rounded-full bg-success" />
                  {t("scenarios.active_config_card.status.active")}
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="bg-muted text-muted-foreground hover:bg-muted border-border"
                >
                  <div className="w-2 h-2 rounded-full bg-muted-foreground/50" />
                  {t("scenarios.active_config_card.status.not_active")}
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {isCustom && (
              <Button
                variant="ghost"
                size="icon"
                aria-label={t("scenarios.active_config_card.edit_aria")}
                onClick={onEdit}
              >
                <Settings className="size-4" />
              </Button>
            )}
            {!isActive && !isActivating && !scheduleLocked && (
              <Button size="sm" onClick={onActivate}>
                {t("scenarios.active_config_card.activate")}
              </Button>
            )}
          </div>
        </div>

        {/* Schedule-lock hint + next change line */}
        {scheduleLocked && (
          <div className="mb-4 grid gap-1 rounded-lg border border-info/30 bg-info/10 p-3">
            <p className="text-sm text-info">
              {t("scenarios.schedule_lock.hint")}
            </p>
            {nextChangeAt && (
              <p className="text-xs text-info/80 tabular-nums">
                {t("scenarios.schedule_lock.next_change", { time: nextChangeAt })}
              </p>
            )}
          </div>
        )}

        {/* Config Details */}
        <div className="grid gap-2">
          <Separator />
          <ConfigRow
            label={t("scenarios.active_config_card.config_labels.network_mode")}
            value={scenario.config.mode}
          />
          <Separator />
          <ConfigRow
            label={t("scenarios.active_config_card.config_labels.optimization")}
            value={scenario.config.optimization}
          />
          <Separator />
          <ConfigRow
            label={t("scenarios.active_config_card.config_labels.lte_bands")}
            value={bandsToDisplay(scenario.config.lte_bands, t)}
          />
          <Separator />
          <ConfigRow
            label={t("scenarios.active_config_card.config_labels.nrsa_bands")}
            value={bandsToDisplay(scenario.config.sa_nr_bands, t)}
          />
          <Separator />
          <ConfigRow
            label={t("scenarios.active_config_card.config_labels.nrsa_nsa_bands")}
            value={bandsToDisplay(scenario.config.nsa_nr_bands, t)}
          />
          <Separator />
        </div>
      </CardContent>
    </Card>
  );
};

function ConfigRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-sm font-semibold text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  );
}
