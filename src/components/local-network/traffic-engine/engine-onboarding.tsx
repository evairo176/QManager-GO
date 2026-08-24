"use client";

import { useTranslation, Trans } from "react-i18next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Loader2, PackageIcon, RefreshCcwIcon } from "lucide-react";
import type { InstallResult } from "@/types/video-optimizer";
import { ResultAlert } from "./result-alert";

interface EngineOnboardingProps {
  installResult: InstallResult;
  onInstall: () => void;
  onRefresh: () => void;
}

/**
 * Shared not-installed state. One install of the nfqws engine unlocks BOTH
 * modes, so this single card replaces the two separate "package missing" panels
 * the old features each carried.
 */
export function EngineOnboarding({
  installResult,
  onInstall,
  onRefresh,
}: EngineOnboardingProps) {
  const { t } = useTranslation("local-network");
  const installing = installResult.status === "running";

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("traffic_engine.onboarding_title")}</CardTitle>
        <CardDescription>
          {t("traffic_engine.onboarding_description")}
        </CardDescription>
      </CardHeader>
      <CardContent aria-live="polite">
        <div className="mx-auto flex max-w-md flex-col items-center gap-5 py-8 text-center">
          <div className="flex size-14 items-center justify-center rounded-xl border bg-muted/40">
            <PackageIcon className="size-7 text-muted-foreground" />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">
              {t("traffic_engine.onboarding_unlocks")}
            </p>
            <p className="text-xs text-muted-foreground">
              <Trans
                i18nKey="traffic_engine.onboarding_zapret_attribution"
                ns="local-network"
                components={{
                  link: (
                    <a
                      href="https://github.com/bol-van/zapret"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline underline-offset-2"
                    />
                  ),
                }}
              />
            </p>
          </div>

          {installResult.status === "complete" && (
            <ResultAlert tone="success" className="text-left">
              {installResult.message}
              {installResult.detail && (
                <span className="text-muted-foreground">
                  {" "}
                  ({installResult.detail})
                </span>
              )}
            </ResultAlert>
          )}

          {installResult.status === "error" && (
            <ResultAlert tone="destructive" className="text-left">
              {installResult.message}
              {installResult.detail && (
                <span className="mt-1 block text-xs opacity-80">
                  {installResult.detail}
                </span>
              )}
            </ResultAlert>
          )}

          <div className="flex items-center gap-2">
            <Button onClick={onInstall} disabled={installing}>
              {installing ? (
                <>
                  <Loader2 className="animate-spin" />
                  {installResult.message ||
                    t("traffic_engine.onboarding_installing")}
                </>
              ) : (
                <>
                  <Download />
                  {t("traffic_engine.onboarding_install")}
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={installing}
            >
              <RefreshCcwIcon className="size-3.5" />
              {t("traffic_engine.onboarding_check_again")}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
