"use client";

import { useState, useMemo } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertCircleIcon, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { TbInfoCircleFilled, TbAlertTriangleFilled } from "react-icons/tb";

import { Field, FieldGroup, FieldLabel, FieldSet } from "@/components/ui/field";

import type { FreqLockModemState } from "@/types/frequency-locking";
import type { ModemStatus } from "@/types/modem-status";
import { findAllMatchingLTEBands, type LTEBandEntry } from "@/lib/earfcn";
import { BandMatchDisplay } from "./band-match-display";

interface LteFreqLockingProps {
  modemState: FreqLockModemState | null;
  modemData: ModemStatus | null;
  isLoading: boolean;
  isLocking: boolean;
  error: string | null;
  towerLockActive: boolean;
  onLock: (earfcns: number[]) => Promise<boolean>;
  onUnlock: () => Promise<boolean>;
  onRefresh: () => void;
}

const LteFreqLockingComponent = ({
  modemState,
  modemData,
  isLoading,
  isLocking,
  error,
  towerLockActive,
  onLock,
  onUnlock,
  onRefresh,
}: LteFreqLockingProps) => {
  const { t } = useTranslation("cellular");

  // Local form state for the 2 EARFCN inputs
  const [earfcn1, setEarfcn1] = useState("");
  const [earfcn2, setEarfcn2] = useState("");

  // Confirmation dialog state
  const [showLockDialog, setShowLockDialog] = useState(false);
  const [showUnlockDialog, setShowUnlockDialog] = useState(false);
  const [showUnsupportedWarning, setShowUnsupportedWarning] = useState(false);
  const [pendingEarfcns, setPendingEarfcns] = useState<number[]>([]);

  // Seed form fields from modem state using the render-phase derived-state
  // pattern (React docs: "You Might Not Need an Effect") instead of useEffect, so
  // the sync lands in the same commit. prevLteEntries keeps it to one sync per
  // source-reference change — identical semantics to the previous
  // [modemState?.lte_entries] effect.
  const lteEntries = modemState?.lte_entries;
  const [prevLteEntries, setPrevLteEntries] = useState(lteEntries);
  if (lteEntries !== prevLteEntries) {
    setPrevLteEntries(lteEntries);
    if (lteEntries && lteEntries.length > 0) {
      setEarfcn1(String(lteEntries[0].earfcn));
      if (lteEntries[1]) {
        setEarfcn2(String(lteEntries[1].earfcn));
      }
    }
  }

  // Derive enabled state from modem state
  const isEnabled = modemState?.lte_locked ?? false;
  const isDisabled = towerLockActive || isLocking;

  // Band matching for display
  const matchedBands1 = useMemo((): LTEBandEntry[] => {
    const val = parseInt(earfcn1, 10);
    return isNaN(val) ? [] : findAllMatchingLTEBands(val);
  }, [earfcn1]);

  const matchedBands2 = useMemo((): LTEBandEntry[] => {
    const val = parseInt(earfcn2, 10);
    return isNaN(val) ? [] : findAllMatchingLTEBands(val);
  }, [earfcn2]);

  // Parse supported bands from modem data
  const supportedBands = useMemo((): number[] => {
    const raw = modemData?.device?.supported_lte_bands;
    if (!raw) return [];
    return raw
      .split(":")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n));
  }, [modemData?.device?.supported_lte_bands]);

  // Build earfcns array from form inputs
  const buildEarfcns = (): number[] => {
    const earfcns: number[] = [];
    const e1 = parseInt(earfcn1, 10);
    if (!isNaN(e1)) earfcns.push(e1);
    const e2 = parseInt(earfcn2, 10);
    if (!isNaN(e2)) earfcns.push(e2);
    return earfcns;
  };

  const handleToggle = (checked: boolean) => {
    if (checked) {
      const earfcns = buildEarfcns();
      if (earfcns.length === 0) {
        toast.warning(t("cell_locking.frequency_locking.lte.toast.no_frequencies_title"), {
          description: t("cell_locking.frequency_locking.lte.toast.no_frequencies_description"),
        });
        return;
      }

      // Check if any matched band is in supported bands
      const allMatched = [...matchedBands1, ...matchedBands2];
      const anySupported =
        allMatched.length === 0 ||
        allMatched.some((b) => supportedBands.includes(b.band));

      setPendingEarfcns(earfcns);

      if (!anySupported && supportedBands.length > 0) {
        // No matched band is supported — show stern warning
        setShowUnsupportedWarning(true);
      } else {
        // Normal confirmation
        setShowLockDialog(true);
      }
    } else {
      setShowUnlockDialog(true);
    }
  };

  const confirmLock = async () => {
    setShowLockDialog(false);
    setShowUnsupportedWarning(false);
    const success = await onLock(pendingEarfcns);
    if (success) {
      toast.success(t("cell_locking.frequency_locking.lte.toast.lock_success"));
    } else {
      toast.error(t("cell_locking.frequency_locking.lte.toast.lock_error"));
    }
  };

  const confirmUnlock = async () => {
    setShowUnlockDialog(false);
    const success = await onUnlock();
    if (success) {
      toast.success(t("cell_locking.frequency_locking.lte.toast.unlock_success"));
    } else {
      toast.error(t("cell_locking.frequency_locking.lte.toast.unlock_error"));
    }
  };

  // "Use Current" — copy active PCell EARFCN into slot 1
  const handleUseCurrent = () => {
    const earfcn = modemData?.lte?.earfcn;
    if (earfcn != null) {
      setEarfcn1(String(earfcn));
      toast.info(t("cell_locking.frequency_locking.lte.toast.filled_current"));
    } else {
      toast.warning(t("cell_locking.frequency_locking.lte.toast.no_active_connection"));
    }
  };

  const hasActiveLteCell = modemData?.lte?.earfcn != null;

  if (isLoading) {
    return (
      <Card className="@container/card">
        <CardHeader>
          <CardTitle>{t("cell_locking.frequency_locking.lte.title")}</CardTitle>
          <CardDescription>
            {t("cell_locking.frequency_locking.lte.description_loading")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2">
            <Separator />
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-44" />
              <Skeleton className="h-5 w-20" />
            </div>
            <Separator />
            <div className="grid gap-4 mt-6">
              <Skeleton className="h-9 w-full rounded-md" />
              <Skeleton className="h-9 w-full rounded-md" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // --- Error state (fetch failed, no data) ----------------------------------
  if (error && !modemState) {
    return (
      <Card className="@container/card">
        <CardHeader>
          <CardTitle>{t("cell_locking.frequency_locking.lte.title")}</CardTitle>
          <CardDescription>
            {t("cell_locking.frequency_locking.lte.description_loading")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            role="alert"
            className="flex flex-col items-center gap-3 py-8 text-center"
          >
            <AlertCircleIcon className="size-8 text-destructive" />
            <div className="space-y-1">
              <p className="text-sm font-medium">
                {t("cell_locking.frequency_locking.lte.error_title")}
              </p>
              <p className="text-xs text-muted-foreground">{error}</p>
            </div>
            <Button variant="outline" size="sm" onClick={onRefresh}>
              {t("actions.retry", { ns: "common" })}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card
        className="@container/card"
        aria-disabled={towerLockActive || undefined}
      >
        <CardHeader>
          <CardTitle>{t("cell_locking.frequency_locking.lte.title")}</CardTitle>
          <CardDescription>
            {t("cell_locking.frequency_locking.lte.description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2">
            {/* Tower lock active warning */}
            {towerLockActive ? (
              <div className="flex items-start gap-2 p-2 rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-sm">
                <TbAlertTriangleFilled className="size-5 mt-0.5 shrink-0" />
                <p className="font-semibold">
                  {t("cell_locking.frequency_locking.lte.tower_lock_active")}
                </p>
              </div>
            ) : (
              <div className="flex items-start gap-2 p-2 rounded-md bg-warning/10 border border-warning/30 text-warning text-sm">
                <TbAlertTriangleFilled className="size-5 mt-0.5 shrink-0" />
                <p className="font-semibold">
                  {t("cell_locking.frequency_locking.lte.experimental_warning")}
                </p>
              </div>
            )}

            <Separator />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex"
                      aria-label={t("cell_locking.frequency_locking.lte.enabled_info_aria")}
                    >
                      <TbInfoCircleFilled className="size-5 text-info" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      {t("cell_locking.frequency_locking.lte.enabled_tooltip")}
                    </p>
                  </TooltipContent>
                </Tooltip>
                <p className="font-semibold text-muted-foreground text-sm">
                  {t("cell_locking.frequency_locking.lte.enabled_label")}
                </p>
              </div>
              <div className="flex items-center space-x-2">
                {isLocking ? (
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                ) : null}
                <Switch
                  id="lte-freq-locking"
                  checked={isEnabled}
                  onCheckedChange={handleToggle}
                  disabled={isDisabled}
                />
                <Label htmlFor="lte-freq-locking">
                  {isEnabled
                    ? t("state.enabled", { ns: "common" })
                    : t("state.disabled", { ns: "common" })}
                </Label>
              </div>
            </div>
            <Separator />

            <form
              className="grid gap-4 mt-6"
              onSubmit={(e) => e.preventDefault()}
            >
              <div className="w-full">
                <FieldSet>
                  <FieldGroup>
                    {/* EARFCN 1 */}
                    <Field>
                      <div className="flex items-center justify-between">
                        <FieldLabel htmlFor="freq-earfcn1">
                          {t("cell_locking.frequency_locking.lte.channel_label")}
                        </FieldLabel>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleUseCurrent}
                          disabled={isDisabled || !hasActiveLteCell}
                        >
                          {t("cell_locking.frequency_locking.lte.use_current")}
                        </Button>
                      </div>
                      <Input
                        id="freq-earfcn1"
                        type="text"
                        placeholder={t("cell_locking.frequency_locking.lte.channel_placeholder")}
                        value={earfcn1}
                        onChange={(e) => setEarfcn1(e.target.value)}
                        disabled={isDisabled}
                      />
                      <BandMatchDisplay
                        bands={matchedBands1}
                        hasInput={earfcn1.length > 0}
                        supportedBands={supportedBands}
                        prefix="B"
                        noMatchLabelKey="this_channel"
                      />
                    </Field>

                    {/* EARFCN 2 */}
                    <Field>
                      <FieldLabel htmlFor="freq-earfcn2">
                        {t("cell_locking.frequency_locking.lte.channel_label_optional")}
                      </FieldLabel>
                      <Input
                        id="freq-earfcn2"
                        type="text"
                        placeholder={t("cell_locking.frequency_locking.lte.channel_placeholder_2")}
                        value={earfcn2}
                        onChange={(e) => setEarfcn2(e.target.value)}
                        disabled={isDisabled}
                      />
                      <BandMatchDisplay
                        bands={matchedBands2}
                        hasInput={earfcn2.length > 0}
                        supportedBands={supportedBands}
                        prefix="B"
                        noMatchLabelKey="this_channel"
                      />
                    </Field>
                  </FieldGroup>
                </FieldSet>
              </div>
            </form>
          </div>
        </CardContent>
      </Card>

      {/* Normal lock confirmation dialog */}
      <AlertDialog open={showLockDialog} onOpenChange={setShowLockDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("cell_locking.frequency_locking.lte.lock_dialog.title")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingEarfcns.length === 1
                ? t("cell_locking.frequency_locking.lte.lock_dialog.description_single", { earfcn: pendingEarfcns[0] })
                : t("cell_locking.frequency_locking.lte.lock_dialog.description_multi", { earfcns: pendingEarfcns.join(", ") })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t("actions.cancel", { ns: "common" })}
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmLock}>
              {t("cell_locking.frequency_locking.lte.lock_dialog.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unsupported band warning dialog */}
      <AlertDialog
        open={showUnsupportedWarning}
        onOpenChange={setShowUnsupportedWarning}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">
              {t("cell_locking.frequency_locking.lte.unsupported_dialog.title")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("cell_locking.frequency_locking.lte.unsupported_dialog.description_prefix")}
              <br />
              <br />
              <strong>{t("cell_locking.frequency_locking.lte.unsupported_dialog.matched_bands_label")}</strong>{" "}
              {[...matchedBands1, ...matchedBands2]
                .map((b) => `B${b.band}`)
                .join(", ") || t("cell_locking.frequency_locking.lte.unsupported_dialog.unknown")}
              <br />
              <strong>{t("cell_locking.frequency_locking.lte.unsupported_dialog.supported_bands_label")}</strong>{" "}
              {supportedBands.map((b) => `B${b}`).join(", ")}
              <br />
              <br />
              {t("cell_locking.frequency_locking.lte.unsupported_dialog.confirm_prompt")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t("actions.cancel", { ns: "common" })}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmLock}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("cell_locking.frequency_locking.lte.unsupported_dialog.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unlock confirmation dialog */}
      <AlertDialog open={showUnlockDialog} onOpenChange={setShowUnlockDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("cell_locking.frequency_locking.lte.unlock_dialog.title")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("cell_locking.frequency_locking.lte.unlock_dialog.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t("actions.cancel", { ns: "common" })}
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmUnlock}>
              {t("cell_locking.frequency_locking.lte.unlock_dialog.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default LteFreqLockingComponent;
