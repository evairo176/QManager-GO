"use client";

import { motion } from "motion/react";
import { containerVariants, itemVariants } from "@/lib/motion";
import { toast } from "sonner";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TbInfoCircleFilled } from "react-icons/tb";
import { AlertTriangleIcon } from "lucide-react";

import { useBandwidthSettings } from "@/hooks/use-bandwidth-settings";
import { useTranslation } from "react-i18next";

const BandwidthMonitorSettings = () => {
  const { t } = useTranslation("system-settings");
  const bandwidth = useBandwidthSettings();

  return (
    <div className="@container/main mx-auto p-2">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">{t("bandwidth_monitor.page_title")}</h1>
      </div>
      <div className="grid grid-cols-1 @3xl/main:grid-cols-2 grid-flow-row gap-4">
        <Card className="@container/card">
          <CardHeader>
            <div className="flex items-center gap-1.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex"
                    aria-label={t("bandwidth_monitor.info_aria")}
                  >
                    <TbInfoCircleFilled className="size-5 text-info" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{t("bandwidth_monitor.info_tooltip")}</p>
                </TooltipContent>
              </Tooltip>
              <CardTitle>{t("bandwidth_monitor.card_title")}</CardTitle>
            </div>
            <CardDescription>
              {t("bandwidth_monitor.card_description")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {bandwidth.isLoading ? (
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-5 w-44" />
                  <Skeleton className="h-6 w-28" />
                </div>
                <Separator />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : (
              <motion.div
                className="grid gap-2"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
              >
                {/* Dependency warnings */}
                {bandwidth.dependencies && !bandwidth.dependencies.websocat_installed && (
                  <motion.div variants={itemVariants}>
                    <Alert>
                      <AlertTriangleIcon className="size-4" />
                      <AlertDescription>
                        {t("bandwidth_monitor.dependency_warning")}{" "}
                        <code className="text-xs font-mono">opkg install websocat</code>
                      </AlertDescription>
                    </Alert>
                  </motion.div>
                )}

                {/* Enable toggle */}
                <motion.div variants={itemVariants} className="flex items-center justify-between">
                  <p className="font-semibold text-muted-foreground text-sm">
                    {t("bandwidth_monitor.enable_label")}
                  </p>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="bandwidth-monitor"
                      checked={bandwidth.settings?.enabled ?? false}
                      disabled={bandwidth.isSaving}
                      onCheckedChange={async (checked) => {
                        const success = await bandwidth.saveSettings({
                          action: "save_settings",
                          enabled: checked,
                        });
                        if (success) {
                          toast.success(
                            checked
                              ? t("bandwidth_monitor.toast_enabled")
                              : t("bandwidth_monitor.toast_disabled"),
                          );
                        } else {
                          toast.error(t("bandwidth_monitor.toast_update_failed"));
                        }
                      }}
                    />
                    <Label htmlFor="bandwidth-monitor">
                      {bandwidth.settings?.enabled ? t("state.enabled", { ns: "common" }) : t("state.disabled", { ns: "common" })}
                    </Label>
                  </div>
                </motion.div>
                <Separator />

                {/* Refresh rate (when enabled) */}
                {bandwidth.settings?.enabled && (
                  <>
                    <motion.div variants={itemVariants} className="flex items-center justify-between mt-4">
                      <Label className="font-semibold text-muted-foreground text-sm">
                        {t("bandwidth_monitor.refresh_rate_label")}
                      </Label>
                      <Select
                        value={String(bandwidth.settings.refresh_rate_ms)}
                        onValueChange={async (value) => {
                          const success = await bandwidth.saveSettings({
                            action: "save_settings",
                            refresh_rate_ms: Number(value),
                          });
                          if (success) {
                            toast.success(t("bandwidth_monitor.toast_refresh_updated"));
                          } else {
                            toast.error(t("bandwidth_monitor.toast_refresh_failed"));
                          }
                        }}
                        disabled={bandwidth.isSaving}
                      >
                        <SelectTrigger className="w-32 h-8" aria-label={t("bandwidth_monitor.refresh_rate_aria")}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="500" className="rounded-lg">{t("bandwidth_monitor.refresh_500ms")}</SelectItem>
                          <SelectItem value="1000" className="rounded-lg">{t("bandwidth_monitor.refresh_1s")}</SelectItem>
                          <SelectItem value="2000" className="rounded-lg">{t("bandwidth_monitor.refresh_2s")}</SelectItem>
                          <SelectItem value="3000" className="rounded-lg">{t("bandwidth_monitor.refresh_3s")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </motion.div>
                    <Separator />

                    {/* Status indicators */}
                    <motion.div variants={itemVariants} className="flex items-center justify-between mt-4">
                      <p className="font-semibold text-muted-foreground text-sm">
                        {t("bandwidth_monitor.status_label")}
                      </p>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={
                            bandwidth.status?.websocat_running
                              ? "text-emerald-600 border-emerald-500/30"
                              : "text-muted-foreground"
                          }
                        >
                          {bandwidth.status?.websocat_running ? t("bandwidth_monitor.status_websocket_running") : t("bandwidth_monitor.status_websocket_stopped")}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={
                            bandwidth.status?.monitor_running
                              ? "text-emerald-600 border-emerald-500/30"
                              : "text-muted-foreground"
                          }
                        >
                          {bandwidth.status?.monitor_running ? t("bandwidth_monitor.status_monitor_running") : t("bandwidth_monitor.status_monitor_stopped")}
                        </Badge>
                      </div>
                    </motion.div>
                    <Separator />
                  </>
                )}
              </motion.div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default BandwidthMonitorSettings;
