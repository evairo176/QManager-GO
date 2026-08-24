"use client";

import { useState, type FormEvent, type ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { SaveButton, useSaveFlash } from "@/components/ui/save-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
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
import { TbInfoCircleFilled } from "react-icons/tb";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RotateCcwIcon, AlertTriangleIcon } from "lucide-react";
import type { BackupImeiConfig } from "@/types/imei-settings";

interface BackupIMEICardProps {
  backupEnabled: boolean | null;
  backupImei: string | null;
  isLoading: boolean;
  isSaving: boolean;
  onSave: (config: BackupImeiConfig) => Promise<boolean>;
}

const BackupIMEICard = ({
  backupEnabled,
  backupImei,
  isLoading,
  isSaving,
  onSave,
}: BackupIMEICardProps) => {
  const { t } = useTranslation("cellular");
  const { saved, markSaved } = useSaveFlash();
  const [localEnabled, setLocalEnabled] = useState(false);
  const [localImei, setLocalImei] = useState("");
  const [showInfoDialog, setShowInfoDialog] = useState(false);

  // Seed local form state from fetched data using the render-phase derived-state
  // pattern (React docs: "You Might Not Need an Effect") instead of useEffect, so
  // the sync lands in the same commit. The prev refs make this re-run only when a
  // source changes — identical semantics to the previous
  // [backupEnabled, backupImei] effect.
  const [prevEnabled, setPrevEnabled] = useState(backupEnabled);
  const [prevImei, setPrevImei] = useState(backupImei);
  if (backupEnabled !== prevEnabled || backupImei !== prevImei) {
    setPrevEnabled(backupEnabled);
    setPrevImei(backupImei);
    if (backupEnabled !== null) {
      setLocalEnabled(backupEnabled);
    }
    if (backupImei !== null) {
      setLocalImei(backupImei);
    }
  }

  const isValidImei = /^\d{15}$/.test(localImei);

  const handleSwitchChange = (checked: boolean) => {
    if (checked) {
      // Show informational dialog before enabling
      setShowInfoDialog(true);
    } else {
      setLocalEnabled(false);
    }
  };

  const handleInfoConfirm = () => {
    setLocalEnabled(true);
    setShowInfoDialog(false);
  };

  const handleInfoCancel = () => {
    setShowInfoDialog(false);
    // Switch stays OFF
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();

    if (localEnabled && !isValidImei) {
      toast.error(t("core_settings.imei.backup_card.toast.invalid"));
      return;
    }

    // Check for changes
    const enabledChanged = localEnabled !== (backupEnabled ?? false);
    const imeiChanged = localImei !== (backupImei ?? "");

    if (!enabledChanged && !imeiChanged) {
      toast.info(t("core_settings.imei.backup_card.toast.no_changes"));
      return;
    }

    const success = await onSave({ enabled: localEnabled, imei: localImei });
    if (success) {
      markSaved();
      toast.success(t("core_settings.imei.backup_card.toast.success"));
    } else {
      toast.error(t("core_settings.imei.backup_card.toast.error"));
    }
  };

  const handleReset = () => {
    if (backupEnabled !== null) {
      setLocalEnabled(backupEnabled);
    }
    if (backupImei !== null) {
      setLocalImei(backupImei);
    }
  };

  // Only allow digits in the input
  const handleImeiChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, 15);
    setLocalImei(value);
  };

  if (isLoading) {
    return (
      <Card className="@container/card">
        <CardHeader>
          <CardTitle>{t("core_settings.imei.backup_card.title")}</CardTitle>
          <CardDescription>
            {t("core_settings.imei.backup_card.description_loading")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div className="flex items-center gap-2">
              <Skeleton className="size-5 rounded-full" />
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-5 w-9 rounded-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-3 w-72" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-9 w-28" />
              <Skeleton className="h-9 w-9" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>{t("core_settings.imei.backup_card.title")}</CardTitle>
        <CardDescription>
          {t("core_settings.imei.backup_card.description")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4" onSubmit={handleSave}>
          <FieldSet>
            <FieldGroup>
              <div className="grid gap-2">
                <Field orientation="horizontal" className="w-fit">
                  <FieldLabel htmlFor="backup-imei-toggle">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex"
                          aria-label={t("core_settings.imei.backup_card.enable_tooltip_aria")}
                        >
                          <TbInfoCircleFilled className="size-5 text-info" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>
                          {t("core_settings.imei.backup_card.enable_tooltip_content")}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                    {t("core_settings.imei.backup_card.enable_label")}
                  </FieldLabel>
                  <Switch
                    id="backup-imei-toggle"
                    checked={localEnabled}
                    onCheckedChange={handleSwitchChange}
                    disabled={isSaving}
                  />
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor="backup-imei-input">
                  {t("core_settings.imei.backup_card.field_label")}
                </FieldLabel>
                <InputGroup>
                  <InputGroupInput
                    id="backup-imei-input"
                    placeholder={t("core_settings.imei.backup_card.field_placeholder")}
                    value={localImei}
                    onChange={handleImeiChange}
                    maxLength={15}
                    inputMode="numeric"
                    disabled={isSaving || !localEnabled}
                  />
                  <InputGroupAddon align="inline-start">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="pl-1.5 inline-flex items-center"
                          aria-label={t("core_settings.imei.backup_card.warning_aria")}
                        >
                          <AlertTriangleIcon className="text-muted-foreground size-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>
                          {t("core_settings.imei.backup_card.warning_content")}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </InputGroupAddon>
                </InputGroup>
                <FieldDescription>
                  {t("core_settings.imei.backup_card.field_description")}
                </FieldDescription>
              </Field>
            </FieldGroup>
          </FieldSet>
          <div className="flex items-center gap-x-2">
            <SaveButton
              type="submit"
              isSaving={isSaving}
              saved={saved}
              disabled={localEnabled && !isValidImei}
            />
            <Button
              type="button"
              variant="outline"
              onClick={handleReset}
              disabled={isSaving}
              aria-label={t("core_settings.imei.backup_card.reset_aria")}
            >
              <RotateCcwIcon />
            </Button>
          </div>
        </form>

        {/* Informational dialog when enabling backup IMEI */}
        <AlertDialog open={showInfoDialog} onOpenChange={setShowInfoDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {t("core_settings.imei.backup_card.enable_dialog.title")}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {t("core_settings.imei.backup_card.enable_dialog.description")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={handleInfoCancel}>
                {t("common:actions.cancel")}
              </AlertDialogCancel>
              <AlertDialogAction onClick={handleInfoConfirm}>
                {t("core_settings.imei.backup_card.enable_dialog.confirm")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
};

export default BackupIMEICard;
