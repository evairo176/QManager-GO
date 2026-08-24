"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { useTranslation, Trans } from "react-i18next";
import { authFetch } from "@/lib/auth-fetch";
import { resolveErrorMessage } from "@/lib/i18n/resolve-error";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CircleCheckIcon,
  RefreshCcwIcon,
  AlertTriangleIcon,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const CGI_ENDPOINT = "/cgi-bin/quecmanager/cellular/fplmn.sh";

const FPLMNCard = () => {
  const { t } = useTranslation("cellular");
  const [hasEntries, setHasEntries] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isClearing, setIsClearing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Fetch FPLMN status
  // ---------------------------------------------------------------------------
  const fetchStatus = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    setFetchError(null);

    try {
      const resp = await authFetch(CGI_ENDPOINT);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      const data = await resp.json();
      if (!mountedRef.current) return;

      if (data.success) {
        setHasEntries(data.has_entries);
      } else {
        setFetchError(
          resolveErrorMessage(t, undefined, data.detail, "Failed to read blocked networks")
        );
      }
    } catch {
      if (mountedRef.current) {
        setFetchError("Unable to connect to device");
      }
    } finally {
      if (mountedRef.current && !silent) {
        setIsLoading(false);
      }
    }
  }, [t]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // ---------------------------------------------------------------------------
  // Clear FPLMN list
  // ---------------------------------------------------------------------------
  const handleClear = async () => {
    setIsClearing(true);

    try {
      const resp = await authFetch(CGI_ENDPOINT, { method: "POST" });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      const data = await resp.json();
      if (!mountedRef.current) return;

      if (data.success) {
        toast.success(t("core_settings.fplmn.toast.success"));
        await fetchStatus(true);
      } else {
        toast.error(resolveErrorMessage(t, undefined, data.detail, t("core_settings.fplmn.toast.error_fallback")));
      }
    } catch {
      if (mountedRef.current) {
        toast.error(t("core_settings.fplmn.toast.error_fallback"));
      }
    } finally {
      if (mountedRef.current) {
        setIsClearing(false);
      }
    }
  };

  // ---------------------------------------------------------------------------
  // Shared card header (same across all states)
  // ---------------------------------------------------------------------------
  const cardHeader = (
    <CardHeader>
      <CardTitle>{t("core_settings.fplmn.card.title")}</CardTitle>
      <CardDescription>
        <Trans
          i18nKey="core_settings.fplmn.card.description"
          ns="cellular"
          components={{
            link: (
              <a
                href="https://onomondo.com/blog/how-to-clear-the-fplmn-list-on-a-sim/"
                target="_blank"
                rel="noreferrer"
                className="underline ml-1 text-primary hover:text-primary/80"
              />
            ),
          }}
        />
      </CardDescription>
    </CardHeader>
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  if (isLoading) {
    return (
      <Card className="@container/card">
        {cardHeader}
        <CardContent>
          <div className="flex flex-col items-center justify-center gap-4 py-8">
            <Skeleton className="h-12 w-12 rounded-xl" />
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-64" />
            <Skeleton className="h-9 w-36" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (fetchError) {
    return (
      <Card className="@container/card">
        {cardHeader}
        <CardContent>
          <Empty className="bg-destructive/5 h-full">
            <EmptyHeader>
              <EmptyMedia variant="icon" className="bg-destructive rounded-xl">
                <AlertTriangleIcon className="text-destructive-foreground size-6" />
              </EmptyMedia>
              <EmptyTitle>{t("core_settings.fplmn.states.error_title")}</EmptyTitle>
              <EmptyDescription className="max-w-xs text-pretty">
                {fetchError}
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button variant="outline" onClick={() => fetchStatus()}>
                <RefreshCcwIcon />
                {t("common:actions.retry")}
              </Button>
            </EmptyContent>
          </Empty>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="@container/card">
      {cardHeader}
      <CardContent>
        <AnimatePresence mode="wait">
          {hasEntries ? (
            <motion.div
              key="detected"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <Empty className="bg-destructive/5 h-full">
                <EmptyHeader>
                  <EmptyMedia variant="icon" className="bg-destructive rounded-xl">
                    <AlertTriangleIcon className="text-destructive-foreground size-6" />
                  </EmptyMedia>
                  <EmptyTitle>{t("core_settings.fplmn.states.found_title")}</EmptyTitle>
                  <EmptyDescription className="max-w-xs text-pretty">
                    {t("core_settings.fplmn.states.found_description")}
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button
                    variant="destructive"
                    onClick={handleClear}
                    disabled={isClearing}
                  >
                    {isClearing ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        {t("core_settings.fplmn.states.found_clearing")}
                      </>
                    ) : (
                      t("core_settings.fplmn.states.found_clear")
                    )}
                  </Button>
                </EmptyContent>
              </Empty>
            </motion.div>
          ) : (
            <motion.div
              key="clean"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <Empty className="bg-muted/30 h-full">
                <EmptyHeader>
                  <EmptyMedia variant="icon" className="bg-primary rounded-xl">
                    <CircleCheckIcon className="text-primary-foreground size-6" />
                  </EmptyMedia>
                  <EmptyTitle>{t("core_settings.fplmn.states.none_title")}</EmptyTitle>
                  <EmptyDescription className="max-w-xs text-pretty">
                    {t("core_settings.fplmn.states.none_description")}
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button variant="outline" onClick={() => fetchStatus()}>
                    <RefreshCcwIcon />
                    {t("core_settings.fplmn.states.none_refresh")}
                  </Button>
                </EmptyContent>
              </Empty>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
};

export default FPLMNCard;
