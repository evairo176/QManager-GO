"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2Icon } from "lucide-react";
import { useTranslation } from "react-i18next";

export interface RestorePasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (passphrase: string) => Promise<void>;
  incorrect?: boolean;
}

export function RestorePasswordDialog({
  open,
  onOpenChange,
  onSubmit,
  incorrect,
}: RestorePasswordDialogProps) {
  const { t } = useTranslation("system-settings");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setPw("");
      setBusy(false);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await onSubmit(pw);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t("config_backup.password_dialog.title")}</DialogTitle>
            <DialogDescription>
              {t("config_backup.password_dialog.description")}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-4">
            <Label htmlFor="restore-pw">{t("config_backup.password_dialog.label")}</Label>
            <Input
              id="restore-pw"
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              autoFocus
              autoComplete="current-password"
            />
            {incorrect && (
              <p className="text-xs text-destructive">
                {t("config_backup.password_dialog.error_incorrect")}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t("config_backup.restore.cancel_button")}
            </Button>
            <Button type="submit" disabled={busy || pw.length === 0}>
              {busy && <Loader2Icon className="size-4 animate-spin" />}
              {busy ? t("config_backup.password_dialog.button_decrypting") : t("config_backup.password_dialog.button_decrypt")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
