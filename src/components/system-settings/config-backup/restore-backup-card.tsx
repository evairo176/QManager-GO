"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArchiveRestoreIcon,
  CheckCircle2Icon,
  Loader2Icon,
  LockIcon,
  TriangleAlertIcon,
  XCircleIcon,
} from "lucide-react";
import { useConfigRestore } from "@/hooks/use-config-restore";
import { useModemStatus } from "@/hooks/use-modem-status";
import { RestorePasswordDialog } from "./restore-password-dialog";
import { RestoreProgressList } from "./restore-progress-list";
import { BACKUP_SECTIONS } from "@/lib/config-backup/sections";
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
import { authFetch } from "@/lib/auth-fetch";
import {
  requestRebootLater,
  clearPendingReboot,
  enterRebootFlow,
} from "@/lib/reboot";
import { cn } from "@/lib/utils";
import { useTranslation, Trans } from "react-i18next";

const SECTION_LABELS: Record<string, string> = Object.fromEntries(
  BACKUP_SECTIONS.map((s) => [s.key, s.label]),
);

type Tone = "muted" | "info" | "success" | "warning" | "destructive";

const TONE_ICON_CLASS: Record<Tone, string> = {
  muted: "text-muted-foreground",
  info: "text-info",
  success: "text-success",
  warning: "text-warning",
  destructive: "text-destructive",
};

// Cellular-information style row stagger — each internal row of the status
// panel slides in from the left on mount. Re-plays every time AnimatePresence
// swaps the panel (state change), matching the feel of the rest of the app.
const panelStagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};
const panelRow = {
  hidden: { opacity: 0, x: -8 },
  visible: { opacity: 1, x: 0 },
};
const panelRowTransition = { duration: 0.2, ease: "easeOut" as const };

interface RestoreStatusPanelProps {
  icon: ReactNode;
  tone: Tone;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}

function RestoreStatusPanel({
  icon,
  tone,
  title,
  description,
  actions,
}: RestoreStatusPanelProps) {
  return (
    <motion.div
      className="flex flex-col gap-4 rounded-lg border border-dashed p-5"
      initial="hidden"
      animate="visible"
      variants={panelStagger}
    >
      <motion.div
        className="flex items-start gap-4"
        variants={panelRow}
        transition={panelRowTransition}
      >
        <span
          className={cn(
            "mt-0.5 flex size-5 shrink-0 items-center justify-center [&>svg]:size-5",
            TONE_ICON_CLASS[tone],
          )}
          aria-hidden
        >
          {icon}
        </span>
        <div className="min-w-0 flex-1 space-y-2">
          <h3 className="text-sm font-medium leading-none">{title}</h3>
          {description && (
            <div className="text-sm text-muted-foreground">{description}</div>
          )}
        </div>
      </motion.div>
      {actions && (
        <motion.div
          className="flex flex-wrap gap-2"
          variants={panelRow}
          transition={panelRowTransition}
        >
          {actions}
        </motion.div>
      )}
    </motion.div>
  );
}

