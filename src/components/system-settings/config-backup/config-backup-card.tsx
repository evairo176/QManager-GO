"use client";

import { useMemo, useState } from "react";
import { motion } from "motion/react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckIcon, EyeIcon, EyeOffIcon, Loader2Icon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  BACKUP_SECTIONS,
  computeDisabledKeys,
  initialSelection,
  selectedKeys,
} from "@/lib/config-backup/sections";
import { useConfigBackup } from "@/hooks/use-config-backup";
import { useTranslation } from "react-i18next";

const MIN_PASSPHRASE_LEN = 10;

// Cellular-information style row stagger — contents slide in from the left
// on mount, one after another, matching the rest of the app's data cards.
const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.04 } },
};
const rowItem = {
  hidden: { opacity: 0, x: -8 },
  visible: { opacity: 1, x: 0 },
};
const rowTransition = { duration: 0.2, ease: "easeOut" as const };

const ConfigBackupCard = () => {
  const { t } = useTranslation("system-settings");
  const [selection, setSelection] = useState(initialSelection());
  const [passphrase, setPassphrase] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const { runBackup, stage, reset } = useConfigBackup();

  const disabled = useMemo(() => computeDisabledKeys(selection), [selection]);
  const chosen = useMemo(() => selectedKeys(selection), [selection]);

  const passphraseOk =
    passphrase.length >= MIN_PASSPHRASE_LEN && passphrase === confirm;
  const busy =
    stage === "collecting" || stage === "encrypting" || stage === "downloading";
  const canDownload = chosen.length > 0 && passphraseOk && !busy;

  const buttonLabel =
    stage === "collecting"
      ? t("config_backup.create.button_collecting")
      : stage === "encrypting"
      ? t("config_backup.create.button_encrypting")
      : stage === "downloading"
      ? t("config_backup.create.button_downloading")
      : t("config_backup.create.button_default");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canDownload) return;
    reset();
    const result = await runBackup(chosen, passphrase);
    if (result.ok) {
      toast.success(t("config_backup.create.toast_success"));
      setPassphrase("");
      setConfirm("");
      reset();
      return;
    }
    toast.error(t("config_backup.create.toast_failed"));
    reset();
  };

  return (
    <Card className="@container/card h-full">
      <CardHeader>
        <CardTitle>{t("config_backup.create.card_title")}</CardTitle>
        <CardDescription>
          {t("config_backup.create.card_description")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <motion.form
          className="grid gap-y-8"
          onSubmit={handleSubmit}
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
        >
          <motion.div variants={rowItem} transition={rowTransition}>
            <FieldSet>
              <FieldLegend variant="label">{t("config_backup.create.sections_legend")}</FieldLegend>
              <FieldGroup className="gap-3">
                <motion.div
                  className="grid gap-3"
                  variants={staggerContainer}
                >
                  {BACKUP_SECTIONS.map((s) => {
                    const isDisabled = disabled.has(s.key);
                    const checked = selection[s.key] && !isDisabled;
                    return (
                      <motion.div
                        key={s.key}
                        variants={rowItem}
                        transition={rowTransition}
                      >
                        <Field orientation="horizontal">
                          <Checkbox
                            id={`backup-section-${s.key}`}
                            name={`backup-section-${s.key}`}
                            checked={checked}
                            disabled={isDisabled}
                            onCheckedChange={(v) =>
                              setSelection((prev) => ({
                                ...prev,
                                [s.key]: v === true,
                              }))
                            }
                          />
                          <FieldLabel
                            htmlFor={`backup-section-${s.key}`}
                            className="font-normal"
                          >
                            {t(`config_backup.sections.${s.key}`)}
                            {isDisabled && s.overlapGroup === "profile" && (
                              <span className="ml-2 text-xs text-muted-foreground">
                                {t("config_backup.create.profile_overlap_hint")}
                              </span>
                            )}
                            {isDisabled && s.key === "profiles" && (
                              <span className="ml-2 text-xs text-muted-foreground">
                                {t("config_backup.create.profile_uncheck_hint")}
                              </span>
                            )}
                          </FieldLabel>
                        </Field>
                      </motion.div>
                    );
                  })}
                </motion.div>
              </FieldGroup>
            </FieldSet>
          </motion.div>

          <motion.div
            className="grid gap-y-4"
            variants={rowItem}
            transition={rowTransition}
          >
            <Field>
              <FieldLabel htmlFor="backup-passphrase">{t("config_backup.create.passphrase_label")}</FieldLabel>
              <div className="relative max-w-sm">
                <Input
                  id="backup-passphrase"
                  type={showPassphrase ? "text" : "password"}
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  placeholder={t("config_backup.create.passphrase_placeholder")}
                  className="pr-10"
                  autoComplete="new-password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground before:absolute before:-inset-1.5 before:content-['']"
                  onClick={() => setShowPassphrase((v) => !v)}
                  aria-label={showPassphrase ? t("config_backup.create.passphrase_hide_aria") : t("config_backup.create.passphrase_show_aria")}
                  aria-pressed={showPassphrase}
                >
                  {showPassphrase ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
                </Button>
              </div>
            </Field>
            <Field>
              <FieldLabel htmlFor="backup-passphrase-confirm">
                {t("config_backup.create.confirm_label")}
              </FieldLabel>
              <div className="relative max-w-sm">
                <Input
                  id="backup-passphrase-confirm"
                  type={showConfirm ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="pr-10"
                  autoComplete="new-password"
                  aria-describedby={confirm.length > 0 ? "backup-confirm-hint" : undefined}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground before:absolute before:-inset-1.5 before:content-['']"
                  onClick={() => setShowConfirm((v) => !v)}
                  aria-label={showConfirm ? t("config_backup.create.passphrase_hide_aria") : t("config_backup.create.passphrase_show_aria")}
                  aria-pressed={showConfirm}
                >
                  {showConfirm ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
                </Button>
              </div>
              {confirm.length > 0 && (
                <p
                  id="backup-confirm-hint"
                  className={cn(
                    "flex items-center gap-1.5 text-xs transition-colors duration-200",
                    passphrase === confirm ? "text-success" : "text-destructive"
                  )}
                >
                  {passphrase === confirm ? (
                    <CheckIcon className="size-3.5" />
                  ) : (
                    <XIcon className="size-3.5" />
                  )}
                  {passphrase === confirm ? t("config_backup.create.confirm_match") : t("config_backup.create.confirm_mismatch")}
                </p>
              )}
            </Field>
            <p className="text-xs text-muted-foreground max-w-sm">
              {t("config_backup.create.warning")}
            </p>
          </motion.div>

          <motion.div variants={rowItem} transition={rowTransition}>
            <Button type="submit" disabled={!canDownload}>
              {busy && <Loader2Icon className="size-4 animate-spin" />}
              {buttonLabel}
            </Button>
          </motion.div>
        </motion.form>
      </CardContent>
    </Card>
  );
};

export default ConfigBackupCard;
