"use client";

import * as React from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { LanguagesIcon, TriangleAlertIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguagePacks } from "@/hooks/use-language-packs";
import { resolveErrorMessage } from "@/lib/i18n/resolve-error";
import { buildCatalogView } from "@/lib/i18n/language-pack-manifest";
import { AVAILABLE_LANGUAGES } from "@/lib/i18n/available-languages";
import { persistLanguage } from "@/lib/i18n/config";
import { LanguagePackRow } from "./language-pack-row";
import type { LanguageCode } from "@/types/i18n";

export function LanguagePackCard() {
  const { t, i18n } = useTranslation("system-settings");
  const {
    list,
    isLoading,
    listError,
    install,
    startInstall,
    cancelInstall,
    remove,
    refetch,
  } = useLanguagePacks();

  const catalogView = React.useMemo(() => {
    return buildCatalogView({
      catalog: AVAILABLE_LANGUAGES,
      installed: list?.installed ?? [],
      manifest: list?.manifest ?? null,
    });
  }, [list]);

  const activeCode = i18n.language as LanguageCode;

  const handleSelectActive = React.useCallback(
    (code: LanguageCode) => {
      if (code === activeCode) return;
      i18n.changeLanguage(code);
      persistLanguage(code);
      if (typeof document !== "undefined") {
        const meta = AVAILABLE_LANGUAGES.find((e) => e.code === code);
        document.documentElement.lang = code;
        document.documentElement.dir = meta?.rtl ? "rtl" : "ltr";
      }
      const englishName =
        AVAILABLE_LANGUAGES.find((e) => e.code === code)?.english_name ?? code;
      toast.success(t("languages.toast.switched", { name: englishName, code }));
    },
    [activeCode, i18n, t],
  );

  const handleInstall = React.useCallback(
    async (code: LanguageCode) => {
      const englishName =
        list?.manifest?.packs.find((p) => p.code === code)?.english_name ??
        AVAILABLE_LANGUAGES.find((e) => e.code === code)?.english_name ??
        code;
      toast.info(t("languages.toast.install_started", { name: englishName, code }));
      const res = await startInstall(code);
      if (!res.ok) {
        toast.error(
          resolveErrorMessage(
            t,
            res.error,
            undefined,
            t("languages.toast.install_failed", { name: englishName, code }),
          ),
        );
      }
    },
    [list, startInstall, t],
  );

  // React to install completion toasts.
  const prevStateRef = React.useRef(install.state);
  React.useEffect(() => {
    const prev = prevStateRef.current;
    prevStateRef.current = install.state;
    if (prev === "running" && install.state === "success" && install.code) {
      const englishName =
        list?.manifest?.packs.find((p) => p.code === install.code)?.english_name ??
        AVAILABLE_LANGUAGES.find((e) => e.code === install.code)?.english_name ??
        install.code;
      toast.success(
        t("languages.toast.install_success", { name: englishName, code: install.code }),
      );
    } else if (prev === "running" && install.state === "cancelled") {
      toast.info(t("languages.toast.install_cancelled"));
    }
  }, [install.state, install.code, list, t]);

  const handleRemove = React.useCallback(
    async (code: LanguageCode, isActive: boolean) => {
      const englishName =
        AVAILABLE_LANGUAGES.find((e) => e.code === code)?.english_name ??
        list?.manifest?.packs.find((p) => p.code === code)?.english_name ??
        code;
      if (isActive) {
        // Switch to English BEFORE removing, to avoid i18next resolving the
        // freshly-deleted pack.
        i18n.changeLanguage("en");
        persistLanguage("en");
        if (typeof document !== "undefined") {
          document.documentElement.lang = "en";
          document.documentElement.dir = "ltr";
        }
      }
      const res = await remove(code);
      if (!res.ok) {
        toast.error(t("languages.toast.remove_failed", { name: englishName, code }));
        return;
      }
      if (isActive) {
        toast.success(
          t("languages.toast.remove_active_switched", { name: englishName, code }),
        );
      } else {
        toast.success(t("languages.toast.remove_success", { name: englishName, code }));
      }
    },
    [i18n, remove, list, t],
  );

  return (
    <div className="@container/main mx-auto p-2">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">{t("languages.page.title")}</h1>
        <p className="text-muted-foreground">{t("languages.page.description")}</p>
      </div>

      <div className="grid grid-cols-1 @3xl/main:grid-cols-2 grid-flow-row gap-4">
        {/* Active & Installed section */}
        <Card className="@container/card">
          <CardHeader>
            <CardTitle>{t("languages.sections.installed_title")}</CardTitle>
            <CardDescription>{t("languages.sections.installed_description")}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {catalogView.builtIn.map((row) => {
              if (row.status !== "built_in") return null;
              return (
                <LanguagePackRow
                  key={row.entry.code}
                  variant={{ kind: "built_in", entry: row.entry, isActive: row.entry.code === activeCode }}
                  installState={install}
                  onInstall={handleInstall}
                  onCancelInstall={cancelInstall}
                  onRemove={handleRemove}
                  onSelectActive={handleSelectActive}
                />
              );
            })}
            {catalogView.downloaded.map((row) => {
              if (row.status !== "downloaded") return null;
              return (
                <LanguagePackRow
                  key={row.entry.code}
                  variant={{
                    kind: "downloaded",
                    entry: row.entry,
                    isActive: row.entry.code === activeCode,
                    version: row.version,
                    updateAvailableVersion: row.updateAvailableVersion,
                    manifestEntry: row.manifestEntry,
                  }}
                  installState={install}
                  onInstall={handleInstall}
                  onCancelInstall={cancelInstall}
                  onRemove={handleRemove}
                  onSelectActive={handleSelectActive}
                />
              );
            })}
          </CardContent>
        </Card>

        {/* Available section */}
        <Card className="@container/card">
          <CardHeader>
            <CardTitle>{t("languages.sections.available_title")}</CardTitle>
            <CardDescription>{t("languages.sections.available_description")}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {isLoading ? (
              <>
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="flex flex-col gap-3 rounded-md border p-4"
                    aria-hidden
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-col gap-2">
                        <Skeleton className="h-5 w-40" />
                        <Skeleton className="h-4 w-20" />
                      </div>
                      <Skeleton className="h-8 w-24" />
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <Skeleton className="h-8 w-full" />
                      <Skeleton className="h-8 w-full" />
                      <Skeleton className="h-8 w-full" />
                      <Skeleton className="h-8 w-full" />
                    </div>
                  </div>
                ))}
                <span className="sr-only" role="status">
                  {t("languages.sections.available_loading")}
                </span>
              </>
            ) : listError || list?.manifest_error ? (
              <AnimatePresence initial={false}>
                <motion.div
                  key="manifest-error"
                  initial={{ opacity: 0, y: -6, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: "auto" }}
                  exit={{ opacity: 0, y: -6, height: 0 }}
                  transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <Alert variant="destructive">
                    <TriangleAlertIcon />
                    <AlertTitle>{t("languages.manifest_error.title")}</AlertTitle>
                    <AlertDescription>
                      <p>{t("languages.manifest_error.description")}</p>
                      <Button size="sm" variant="outline" onClick={() => refetch()}>
                        {t("languages.manifest_error.retry_button")}
                      </Button>
                    </AlertDescription>
                  </Alert>
                </motion.div>
              </AnimatePresence>
            ) : catalogView.available.length === 0 ? (
              <Empty className="border-none">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <LanguagesIcon />
                  </EmptyMedia>
                  <EmptyTitle>{t("languages.sections.available_empty_title")}</EmptyTitle>
                  <EmptyDescription>
                    {t("languages.sections.available_empty_description")}
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              catalogView.available.map((row) => {
                if (row.status !== "available") return null;
                return (
                  <LanguagePackRow
                    key={row.manifestEntry.code}
                    variant={{ kind: "available", manifestEntry: row.manifestEntry }}
                    installState={install}
                    onInstall={handleInstall}
                    onCancelInstall={cancelInstall}
                    onRemove={handleRemove}
                    onSelectActive={handleSelectActive}
                  />
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
