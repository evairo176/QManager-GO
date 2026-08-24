"use client";

import React, { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import ConfigBackupCard from "./config-backup-card";
import RestoreConfigBackupCard from "./restore-backup-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
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
import { TriangleAlertIcon } from "lucide-react";
import { authFetch } from "@/lib/auth-fetch";
import {
  usePendingReboot,
  clearPendingReboot,
  requestRebootLater,
  enterRebootFlow,
} from "@/lib/reboot";
import { useTranslation } from "react-i18next";

const ConfigurationBackupComponent = () => {
  const { t } = useTranslation("system-settings");
  const pending = usePendingReboot();
  const [rebootBusy, setRebootBusy] = useState(false);
  const [dismissDialogOpen, setDismissDialogOpen] = useState(false);

  const handleRebootNow = async () => {
    setRebootBusy(true);
    clearPendingReboot();
    try {
      const res = await authFetch("/cgi-bin/quecmanager/system/reboot.sh", {
        method: "POST",
      });
      if (!res.ok) {
        throw new Error(`reboot_failed: HTTP ${res.status}`);
      }
      enterRebootFlow("config_restore");
    } catch {
      requestRebootLater("config_restore");
      setRebootBusy(false);
    }
  };

  const handleConfirmDismiss = () => {
    clearPendingReboot();
    setDismissDialogOpen(false);
  };

  return (
    <div className="@container/main mx-auto p-2">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">{t("config_backup.page_title")}</h1>
        <p className="text-muted-foreground">
          {t("config_backup.page_description")}
        </p>
      </div>

      <AnimatePresence initial={false}>
        {pending && (
          <motion.div
            key="pending-reboot-banner"
            initial={{ opacity: 0, y: -6, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -6, height: 0 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <Alert variant="warning" className="mb-6">
              <TriangleAlertIcon />
              <AlertTitle>{t("config_backup.pending_reboot_title")}</AlertTitle>
              <AlertDescription>
                <p className="text-foreground/80">
                  {t("config_backup.pending_reboot_description")}
                </p>
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    onClick={handleRebootNow}
                    disabled={rebootBusy}
                  >
                    {rebootBusy ? t("config_backup.rebooting_button") : t("config_backup.reboot_now_button")}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setDismissDialogOpen(true)}
                    disabled={rebootBusy}
                  >
                    {t("config_backup.dismiss_button")}
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>

      <AlertDialog open={dismissDialogOpen} onOpenChange={setDismissDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("config_backup.dismiss_dialog_title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("config_backup.dismiss_dialog_description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("config_backup.dismiss_keep")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDismiss}>
              {t("config_backup.dismiss_confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="grid grid-cols-1 @3xl/main:grid-cols-2 grid-flow-row gap-4 items-stretch">
        <div className="h-full">
          <ConfigBackupCard />
        </div>
        <div className="h-full">
          <RestoreConfigBackupCard />
        </div>
      </div>
    </div>
  );
};

export default ConfigurationBackupComponent;
