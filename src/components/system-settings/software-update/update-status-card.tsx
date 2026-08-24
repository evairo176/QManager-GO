"use client";

import { useState, useCallback } from "react";
import { useTranslation, Trans } from "react-i18next";
import type { TFunction } from "i18next";
import { motion } from "motion/react";
import Markdown from "react-markdown";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  CheckCircle2Icon,
  DownloadIcon,
  FileTextIcon,
  LoaderCircle,
  RefreshCwIcon,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

import type { UpdateInfo, UpdateStatus, DownloadState } from "@/hooks/use-software-update";
import { containerVariants, itemVariants } from "@/lib/motion";
import { StatusBadge } from "./software-update";

// ─── Helpers ────────────────────────────────────────────────────────────────

const PROSE_CLASSES = [
  "prose prose-sm dark:prose-invert max-w-none",
  "prose-headings:text-foreground prose-headings:font-semibold prose-headings:mt-4 prose-headings:mb-2 first:prose-headings:mt-0",
  "prose-p:text-muted-foreground prose-p:leading-relaxed prose-p:my-1.5",
  "prose-li:text-muted-foreground prose-li:my-0.5",
  "prose-ul:my-1.5 prose-ol:my-1.5",
  "prose-strong:text-foreground",
  "prose-code:text-foreground prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:before:content-none prose-code:after:content-none",
  "prose-a:text-primary prose-a:no-underline hover:prose-a:underline",
  "prose-hr:border-border prose-hr:my-3",
].join(" ");

function formatRelativeTime(iso: string, t: TFunction): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t("time.just_now", { ns: "common" });
  if (mins < 60) return t("time.minutes_ago", { ns: "common", count: mins });
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return t("time.hours_ago", { ns: "common", count: hrs });
  return t("time.days_ago", { ns: "common", count: Math.floor(hrs / 24) });
}

// ─── Props ──────────────────────────────────────────────────────────────────

