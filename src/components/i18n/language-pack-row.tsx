"use client";

import * as React from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2Icon, DownloadIcon, Loader2Icon, RefreshCwIcon, Trash2Icon, TriangleAlertIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CopyableCommand } from "@/components/ui/copyable-command";
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
import type { LanguageCode, LanguageMeta, LanguagePackInstallState, RemoteManifestEntry } from "@/types/i18n";

export type LanguagePackRowVariant =
  | { kind: "built_in"; entry: LanguageMeta; isActive: boolean }
  | { kind: "downloaded"; entry: LanguageMeta; isActive: boolean; version: string; updateAvailableVersion?: string; manifestEntry?: RemoteManifestEntry }
  | { kind: "available"; manifestEntry: RemoteManifestEntry };

interface LanguagePackRowProps {
  variant: LanguagePackRowVariant;
  installState: LanguagePackInstallState;
  onInstall: (code: LanguageCode) => Promise<void>;
  onCancelInstall: () => Promise<void>;
  onRemove: (code: LanguageCode, isActive: boolean) => Promise<void>;
  onSelectActive: (code: LanguageCode) => void;
}

function formatSize(bytes: number, t: (key: string, opts?: Record<string, unknown>) => string): string {
  if (bytes <= 0) return t("languages.row.size_unit_kb", { kb: 0 });
  if (bytes < 1024 * 1024) {
    return t("languages.row.size_unit_kb", { kb: Math.max(1, Math.round(bytes / 1024)) });
  }
  return t("languages.row.size_unit_mb", { mb: (bytes / (1024 * 1024)).toFixed(1) });
}