const RestoreConfigBackupCard = () => {
  const { t } = useTranslation("system-settings");
  const modem = useModemStatus();
  const {
    state,
    readFile,
    tryPassword,
    confirmModelWarning,
    startApply,
    cancel,
    reset,
  } = useConfigRestore(modem.data?.device.model ?? "");

  const fileInput = useRef<HTMLInputElement>(null);
  const [pwDialogOpen, setPwDialogOpen] = useState(false);
  const [rebootDialogOpen, setRebootDialogOpen] = useState(false);
  const [rebootBusy, setRebootBusy] = useState(false);

  const ui = state.ui;

  useEffect(() => {
    if (
      pwDialogOpen &&
      ui !== "password_required" &&
      ui !== "password_incorrect" &&
      ui !== "reading"
    ) {
      setPwDialogOpen(false);
    }
  }, [ui, pwDialogOpen]);

  // Open the password dialog automatically when the envelope is parsed.
  // Intentionally does NOT depend on pwDialogOpen so user-dismissing it
  // while still in password_required does not re-open it.
  useEffect(() => {
    if (ui === "password_required") {
      setPwDialogOpen(true);
    }
  }, [ui]);

  useEffect(() => {
    if (
      (ui === "success" || ui === "partial_success") &&
      state.progress?.reboot_required === true
    ) {
      requestRebootLater("config_restore");
      setRebootDialogOpen(true);
    }
  }, [ui, state.progress?.reboot_required]);

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
      setRebootDialogOpen(false);
    }
  };

  const handleRebootLater = () => {
    setRebootDialogOpen(false);
  };

  const openFilePicker = () => fileInput.current?.click();

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      await readFile(f);
    }
    e.target.value = "";
  };

  const handlePasswordSubmit = async (pw: string) => {
    await tryPassword(pw);
  };

  const prefersReducedMotion = useReducedMotion();
  const motionProps = useMemo(
    () => ({
      initial: { opacity: 0, y: prefersReducedMotion ? 0 : 6 },
      animate: { opacity: 1, y: 0 },
      exit: { opacity: 0, y: prefersReducedMotion ? 0 : -6 },
      transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] as const },
    }),
    [prefersReducedMotion],
  );

  // Collapse password_required/password_incorrect and success/partial_success
  // into single motion keys — transitions inside these pairs are minor text
  // swaps, not full state changes, so the panel should stay mounted.
  const panelKey =
    ui === "password_required" || ui === "password_incorrect"
      ? "password"
      : ui === "success" || ui === "partial_success"
      ? "complete"
      : ui;

  return (
    <Card className="@container/card h-full">
      <CardHeader>
        <CardTitle>{t("config_backup.restore.card_title")}</CardTitle>
        <CardDescription>
          {t("config_backup.restore.card_description")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <input
          ref={fileInput}
          type="file"
          accept=".qmbackup,application/octet-stream"
          className="hidden"
          onChange={onFileChange}
        />

        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={panelKey} {...motionProps}>
        {ui === "idle" && (
          <RestoreStatusPanel
            icon={<ArchiveRestoreIcon />}
            tone="muted"
            title={t("config_backup.restore.idle_title")}
            description={t("config_backup.restore.idle_description")}
            actions={
              <Button onClick={openFilePicker}>
                {t("config_backup.restore.upload_button")}
              </Button>
            }
          />
        )}

        {ui === "reading" && (
          <RestoreStatusPanel
            icon={<Loader2Icon className="animate-spin" />}
            tone="info"
            title={t("config_backup.restore.reading_title")}
            description={t("config_backup.restore.reading_description")}
          />
        )}

        {(ui === "password_required" || ui === "password_incorrect") && (
          <RestoreStatusPanel
            icon={<LockIcon />}
            tone={ui === "password_incorrect" ? "destructive" : "info"}
            title={
              ui === "password_incorrect"
                ? t("config_backup.restore.password_incorrect_title")
                : t("config_backup.restore.password_required_title")
            }
            description={
              ui === "password_incorrect"
                ? t("config_backup.restore.password_incorrect_description")
                : t("config_backup.restore.password_required_description")
            }
            actions={
              <>
                <Button onClick={() => setPwDialogOpen(true)}>
                  {ui === "password_incorrect"
                    ? t("config_backup.restore.button_try_again")
                    : t("config_backup.restore.button_enter_password")}
                </Button>
                <Button variant="ghost" size="sm" onClick={reset}>
                  {t("config_backup.restore.cancel_button")}
                </Button>
              </>
            }
          />
        )}

        {ui === "model_warning" && state.envelope && (
          <RestoreStatusPanel
            icon={<TriangleAlertIcon />}
            tone="warning"
            title={t("config_backup.restore.model_warning_title")}
            description={
              <Trans
                i18nKey="config_backup.restore.model_warning_body"
                ns="system-settings"
                values={{
                  from: state.envelope.device.model,
                  to: modem.data?.device.model ?? t("config_backup.restore.model_unknown"),
                }}
                components={{
                  b: <span className="font-medium text-foreground" />,
                }}
              />
            }
            actions={
              <>
                <Button onClick={confirmModelWarning}>
                  {t("config_backup.restore.button_continue_anyway")}
                </Button>
                <Button variant="ghost" size="sm" onClick={reset}>
                  {t("config_backup.restore.cancel_button")}
                </Button>
              </>
            }
          />
        )}

        {ui === "ready" && state.envelope && state.payload && (
          <RestoreStatusPanel
            icon={<CheckCircle2Icon />}
            tone="success"
            title={t("config_backup.restore.ready_title")}
            description={
              <div className="space-y-3">
                <p>
                  <Trans
                    i18nKey="config_backup.restore.ready_from_body"
                    ns="system-settings"
                    values={{
                      model: state.envelope.device.model,
                      created: new Date(state.envelope.created_at).toLocaleString(),
                    }}
                    components={{
                      b: <span className="font-medium text-foreground" />,
                    }}
                  />
                </p>
                <div>
                  <p className="mb-2 text-foreground/80">
                    {t("config_backup.restore.ready_sections_label")}
                  </p>
                  <ul className="grid gap-1 text-sm text-foreground">
                    {Object.keys(state.payload.sections).map((key) => (
                      <li
                        key={key}
                        className="flex items-center gap-2 before:size-1.5 before:rounded-full before:bg-foreground/40 before:content-['']"
                      >
                        {t(`config_backup.sections.${key}`, SECTION_LABELS[key] ?? key)}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            }
            actions={
              <>
                <Button onClick={startApply}>
                  {t("config_backup.restore.button_apply")}
                </Button>
                <Button variant="ghost" size="sm" onClick={reset}>
                  {t("config_backup.restore.cancel_button")}
                </Button>
              </>
            }
          />
        )}

        {ui === "applying" && (
          <RestoreStatusPanel
            icon={<Loader2Icon className="animate-spin" />}
            tone="info"
            title={t("config_backup.restore.applying_title")}
            description={
              state.progress ? (
                <RestoreProgressList sections={state.progress.sections} />
              ) : (
                t("config_backup.restore.applying_starting")
              )
            }
            actions={
              <Button variant="outline" size="sm" onClick={cancel}>
                {t("config_backup.restore.cancel_button")}
              </Button>
            }
          />
        )}

        {(ui === "success" || ui === "partial_success") && state.progress && (
          <RestoreStatusPanel
            icon={
              ui === "success" ? <CheckCircle2Icon /> : <TriangleAlertIcon />
            }
            tone={ui === "success" ? "success" : "warning"}
            title={
              ui === "success"
                ? t("config_backup.restore.success_title")
                : t("config_backup.restore.partial_success_title")
            }
            description={
              <RestoreProgressList sections={state.progress.sections} />
            }
            actions={<Button onClick={reset}>{t("config_backup.restore.button_done")}</Button>}
          />
        )}

        {ui === "failed" && (
          <RestoreStatusPanel
            icon={<XCircleIcon />}
            tone="destructive"
            title={t("config_backup.restore.failed_title")}
            description={state.error ?? t("config_backup.restore.failed_unknown")}
            actions={
              <Button variant="outline" onClick={reset}>
                {t("config_backup.restore.button_try_again")}
              </Button>
            }
          />
        )}
          </motion.div>
        </AnimatePresence>

        <RestorePasswordDialog
          open={
            pwDialogOpen &&
            (ui === "password_required" || ui === "password_incorrect")
          }
          onOpenChange={setPwDialogOpen}
          onSubmit={handlePasswordSubmit}
          incorrect={ui === "password_incorrect"}
        />

        <AlertDialog open={rebootDialogOpen} onOpenChange={setRebootDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("config_backup.restore.reboot_dialog_title")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("config_backup.restore.reboot_dialog_description")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                onClick={handleRebootLater}
                disabled={rebootBusy}
              >
                {t("config_backup.restore.reboot_later_button")}
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleRebootNow}
                disabled={rebootBusy}
              >
                {rebootBusy ? t("config_backup.rebooting_button") : t("config_backup.reboot_now_button")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
};

export default RestoreConfigBackupCard;
