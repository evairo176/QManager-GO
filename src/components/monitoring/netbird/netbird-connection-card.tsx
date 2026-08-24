"use client";

import React, { useState } from "react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { rebootNow } from "@/lib/reboot";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CopyableCommand } from "@/components/ui/copyable-command";
import {
  Loader2,
  PackageIcon,
  AlertCircle,
  RefreshCcwIcon,
  AlertTriangleIcon,
  CheckCircle2Icon,
  MinusCircleIcon,
  Trash2Icon,
} from "lucide-react";
import type { UseNetBirdReturn } from "@/hooks/use-netbird";

// =============================================================================
// NetBirdConnectionCard — Multi-state connection + settings card
// =============================================================================
// States: Loading → Error → Not Installed → Service Stopped →
//         Disconnected → Connected

type NetBirdConnectionCardProps = Omit<UseNetBirdReturn, "refresh"> & {
  refresh: () => void;
};

// ─── Component ──────────────────────────────────────────────────────────────

export function NetBirdConnectionCard({
  status,
  isLoading,
  isConnecting,
  isDisconnecting,
  isTogglingService,
  isUninstalling,
  installResult,
  error,
  connect,
  disconnect,
  startService,
  stopService,
  setBootEnabled,
  uninstall,
  runInstall,
  refresh,
}: NetBirdConnectionCardProps) {
  const { t } = useTranslation("monitoring");
  const [setupKey, setSetupKey] = useState("");
  const [showRebootDialog, setShowRebootDialog] = useState(false);
  const [isRebooting, setIsRebooting] = useState(false);

  const handleReboot = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsRebooting(true);
    rebootNow("netbird");
  };

  // Reboot confirmation dialog (shown after successful uninstall)
  // Defined before early returns so it renders in all states including "Not Installed"
  const rebootDialog = (
    <AlertDialog open={showRebootDialog} onOpenChange={(open) => {
      if (!isRebooting) setShowRebootDialog(open);
    }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("netbird.reboot_required_title")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("netbird.reboot_required_description")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isRebooting}>
            {t("netbird.reboot_later_button")}
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={isRebooting}
            onClick={handleReboot}
          >
            {isRebooting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {t("netbird.rebooting_label")}
              </>
            ) : (
              t("netbird.reboot_now_button")
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  // --- Loading skeleton ------------------------------------------------------
  if (isLoading) {
    return (
      <Card className="@container/card">
        <CardHeader>
          <CardTitle>{t("netbird.connection_title")}</CardTitle>
          <CardDescription>
            {t("netbird.connection_description")}
          </CardDescription>
        </CardHeader>
        <CardContent aria-live="polite">
          <div className="grid gap-2">
            <Skeleton className="h-6 w-28" />
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-5 w-full" />
            ))}
            <Skeleton className="h-9 w-32" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // --- Error state (initial fetch failed) ------------------------------------
  if (!isLoading && error && !status) {
    return (
      <Card className="@container/card">
        <CardHeader>
          <CardTitle>{t("netbird.connection_title")}</CardTitle>
          <CardDescription>
            {t("netbird.connection_description")}
          </CardDescription>
        </CardHeader>
        <CardContent aria-live="polite">
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertTitle>{t("netbird.error_load_status")}</AlertTitle>
            <AlertDescription className="flex items-center justify-between">
              <span>{error}</span>
              <Button variant="outline" size="sm" onClick={() => refresh()}>
                <RefreshCcwIcon className="size-3.5" />
                {t("actions.retry", { ns: "common" })}
              </Button>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  // --- Not Installed ---------------------------------------------------------
  if (status && !status.installed) {
    const installCmd =
      status.install_hint || t("netbird.install_command");

    return (
      <Card className="@container/card">
        <CardHeader>
          <CardTitle>{t("netbird.connection_title")}</CardTitle>
          <CardDescription>
            {t("netbird.connection_description")}
          </CardDescription>
        </CardHeader>
        <CardContent aria-live="polite">
          <div className="flex flex-col items-center justify-center py-6 gap-4">
            <PackageIcon className="size-10 text-muted-foreground" />
            <div className="text-center space-y-1.5">
              <p className="text-sm font-medium">
                {t("netbird.not_installed_title")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("netbird.not_installed_description")}
              </p>
            </div>

            {installResult.status === "complete" && (
              <Alert className="border-success/30 bg-success/5">
                <CheckCircle2Icon className="text-success" />
                <AlertDescription className="text-success">
                  <p>{installResult.message}</p>
                </AlertDescription>
              </Alert>
            )}

            {installResult.status === "error" && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <p>
                    {installResult.message}
                    {installResult.detail && (
                      <span className="block text-xs mt-1 opacity-80">
                        {installResult.detail}
                      </span>
                    )}
                  </p>
                </AlertDescription>
              </Alert>
            )}

            <div className="flex items-center gap-2">
              <Button
                onClick={runInstall}
                disabled={installResult.status === "running"}
              >
                {installResult.status === "running" ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    {installResult.message || t("netbird.installing_label")}
                  </>
                ) : (
                  <>
                    <PackageIcon className="size-4" />
                    {t("netbird.install_button")}
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refresh()}
                disabled={installResult.status === "running"}
              >
                <RefreshCcwIcon className="size-3.5" />
                {t("netbird.check_again_button")}
              </Button>
            </div>

            <div className="w-full flex items-center gap-3 text-xs text-muted-foreground">
              <div className="h-px flex-1 bg-border" />
              <span>{t("netbird.install_manually_label")}</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <CopyableCommand command={installCmd} />
          </div>
          {rebootDialog}
        </CardContent>
      </Card>
    );
  }

  // --- Stale data warning (poll failed but we have previous data) ------------
  const staleWarning = error && status && (
    <Alert variant="destructive">
      <AlertCircle className="size-4" />
      <AlertDescription className="flex items-center justify-between">
        <span className="text-xs">{error}</span>
        <Button variant="outline" size="sm" onClick={() => refresh()}>
          <RefreshCcwIcon className="size-3.5" />
          {t("actions.retry", { ns: "common" })}
        </Button>
      </AlertDescription>
    </Alert>
  );

  // --- From here, NetBird IS installed ---------------------------------------
  const version = status?.version;
  const backendState = status?.backend_state || "";
  const daemonRunning = status?.daemon_running;
  const bootEnabled = status?.enabled_on_boot ?? false;

  // Boot toggle handler
  const handleBootToggle = async (checked: boolean) => {
    const success = await setBootEnabled(checked);
    if (success) {
      toast.success(
        checked
          ? t("netbird.toast_service_started")
          : t("netbird.toast_service_stopped"),
      );
    } else {
      toast.error(t("netbird.boot_toggle_error"));
    }
  };

  // Boot toggle element (reused across states)
  const bootToggle = (
    <>
      <Separator />
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-muted-foreground">
          {t("netbird.boot_toggle_label")}
        </p>
        <Switch
          checked={bootEnabled}
          onCheckedChange={handleBootToggle}
          aria-label={t("netbird.boot_toggle_label")}
        />
      </div>
    </>
  );

  // Uninstall section (follows Email Alerts / Video Optimizer pattern)
  const uninstallSection = (
    <>
      <Separator className="mt-4" />
      <div className="flex items-center justify-between pt-4">
        <div>
          <p className="text-sm font-medium">{t("netbird.remove_title")}</p>
          <p className="text-xs text-muted-foreground">
            {t("netbird.remove_description")}
          </p>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="destructive"
              size="sm"
              disabled={isUninstalling}
            >
              {isUninstalling ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {t("netbird.removing_label")}
                </>
              ) : (
                <>
                  <Trash2Icon className="size-4" />
                  {t("netbird.uninstall_button")}
                </>
              )}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("netbird.uninstall_confirm_title")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("netbird.uninstall_confirm_description")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("actions.cancel", { ns: "common" })}</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={async () => {
                  const success = await uninstall();
                  if (success) {
                    toast.success(t("netbird.toast_uninstalled"));
                    setShowRebootDialog(true);
                  } else {
                    toast.error(t("netbird.toast_uninstall_error"));
                  }
                }}
              >
                {t("netbird.uninstall_confirm_button")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </>
  );

  // Setup key input (reused in disconnected / needs-connect states)
  const setupKeyInput = (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Input
          type="text"
          placeholder={t("netbird.setup_key_placeholder")}
          value={setupKey}
          onChange={(e) => setSetupKey(e.target.value)}
          className="font-mono text-xs"
          disabled={isConnecting}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {t("netbird.setup_key_description")}
      </p>
    </div>
  );

  // --- Service Stopped -------------------------------------------------------
  if (!daemonRunning) {
    return (
      <Card className="@container/card">
        <CardHeader>
          <CardTitle>{t("netbird.connection_title")}</CardTitle>
          <CardDescription>
            {version ? `NetBird v${version} · ` : ""}{t("netbird.connection_description")}
          </CardDescription>
        </CardHeader>
        <CardContent aria-live="polite">
          <div className="grid gap-2">
            {staleWarning}
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-muted-foreground">
                {t("netbird.label_service")}
              </p>
              <Badge variant="outline" className="bg-muted/50 text-muted-foreground border-muted-foreground/30">
                <MinusCircleIcon className="size-3" />
                {t("netbird.badge_stopped")}
              </Badge>
            </div>
            {bootToggle}
            <Separator />
            <div className="flex items-center gap-2 flex-wrap pt-1">
              <Button
                onClick={async () => {
                  const success = await startService();
                  if (success) {
                    toast.success(t("netbird.toast_service_started"));
                  } else {
                    toast.error(t("netbird.toast_service_start_error"));
                  }
                }}
                disabled={isTogglingService}
              >
                {isTogglingService ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    {t("netbird.starting_label")}
                  </>
                ) : (
                  t("netbird.service_start_button")
                )}
              </Button>

            </div>
            {uninstallSection}
            {rebootDialog}
          </div>
        </CardContent>
      </Card>
    );
  }

  // --- Connected -------------------------------------------------------------
  if (backendState === "Connected") {
    const management = status?.management || t("shared.unknown", { ns: "monitoring" });
    const signal = status?.signal || t("shared.unknown", { ns: "monitoring" });
    const fqdn = status?.fqdn || "";
    const netbirdIp = status?.netbird_ip || "";

    const infoRows: { label: string; value: React.ReactNode }[] = [
      ...(fqdn
        ? [
            {
              label: t("netbird.status_label_fqdn"),
              value: <span className="break-all">{fqdn}</span>,
            },
          ]
        : []),
      ...(netbirdIp
        ? [
            {
              label: t("netbird.status_label_netbird_ip"),
              value: <span className="font-mono">{netbirdIp}</span>,
            },
          ]
        : []),
      {
        label: t("netbird.status_label_management"),
        value:
          management === "Connected" ? (
            <Badge variant="outline" className="bg-success/15 text-success hover:bg-success/20 border-success/30">
              <CheckCircle2Icon className="size-3" />
              {t("netbird.badge_connected")}
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-destructive/15 text-destructive hover:bg-destructive/20 border-destructive/30">
              <AlertTriangleIcon className="size-3" />
              {management}
            </Badge>
          ),
      },
      {
        label: t("netbird.status_label_signal"),
        value:
          signal === "Connected" ? (
            <Badge variant="outline" className="bg-success/15 text-success hover:bg-success/20 border-success/30">
              <CheckCircle2Icon className="size-3" />
              {t("netbird.badge_connected")}
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-destructive/15 text-destructive hover:bg-destructive/20 border-destructive/30">
              <AlertTriangleIcon className="size-3" />
              {signal}
            </Badge>
          ),
      },
    ];

    return (
      <Card className="@container/card">
        <CardHeader>
          <CardTitle>{t("netbird.connection_title")}</CardTitle>
          <CardDescription>
            {version ? `NetBird v${version} · ` : ""}{t("netbird.connection_description")}
          </CardDescription>
        </CardHeader>
        <CardContent aria-live="polite">
          <div className="grid gap-2">
            {staleWarning}
            {/* Boot toggle */}
            {bootToggle}

            <Separator />

            {/* Status badge */}
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-muted-foreground">
                {t("netbird.label_status")}
              </p>
              <Badge variant="outline" className="bg-success/15 text-success hover:bg-success/20 border-success/30">
                <CheckCircle2Icon className="size-3" />
                {t("netbird.badge_connected")}
              </Badge>
            </div>

            {/* Info rows */}
            {infoRows.map((row, i) => (
              <React.Fragment key={row.label}>
                <Separator />
                <motion.div
                  className="flex items-center justify-between gap-2"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2, delay: Math.min(i * 0.05, 0.35), ease: "easeOut" }}
                >
                  <p className="text-sm font-semibold text-muted-foreground shrink-0">
                    {row.label}
                  </p>
                  <p className="text-sm font-semibold text-right min-w-0 break-all">
                    {row.value}
                  </p>
                </motion.div>
              </React.Fragment>
            ))}

            {/* Actions */}
            <Separator />
            <div className="flex items-center gap-2 flex-wrap pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  const success = await disconnect();
                  if (success) {
                    toast.success(t("netbird.toast_disconnected"));
                  } else {
                    toast.error(t("netbird.toast_disconnect_error"));
                  }
                }}
                disabled={isDisconnecting}
              >
                {isDisconnecting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    {t("netbird.disconnecting_label")}
                  </>
                ) : (
                  t("netbird.disconnect_button")
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // --- Disconnected / Connecting / Unknown -----------------------------------
  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>{t("netbird.connection_title")}</CardTitle>
        <CardDescription>
          {version ? `NetBird v${version} · ` : ""}{t("netbird.connection_description")}
        </CardDescription>
      </CardHeader>
      <CardContent aria-live="polite">
        <div className="grid gap-2">
          {staleWarning}
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-muted-foreground">
              {t("netbird.label_status")}
            </p>
            <Badge variant="outline" className="bg-muted/50 text-muted-foreground border-muted-foreground/30">
              <MinusCircleIcon className="size-3" />
              {t("netbird.badge_disconnected")}
            </Badge>
          </div>

          {bootToggle}

          <Separator />
          {setupKeyInput}
          <Separator />

          <div className="flex items-center gap-2 flex-wrap pt-1">
            <Button
              onClick={async () => {
                const success = await connect(setupKey || undefined);
                if (success) {
                  toast.success(t("netbird.toast_connected"));
                  setSetupKey("");
                } else {
                  toast.error(t("netbird.toast_connect_retry_error"));
                }
              }}
              disabled={isConnecting}
            >
              {isConnecting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {t("netbird.connecting_label")}
                </>
              ) : (
                t("netbird.connect_button")
              )}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                const success = await stopService();
                if (success) {
                  toast.success(t("netbird.toast_service_stopped"));
                } else {
                  toast.error(t("netbird.toast_service_stop_error"));
                }
              }}
              disabled={isTogglingService}
            >
              {isTogglingService ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {t("netbird.stopping_label")}
                </>
              ) : (
                t("netbird.service_stop_button")
              )}
            </Button>

          </div>
            {uninstallSection}
            {rebootDialog}
        </div>
      </CardContent>
    </Card>
  );
}