export function LanguagePackRow({
  variant,
  installState,
  onInstall,
  onCancelInstall,
  onRemove,
  onSelectActive,
}: LanguagePackRowProps) {
  const { t } = useTranslation("system-settings");
  const [removeOpen, setRemoveOpen] = React.useState(false);
  const [removing, setRemoving] = React.useState(false);

  const code =
    variant.kind === "available" ? variant.manifestEntry.code : variant.entry.code;
  const nativeName =
    variant.kind === "available"
      ? variant.manifestEntry.native_name
      : variant.entry.native_name;
  const englishName =
    variant.kind === "available"
      ? variant.manifestEntry.english_name
      : variant.entry.english_name;

  const isThisInstalling = installState.state === "running" && installState.code === code;
  // Derived: startInstall flips state to "running" synchronously, so this
  // resets to false on retry without a useEffect.
  const installFailed = installState.state === "failed" && installState.code === code;

  const manifestEntry =
    variant.kind === "available"
      ? variant.manifestEntry
      : variant.kind === "downloaded"
        ? variant.manifestEntry
        : undefined;

  const handleInstallClick = async () => {
    await onInstall(code);
  };

  const handleRemoveClick = async () => {
    setRemoving(true);
    try {
      const isActive = variant.kind === "downloaded" && variant.isActive;
      await onRemove(code, isActive);
    } finally {
      setRemoving(false);
      setRemoveOpen(false);
    }
  };

  const isActive =
    (variant.kind === "built_in" || variant.kind === "downloaded") && variant.isActive;

  return (
    <div
      className="flex flex-col gap-3 rounded-md border p-4"
      aria-current={isActive || undefined}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-base font-medium break-words">{nativeName}</span>
            <span className="text-xs text-muted-foreground break-words">({englishName})</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {variant.kind === "built_in" && (
              <Badge variant="outline" className="bg-muted/50 text-muted-foreground border-muted-foreground/30">
                {t("languages.badges.built_in")}
              </Badge>
            )}
            {variant.kind === "downloaded" && variant.updateAvailableVersion && (
              <Badge variant="outline" className="bg-warning/15 text-warning hover:bg-warning/20 border-warning/30">
                {t("languages.badges.update_available")}
              </Badge>
            )}
            {isActive && (
              <Badge variant="outline" className="bg-success/15 text-success hover:bg-success/20 border-success/30">
                <CheckCircle2Icon className="size-3" />
                {t("languages.badges.active")}
              </Badge>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {(variant.kind === "built_in" || variant.kind === "downloaded") && !isActive && (
            <Button
              size="sm"
              onClick={() => onSelectActive(code)}
              aria-label={t("languages.row.activate_button_aria", { name: englishName })}
            >
              {t("languages.row.activate_button")}
            </Button>
          )}

          {variant.kind === "available" && (
            <Button
              size="sm"
              onClick={handleInstallClick}
              disabled={isThisInstalling}
              aria-busy={isThisInstalling}
              aria-label={t("languages.row.install_button_aria", { name: englishName })}
            >
              {isThisInstalling ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : (
                <DownloadIcon className="size-4" />
              )}
              {isThisInstalling
                ? t("languages.row.install_button_progress")
                : t("languages.row.install_button")}
            </Button>
          )}

          {variant.kind === "downloaded" && variant.updateAvailableVersion && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleInstallClick}
              disabled={isThisInstalling}
              aria-busy={isThisInstalling}
              aria-label={t("languages.row.update_button_aria", { name: englishName })}
            >
              {isThisInstalling ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : (
                <RefreshCwIcon className="size-4" />
              )}
            </Button>
          )}

          {variant.kind === "downloaded" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setRemoveOpen(true)}
              aria-label={t("languages.row.remove_button_aria", { name: englishName })}
            >
              <Trash2Icon className="size-4" />
            </Button>
          )}

          {isThisInstalling && (
            <Button size="sm" variant="ghost" onClick={() => onCancelInstall()}>
              {t("languages.row.cancel_install_button")}
            </Button>
          )}
        </div>
      </div>

      {manifestEntry && (
        <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          <div>
            <div className="text-muted-foreground">{t("languages.row.completeness_label")}</div>
            <div className="text-foreground">
              {t("languages.row.completeness_value", { percent: Math.floor(manifestEntry.completeness * 100) })}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">{t("languages.row.size_label")}</div>
            <div className="text-foreground">{formatSize(manifestEntry.size_bytes, t)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">{t("languages.row.version_label")}</div>
            <div className="font-mono text-foreground">{manifestEntry.version}</div>
          </div>
          <div className="min-w-0">
            <div className="text-muted-foreground">
              {manifestEntry.contributors && manifestEntry.contributors.length > 1
                ? t("languages.row.translator_label_plural")
                : t("languages.row.translator_label")}
            </div>
            <div className="truncate text-foreground">
              {manifestEntry.contributors && manifestEntry.contributors.length > 0
                ? manifestEntry.contributors.join(", ")
                : t("languages.row.translators_fallback")}
            </div>
          </div>
        </div>
      )}

      {isThisInstalling && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2Icon className="size-3 animate-spin" />
          <span>
            {installState.step
              ? t(`languages.install_steps.${installState.step}`, {
                  defaultValue: installState.message ?? "",
                })
              : installState.message}
          </span>
        </div>
      )}

      {/* manifestEntry guard: built-in packs can't fail install (they don't run install). */}
      <AnimatePresence initial={false}>
        {installFailed && manifestEntry && (
          <motion.div
            key="install-failure"
            initial={{ opacity: 0, y: -6, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -6, height: 0 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <Alert variant="destructive">
              <TriangleAlertIcon />
              <AlertTitle>{t("languages.install_failure_fallback.title")}</AlertTitle>
              <AlertDescription>
                <p>{t("languages.install_failure_fallback.description")}</p>
                <CopyableCommand
                  command={t("languages.install_failure_fallback.command_template", {
                    code,
                    url: manifestEntry.url,
                    sha256: manifestEntry.sha256,
                    version: manifestEntry.version,
                  })}
                />
              </AlertDescription>
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>

      <AlertDialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("languages.remove_dialog.title")}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              {variant.kind === "downloaded" && variant.isActive ? (
                <p>{t("languages.remove_dialog.description_active", { name: englishName })}</p>
              ) : (
                <p>{t("languages.remove_dialog.description", { name: englishName })}</p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing}>
              {t("languages.remove_dialog.cancel_button")}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveClick} disabled={removing}>
              {removing ? <Loader2Icon className="size-4 animate-spin" /> : null}
              {t("languages.remove_dialog.confirm_button")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