interface UpdateStatusCardProps {
  updateInfo: UpdateInfo | null;
  updateStatus: UpdateStatus;
  downloadState: DownloadState | null;
  isLoading: boolean;
  isChecking: boolean;
  isUpdating: boolean;
  isDownloading: boolean;
  error: string | null;
  lastChecked: string | null;
  checkForUpdates: () => Promise<void>;
  downloadUpdate: (version?: string) => Promise<void>;
  installStaged: () => Promise<void>;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function UpdateStatusCard({
  updateInfo,
  updateStatus,
  downloadState,
  isLoading,
  isChecking,
  isUpdating,
  isDownloading,
  error,
  lastChecked,
  checkForUpdates,
  downloadUpdate,
  installStaged,
}: UpdateStatusCardProps) {
  const { t } = useTranslation("system-settings");
  const [showInstallDialog, setShowInstallDialog] = useState(false);
  const [showChangelog, setShowChangelog] = useState(false);

  const handleDownload = useCallback(async () => {
    try {
      await downloadUpdate();
    } catch {
      toast.error(t("software_update.toast_download_failed"));
    }
  }, [downloadUpdate, t]);

  const handleInstall = useCallback(async () => {
    setShowInstallDialog(false);
    try {
      await installStaged();
    } catch {
      toast.error(t("software_update.toast_install_failed"));
    }
  }, [installStaged, t]);

  // ── Loading skeleton ──────────────────────────────────────────────────
  if (isLoading) {
    return (
      <Card className="@container/card">
        <CardHeader>
          <CardTitle>{t("software_update.status_card_title")}</CardTitle>
          <CardDescription>
            {t("software_update.status_card_description")}
          </CardDescription>
          <CardAction>
            <Skeleton className="h-5 w-24 rounded-full" />
          </CardAction>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2">
            <Separator />
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-5 w-28" />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-9 w-36" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const updateAvailable = updateInfo?.update_available ?? false;
  const displayError = updateInfo?.check_error || error;

  return (
    <>
      <Card className="@container/card">
        <CardHeader>
          <CardTitle>{t("software_update.status_card_title")}</CardTitle>
          <CardDescription>
            {t("software_update.status_card_description")}
          </CardDescription>
          {updateInfo && (
            <CardAction>
              <StatusBadge
                updateAvailable={updateAvailable}
                isUpdating={false}
                isDownloading={isDownloading}
                updateStatus={updateStatus}
              />
            </CardAction>
          )}
        </CardHeader>
        <CardContent>
          {/* Non-fatal error (rate limited, network issue, etc.) */}
          {displayError && (
            <Alert variant="destructive" className="mb-4">
              <AlertTriangleIcon className="size-4" />
              <AlertTitle>{t("software_update.error_check_failed_title")}</AlertTitle>
              <AlertDescription>
                <p>{displayError}</p>
              </AlertDescription>
            </Alert>
          )}

          <motion.div
            className="grid gap-2 min-w-0"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {/* ── Version display ─────────────────────────────────── */}
            <Separator />
            {updateAvailable && updateInfo?.latest_version ? (
              <motion.div variants={itemVariants} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1">
                <div className="flex items-center gap-3">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {t("software_update.installed_label")}
                    </span>
                    <span className="text-sm font-medium">
                      {updateInfo.current_version}
                    </span>
                  </div>
                  <ArrowRightIcon className="size-4 text-muted-foreground" />
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {t("software_update.available_label")}
                    </span>
                    <span className="text-sm font-medium text-primary">
                      {updateInfo.latest_version}
                    </span>
                  </div>
                </div>
                {updateInfo.download_size && (
                  <Badge variant="secondary" className="ml-auto">
                    {updateInfo.download_size}
                  </Badge>
                )}
              </motion.div>
            ) : (
              <motion.div variants={itemVariants} className="flex items-center justify-between">
                <p className="font-semibold text-muted-foreground text-sm">
                  {t("software_update.installed_version")}
                </p>
                <span className="text-sm font-medium">
                  {updateInfo?.current_version ?? t("time.unknown", { ns: "common" })}
                </span>
              </motion.div>
            )}

            {/* ── Inline release notes (clickable → dialog) ────────── */}
            {(() => {
              const displayChangelog = updateAvailable
                ? updateInfo?.changelog
                : updateInfo?.current_changelog;
              if (!displayChangelog) return null;
              return (
                <>
                  <Separator />
                  <motion.div variants={itemVariants} className="flex flex-col gap-2 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-sm">
                        {updateAvailable
                          ? t("software_update.release_notes")
                          : t("software_update.current_release_notes")}
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-muted-foreground"
                        onClick={() => setShowChangelog(true)}
                      >
                        <FileTextIcon className="size-3.5" />
                        {t("software_update.view_full")}
                      </Button>
                    </div>
                    <div
                      role="region"
                      aria-label={t("software_update.release_notes_aria")}
                      tabIndex={0}
                      className={cn("max-h-64 overflow-y-auto overflow-x-hidden wrap-break-word rounded-lg border bg-muted/50 p-4", PROSE_CLASSES)}
                    >
                      <Markdown>{displayChangelog}</Markdown>
                    </div>
                  </motion.div>
                </>
              );
            })()}

            {/* ── Download progress / verified badge ──────────────── */}
            {/* Rendered whenever a download is in-flight or staged, so that
                Version Management reinstall/downgrade flows surface progress
                and the staged-ready prompt, not just the "update available"
                forward-update path. */}
            {downloadState && (
              <>
                <Separator />
                <motion.div variants={itemVariants}>
                  {(downloadState.status === "downloading" || downloadState.status === "verifying") && (
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          {downloadState.status === "downloading"
                            ? t("software_update.downloading_file")
                            : t("software_update.verifying_sha")}
                        </span>
                        {downloadState.size && (
                          <span className="text-xs text-muted-foreground">{downloadState.size}</span>
                        )}
                      </div>
                      <div
                        className="h-1.5 rounded-full bg-muted overflow-hidden"
                        role="progressbar"
                        aria-label={
                          downloadState.status === "downloading"
                            ? t("software_update.download_progress_aria")
                            : t("software_update.verify_progress_aria")
                        }
                      >
                        <div className="h-full w-2/5 rounded-full bg-primary animate-progress-indeterminate" />
                      </div>
                    </div>
                  )}
                  {downloadState.status === "ready" && (
                    <div className="flex items-center gap-2 rounded-lg border border-success/20 bg-success/5 p-2.5">
                      <CheckCircle2Icon className="size-4 text-success shrink-0" />
                      <span className="text-xs text-success">
                        {downloadState.size
                          ? t("software_update.verified_badge_with_size", { size: downloadState.size })
                          : t("software_update.verified_badge")}
                      </span>
                    </div>
                  )}
                  {downloadState.status === "error" && (
                    <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-2.5">
                      <AlertTriangleIcon className="size-4 text-destructive shrink-0" />
                      <span className="text-xs text-destructive">
                        {downloadState.message || t("software_update.download_failed")}
                      </span>
                    </div>
                  )}
                </motion.div>
              </>
            )}

            {/* ── Footer: timestamp + action button ───────────────── */}
            <Separator />
            <motion.div variants={itemVariants} className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">
                {lastChecked
                  ? t("software_update.last_checked", { time: formatRelativeTime(lastChecked, t) })
                  : t("software_update.never_checked")}
              </span>
              {downloadState?.status === "ready" ? (
                // Staged download (any version — forward, reinstall, downgrade)
                <Button
                  onClick={() => setShowInstallDialog(true)}
                  disabled={isUpdating}
                >
                  <DownloadIcon className="size-4" />
                  {t("software_update.install_version", {
                    version: downloadState.version ?? t("software_update.update_fallback"),
                  })}
                </Button>
              ) : isDownloading ||
                downloadState?.status === "downloading" ||
                downloadState?.status === "verifying" ? (
                <Button disabled>
                  <LoaderCircle className="size-4 animate-spin" />
                  {downloadState?.status === "verifying"
                    ? t("software_update.verifying")
                    : t("software_update.downloading")}
                </Button>
              ) : updateAvailable ? (
                <Button
                  onClick={handleDownload}
                  disabled={isUpdating}
                >
                  {downloadState?.status === "error" ? (
                    <>
                      <RefreshCwIcon className="size-4" />
                      {t("software_update.retry_download")}
                    </>
                  ) : (
                    <>
                      <DownloadIcon className="size-4" />
                      {t("software_update.download_update")}
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={checkForUpdates}
                  disabled={isChecking || isUpdating}
                >
                  {isChecking ? (
                    <>
                      <LoaderCircle className="size-4 animate-spin" />
                      {t("software_update.checking")}
                    </>
                  ) : (
                    <>
                      <RefreshCwIcon className="size-4" />
                      {t("software_update.check_for_updates")}
                    </>
                  )}
                </Button>
              )}
            </motion.div>
          </motion.div>
        </CardContent>
      </Card>

      {/* ── Release notes dialog ──────────────────────────────────────── */}
      <Dialog open={showChangelog} onOpenChange={setShowChangelog}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {t("software_update.release_notes_dialog_title", {
                version: updateAvailable ? updateInfo?.latest_version : updateInfo?.current_version,
              })}
            </DialogTitle>
          </DialogHeader>
          <div
            role="region"
            aria-label={t("software_update.full_release_notes_aria")}
            tabIndex={0}
            className={cn("max-h-[60vh] overflow-y-auto overflow-x-hidden wrap-break-word rounded-lg border bg-muted/50 p-5", PROSE_CLASSES)}
          >
            <Markdown>
              {(updateAvailable ? updateInfo?.changelog : updateInfo?.current_changelog) ?? ""}
            </Markdown>
          </div>
          <DialogFooter showCloseButton />
        </DialogContent>
      </Dialog>

      {/* ── Install confirmation dialog ──────────────────────────────── */}
      {(() => {
        // Prefer the staged version from downloadState so reinstall / downgrade
        // flows show the actual tarball that will be installed, not whatever
        // latest_version the update check returned.
        const stagedVersion =
          downloadState?.version ?? updateInfo?.latest_version ?? "";
        const currentVersion = updateInfo?.current_version ?? "";
        const isReinstall =
          !!stagedVersion && stagedVersion === currentVersion;
        return (
          <AlertDialog
            open={showInstallDialog}
            onOpenChange={setShowInstallDialog}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {isReinstall
                    ? t("software_update.install_dialog_reinstall_title")
                    : t("software_update.install_dialog_install_title", { version: stagedVersion })}
                </AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div>
                    <p>
                      {isReinstall ? (
                        <Trans
                          i18nKey="software_update.install_dialog_reinstall_description"
                          ns="system-settings"
                          values={{ version: stagedVersion }}
                          components={{ strong: <strong /> }}
                        />
                      ) : (
                        <Trans
                          i18nKey="software_update.install_dialog_install_description"
                          ns="system-settings"
                          values={{ version: stagedVersion, current: currentVersion }}
                          components={{ strong: <strong /> }}
                        />
                      )}
                    </p>
                    {downloadState?.size && (
                      <p>
                        <Trans
                          i18nKey="software_update.install_dialog_size_suffix"
                          ns="system-settings"
                          values={{ size: downloadState.size }}
                          components={{ strong: <strong /> }}
                        />
                      </p>
                    )}
                    <p>{t("software_update.install_dialog_do_not_power_off")}</p>
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("actions.cancel", { ns: "common" })}</AlertDialogCancel>
                <AlertDialogAction onClick={handleInstall}>
                  <DownloadIcon className="size-4" />
                  {isReinstall
                    ? t("software_update.install_dialog_reinstall_now")
                    : t("software_update.install_dialog_install_now")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        );
      })()}
    </>
  );
}
