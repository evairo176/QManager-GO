"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useTranslation, Trans } from "react-i18next";
import { motion } from "motion/react";
import { containerVariants, itemVariants } from "@/lib/motion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Field, FieldLabel } from "@/components/ui/field";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DownloadIcon } from "lucide-react";
import { toast } from "sonner";

import type { UpdateInfo } from "@/hooks/use-software-update";

// ─── Props ──────────────────────────────────────────────────────────────────

interface UpdatePreferencesCardProps {
  updateInfo: UpdateInfo | null;
  isLoading: boolean;
  isUpdating: boolean;
  isDownloading: boolean;
  downloadUpdate: (version: string) => Promise<void>;
  togglePrerelease: (enabled: boolean) => Promise<void>;
  saveAutoUpdate: (enabled: boolean, time: string) => Promise<void>;
}

// ─── Component ──────────────────────────────────────────────────────────────

const AUTO_UPDATE_DEBOUNCE = 800;

export function UpdatePreferencesCard({
  updateInfo,
  isLoading,
  isUpdating,
  isDownloading,
  downloadUpdate,
  togglePrerelease,
  saveAutoUpdate,
}: UpdatePreferencesCardProps) {
  const { t } = useTranslation("system-settings");
  const [showInstallDialog, setShowInstallDialog] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<string>("");
  const [prereleaseToggling, setPrereleaseToggling] = useState(false);
  const [autoUpdateToggling, setAutoUpdateToggling] = useState(false);
  const [autoUpdateTime, setAutoUpdateTime] = useState("03:00");
  const autoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync local time from server data
  useEffect(() => {
    if (updateInfo?.auto_update_time) {
      setAutoUpdateTime(updateInfo.auto_update_time);
    }
  }, [updateInfo?.auto_update_time]);

  const handleTogglePrerelease = useCallback(
    async (checked: boolean) => {
      setPrereleaseToggling(true);
      try {
        await togglePrerelease(checked);
        toast.success(
          checked
            ? t("software_update.toast_prerelease_enabled")
            : t("software_update.toast_prerelease_disabled"),
        );
      } catch {
        toast.error(t("software_update.toast_preference_failed"));
      } finally {
        setPrereleaseToggling(false);
      }
    },
    [togglePrerelease, t],
  );

  const handleVersionInstall = useCallback(async () => {
    setShowInstallDialog(false);
    if (!selectedVersion) return;
    try {
      await downloadUpdate(selectedVersion);
    } catch {
      toast.error(t("software_update.toast_download_failed"));
    }
  }, [selectedVersion, downloadUpdate, t]);

  const handleAutoUpdateToggle = useCallback(
    async (checked: boolean) => {
      setAutoUpdateToggling(true);
      try {
        await saveAutoUpdate(checked, autoUpdateTime);
        toast.success(
          checked
            ? t("software_update.toast_auto_update_enabled")
            : t("software_update.toast_auto_update_disabled"),
        );
      } catch {
        toast.error(t("software_update.toast_preference_failed"));
      } finally {
        setAutoUpdateToggling(false);
      }
    },
    [saveAutoUpdate, autoUpdateTime, t],
  );

  const handleAutoUpdateTimeChange = useCallback(
    (newTime: string) => {
      setAutoUpdateTime(newTime);
      if (!updateInfo?.auto_update_enabled) return;

      // Debounced save
      if (autoTimerRef.current) clearTimeout(autoTimerRef.current);
      autoTimerRef.current = setTimeout(async () => {
        try {
          await saveAutoUpdate(true, newTime);
          toast.success(t("software_update.toast_schedule_saved"));
        } catch {
          toast.error(t("software_update.toast_schedule_failed"));
        }
      }, AUTO_UPDATE_DEBOUNCE);
    },
    [saveAutoUpdate, updateInfo?.auto_update_enabled, t],
  );

  // Clean up debounce timer
  useEffect(() => {
    return () => {
      if (autoTimerRef.current) clearTimeout(autoTimerRef.current);
    };
  }, []);

  // ── Loading skeleton ──────────────────────────────────────────────────
  if (isLoading) {
    return (
      <Card className="@container/card">
        <CardHeader>
          <CardTitle>{t("software_update.prefs_card_title")}</CardTitle>
          <CardDescription>
            {t("software_update.prefs_card_description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2">
            <Separator />
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-6 w-12" />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-6 w-12" />
            </div>
            <Separator />
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-20 w-full rounded-lg" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const isReinstall = !!selectedVersion && selectedVersion === updateInfo?.current_version;
  const currentVersion = updateInfo?.current_version ?? "";

  return (
    <>
      <Card className="@container/card">
        <CardHeader>
          <CardTitle>{t("software_update.prefs_card_title")}</CardTitle>
          <CardDescription>
            {t("software_update.prefs_card_description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <motion.div
            className="grid gap-2"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {/* ── Pre-release toggle ──────────────────────────────── */}
            <Separator />
            <motion.div variants={itemVariants}>
              <Field orientation="horizontal">
                <FieldLabel htmlFor="include-prerelease">
                  {t("software_update.prerelease_label")}
                </FieldLabel>
                <Switch
                  id="include-prerelease"
                  checked={updateInfo?.include_prerelease ?? false}
                  onCheckedChange={handleTogglePrerelease}
                  disabled={prereleaseToggling || isUpdating}
                />
              </Field>
            </motion.div>

            {/* ── Automatic updates ─────────────────────────────── */}
            <Separator />
            <motion.div variants={itemVariants}>
              <Field orientation="horizontal">
                <FieldLabel htmlFor="auto-update">
                  {t("software_update.auto_update_label")}
                </FieldLabel>
                <Switch
                  id="auto-update"
                  checked={updateInfo?.auto_update_enabled ?? false}
                  onCheckedChange={handleAutoUpdateToggle}
                  disabled={autoUpdateToggling || isUpdating}
                />
              </Field>
            </motion.div>

            {/* Time Configuration for Automatic Updates */}
            {updateInfo?.auto_update_enabled && (
              <>
                <Separator />
                <motion.div variants={itemVariants} className="flex flex-col gap-2">
                  <p className="font-semibold text-sm">
                    {t("software_update.update_time_title")}
                  </p>

                  <div className="flex flex-col @sm/card:flex-row @sm/card:items-center gap-2 @sm/card:justify-between rounded-lg border bg-muted/50 p-3">
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <label htmlFor="auto-update-time" className="text-xs font-medium text-muted-foreground">
                        {t("software_update.update_at_label")}
                      </label>
                      <p className="text-xs text-muted-foreground">
                        {t("software_update.update_at_description")}
                      </p>
                    </div>
                    <Input
                      id="auto-update-time"
                      type="time"
                      value={autoUpdateTime}
                      onChange={(e) =>
                        handleAutoUpdateTimeChange(e.target.value)
                      }
                      disabled={isUpdating || autoUpdateToggling}
                      aria-label={t("software_update.update_time_aria")}
                      className="w-28 shrink-0"
                    />
                  </div>
                </motion.div>
              </>
            )}

            {/* ── Version Management ──────────────────────────────── */}
            <Separator />
            <motion.div variants={itemVariants} className="flex flex-col gap-2">
              <p className="font-semibold text-sm">{t("software_update.version_mgmt_title")}</p>
              <div className="flex flex-col gap-2 rounded-lg border bg-muted/50 p-3">
                <span className="text-xs text-muted-foreground">
                  {t("software_update.version_select_hint")}
                </span>
                <div className="flex items-center gap-2">
                  <Select
                    value={selectedVersion}
                    onValueChange={setSelectedVersion}
                    disabled={isUpdating || isDownloading}
                  >
                    <SelectTrigger className="flex-1" aria-label={t("software_update.version_select_aria")}>
                      <SelectValue placeholder={t("software_update.version_placeholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {(updateInfo?.available_versions ?? []).map((v) => (
                        <SelectItem
                          key={v.tag}
                          value={v.tag}
                          disabled={!v.has_assets}
                        >
                          <div className="flex items-center justify-between gap-3 w-full">
                            <span>{v.tag}</span>
                            {v.is_current ? (
                              <span className="text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                                {t("software_update.version_current_tag")}
                              </span>
                            ) : !v.has_assets ? (
                              <span className="text-[10px] text-muted-foreground">
                                {t("software_update.version_no_binary_tag")}
                              </span>
                            ) : v.asset_size ? (
                              <span className="text-[10px] text-muted-foreground">
                                {v.asset_size}
                              </span>
                            ) : null}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowInstallDialog(true)}
                    disabled={!selectedVersion || isUpdating || isDownloading}
                    className="shrink-0"
                  >
                    <DownloadIcon className="size-4" />
                    {t("software_update.install_button")}
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </CardContent>
      </Card>

      {/* ── Version install confirmation dialog ────────────────────── */}
      <AlertDialog
        open={showInstallDialog}
        onOpenChange={setShowInstallDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isReinstall
                ? t("software_update.install_dialog_reinstall_title")
                : t("software_update.install_dialog_install_title", { version: selectedVersion })}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p>
                  {isReinstall ? (
                    <Trans
                      i18nKey="software_update.install_dialog_reinstall_description"
                      ns="system-settings"
                      values={{ version: selectedVersion }}
                      components={{ strong: <strong /> }}
                    />
                  ) : (
                    <Trans
                      i18nKey="software_update.install_dialog_install_description"
                      ns="system-settings"
                      values={{ version: selectedVersion, current: currentVersion }}
                      components={{ strong: <strong /> }}
                    />
                  )}
                </p>
                <p>{t("software_update.install_dialog_do_not_power_off")}</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("actions.cancel", { ns: "common" })}</AlertDialogCancel>
            <AlertDialogAction onClick={handleVersionInstall}>
              <DownloadIcon className="size-4" />
              {isReinstall
                ? t("software_update.install_dialog_reinstall_now")
                : t("software_update.install_dialog_install_now")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
