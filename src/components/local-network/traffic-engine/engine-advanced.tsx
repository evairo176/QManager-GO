"use client";

import { useTranslation } from "react-i18next";
import { toast } from "sonner";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Loader2, Trash2Icon } from "lucide-react";

interface EngineRemoveRowProps {
  isUninstalling: boolean;
  /** Removes the shared binary. Returns success. */
  onUninstall: () => Promise<boolean>;
  /** Refresh engine truth after a successful uninstall. */
  onUninstalled: () => void;
  errorMessage?: string | null;
}

/**
 * The "remove engine binary" affordance. The nfqws binary is shared by both
 * modes, so removing it affects both — the dialog says so. Rendered as a quiet
 * footer row inside the Engine Status card (only while idle), not as a card of
 * its own.
 */
export function EngineRemoveRow({
  isUninstalling,
  onUninstall,
  onUninstalled,
  errorMessage,
}: EngineRemoveRowProps) {
  const { t } = useTranslation("local-network");

  return (
    <div className="flex w-full flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">
          {t("traffic_engine.advanced_remove_title")}
        </p>
        <p className="text-xs text-muted-foreground">
          {t("traffic_engine.advanced_remove_desc")}
        </p>
      </div>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            disabled={isUninstalling}
            className="text-destructive hover:text-destructive"
          >
            {isUninstalling ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {t("traffic_engine.advanced_removing")}
              </>
            ) : (
              <>
                <Trash2Icon className="size-4" />
                {t("traffic_engine.advanced_remove_button")}
              </>
            )}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">
              {t("traffic_engine.advanced_dialog_title")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("traffic_engine.advanced_dialog_desc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t("actions.cancel", { ns: "common" })}
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                const success = await onUninstall();
                if (success) {
                  toast.success(t("traffic_engine.advanced_toast_success"));
                  onUninstalled();
                } else {
                  toast.error(
                    errorMessage || t("traffic_engine.advanced_toast_error"),
                  );
                }
              }}
            >
              {t("traffic_engine.advanced_remove_button")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
