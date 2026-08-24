"use client";

import { useState, useMemo, useCallback } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

import type {
  FreqLockModemState,
  NrFreqLockEntry,
} from "@/types/frequency-locking";
import type { ModemStatus } from "@/types/modem-status";
import {
  findAllMatchingNRBands,
  suggestNRSCS,
  type NRBandEntry,
} from "@/lib/earfcn";
import { SCS_OPTIONS } from "@/types/tower-locking";
import { BandMatchDisplay } from "./band-match-display";

// =============================================================================
// Slot state — one entry per NR-ARFCN + SCS pair
// =============================================================================

interface SlotState {
  arfcn: string;
  scs: string;
  scsManual: boolean;
}

const EMPTY_SLOT: SlotState = { arfcn: "", scs: "", scsManual: false };
const NUM_SLOTS = 4;
const INITIAL_SLOTS: SlotState[] = Array.from({ length: NUM_SLOTS }, () => ({
  ...EMPTY_SLOT,
}));

// =============================================================================
// NrFreqLockingComponent
// =============================================================================

interface NrFreqLockingProps {
  modemState: FreqLockModemState | null;
  modemData: ModemStatus | null;
  isLoading: boolean;
  isLocking: boolean;
  error: string | null;
  towerLockActive: boolean;
  onLock: (entries: NrFreqLockEntry[]) => Promise<boolean>;
  onUnlock: () => Promise<boolean>;
  onRefresh: () => void;
}

const NrFreqLockingComponent = ({
  modemState,
  modemData,
  isLoading,
  isLocking,
  error,
  towerLockActive,
  onLock,
  onUnlock,
  onRefresh,
}: NrFreqLockingProps) => {
  const { t } = useTranslation("cellular");

  // --- Array-based slot state ------------------------------------------------
  const [slots, setSlots] = useState<SlotState[]>(INITIAL_SLOTS);

  // Confirmation dialog state
  const [showLockDialog, setShowLockDialog] = useState(false);
  const [showUnlockDialog, setShowUnlockDialog] = useState(false);
  const [showUnsupportedWarning, setShowUnsupportedWarning] = useState(false);
  const [pendingEntries, setPendingEntries] = useState<NrFreqLockEntry[]>([]);

  // Seed slot state from modem state using the render-phase derived-state pattern
  // (React docs: "You Might Not Need an Effect") instead of useEffect, so the sync
  // lands in the same commit. prevNrEntries keeps it to one sync per
  // source-reference change — identical semantics to the previous
  // [modemState?.nr_entries] effect.
  const nrEntries = modemState?.nr_entries;
  const [prevNrEntries, setPrevNrEntries] = useState(nrEntries);
  if (nrEntries !== prevNrEntries) {
    setPrevNrEntries(nrEntries);
    if (nrEntries && nrEntries.length > 0) {
      setSlots((prev) =>
        prev.map((s, i) => {
          const entry = nrEntries[i];
          if (!entry) return s;
          return {
            arfcn: String(entry.arfcn),
            scs: String(entry.scs),
            scsManual: true,
          };
        }),
      );
    }
  }

  // --- Slot update helpers ---------------------------------------------------
  const updateSlotArfcn = useCallback((index: number, arfcn: string) => {
    setSlots((prev) =>
      prev.map((s, i) => {
        if (i !== index) return s;
        const updated: SlotState = { ...s, arfcn, scsManual: false };
        // Auto-detect SCS from band match
        const val = parseInt(arfcn, 10);
        if (!isNaN(val)) {
          const bands = findAllMatchingNRBands(val);
          if (bands.length > 0) {
            updated.scs = String(suggestNRSCS(bands[0]));
          }
        }
        return updated;
      }),
    );
  }, []);

  const updateSlotScs = useCallback((index: number, scs: string) => {
    setSlots((prev) =>
      prev.map((s, i) =>
        i === index ? { ...s, scs, scsManual: true } : s,
      ),
    );
  }, []);

  // --- Derived state ---------------------------------------------------------
  const isEnabled = modemState?.nr_locked ?? false;
  const isDisabled = towerLockActive || isLocking;

  // Band matching per slot (recomputes when any arfcn changes)
  const matchedBandsPerSlot = useMemo(
    (): NRBandEntry[][] =>
      slots.map((s) => {
        const val = parseInt(s.arfcn, 10);
        return isNaN(val) ? [] : findAllMatchingNRBands(val);
      }),
    [slots],
  );

  // Parse supported NR bands from modem data (combine SA + NSA)
  const supportedBands = useMemo((): number[] => {
    const sa = modemData?.device?.supported_sa_nr5g_bands ?? "";
    const nsa = modemData?.device?.supported_nsa_nr5g_bands ?? "";
    const combined = `${sa}:${nsa}`;
    const bands = combined
      .split(":")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n));
    return [...new Set(bands)];
  }, [
    modemData?.device?.supported_sa_nr5g_bands,
    modemData?.device?.supported_nsa_nr5g_bands,
  ]);

  // Build entries array from slot state
  const buildEntries = (): NrFreqLockEntry[] => {
    const entries: NrFreqLockEntry[] = [];
    for (const slot of slots) {
      const a = parseInt(slot.arfcn, 10);
      const s = parseInt(slot.scs, 10);
      if (!isNaN(a) && !isNaN(s)) {
        entries.push({ arfcn: a, scs: s });
      }
    }
    return entries;
  };

  // --- Handlers --------------------------------------------------------------
  const handleToggle = (checked: boolean) => {
    if (checked) {
      const entries = buildEntries();
      if (entries.length === 0) {
        toast.warning(t("cell_locking.frequency_locking.nr.toast.no_frequencies_title"), {
          description: t("cell_locking.frequency_locking.nr.toast.no_frequencies_description"),
        });
        return;
      }

      // Validate SCS is set for all slots with an ARFCN
      for (const slot of slots) {
        const a = parseInt(slot.arfcn, 10);
        if (!isNaN(a) && (slot.scs === "" || isNaN(parseInt(slot.scs, 10)))) {
          toast.warning(t("cell_locking.frequency_locking.nr.toast.missing_scs_title"), {
            description: t("cell_locking.frequency_locking.nr.toast.missing_scs_description"),
          });
          return;
        }
      }

      // Check band support
      const allMatched = matchedBandsPerSlot.flat();
      const anySupported =
        allMatched.length === 0 ||
        allMatched.some((b) => supportedBands.includes(b.band));

      setPendingEntries(entries);

      if (!anySupported && supportedBands.length > 0) {
        setShowUnsupportedWarning(true);
      } else {
        setShowLockDialog(true);
      }
    } else {
      setShowUnlockDialog(true);
    }
  };

  const confirmLock = async () => {
    setShowLockDialog(false);
    setShowUnsupportedWarning(false);
    const success = await onLock(pendingEntries);
    if (success) {
      toast.success(t("cell_locking.frequency_locking.nr.toast.lock_success"));
    } else {
      toast.error(t("cell_locking.frequency_locking.nr.toast.lock_error"));
    }
  };

  const confirmUnlock = async () => {
    setShowUnlockDialog(false);
    const success = await onUnlock();
    if (success) {
      toast.success(t("cell_locking.frequency_locking.nr.toast.unlock_success"));
    } else {
      toast.error(t("cell_locking.frequency_locking.nr.toast.unlock_error"));
    }
  };

  // "Use Current" — copy active NR PCell into slot 1
  const handleUseCurrent = () => {
    const nrArfcn = modemData?.nr?.arfcn;
    const nrScs = modemData?.nr?.scs;
    if (nrArfcn != null) {
      if (nrScs != null) {
        // Use modem's actual SCS — bypass auto-detection
        setSlots((prev) =>
          prev.map((s, i) =>
            i === 0
              ? { arfcn: String(nrArfcn), scs: String(nrScs), scsManual: true }
              : s,
          ),
        );
      } else {
        updateSlotArfcn(0, String(nrArfcn));
      }
      toast.info(t("cell_locking.frequency_locking.nr.toast.filled_current"));
    } else {
      toast.warning(t("cell_locking.frequency_locking.nr.toast.no_active_connection"));
    }
  };

  const hasActiveNrCell = modemData?.nr?.arfcn != null;

  // --- Loading state ---------------------------------------------------------
  if (isLoading) {
    return (
      <Card className="@container/card">
        <CardHeader>
          <CardTitle>{t("cell_locking.frequency_locking.nr.title")}</CardTitle>
          <CardDescription>
            {t("cell_locking.frequency_locking.nr.description_loading")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2">
            <Separator />
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-5 w-20" />
            </div>
            <Separator />
            <div className="grid gap-4 mt-6">
              {Array.from({ length: NUM_SLOTS }).map((_, i) => (
                <div
                  key={i}
                  className="grid grid-cols-1 @sm/card:grid-cols-2 gap-4"
                >
                  <Skeleton className="h-9 w-full rounded-md" />
                  <Skeleton className="h-9 w-full rounded-md" />
                </div>
              ))}
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
          <CardTitle>{t("cell_locking.frequency_locking.nr.title")}</CardTitle>
          <CardDescription>
            {t("cell_locking.frequency_locking.nr.description_loading")}
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
                {t("cell_locking.frequency_locking.nr.error_title")}
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
          <CardTitle>{t("cell_locking.frequency_locking.nr.title")}</CardTitle>
          <CardDescription>
            {t("cell_locking.frequency_locking.nr.description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2">
            {/* Tower lock active warning */}
            {towerLockActive ? (
              <div className="flex items-start gap-2 p-2 rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-sm">
                <TbAlertTriangleFilled className="size-5 mt-0.5 shrink-0" />
                <p className="font-semibold">
                  {t("cell_locking.frequency_locking.nr.tower_lock_active")}
                </p>
              </div>
            ) : (
              <div className="flex items-start gap-2 p-2 rounded-md bg-warning/10 border border-warning/30 text-warning text-sm">
                <TbAlertTriangleFilled className="size-5 mt-0.5 shrink-0" />
                <p className="font-semibold">
                  {t("cell_locking.frequency_locking.nr.experimental_warning")}
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
                      aria-label={t("cell_locking.frequency_locking.nr.enabled_info_aria")}
                    >
                      <TbInfoCircleFilled className="size-5 text-info" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      {t("cell_locking.frequency_locking.nr.enabled_tooltip")}
                    </p>
                  </TooltipContent>
                </Tooltip>

                <p className="font-semibold text-muted-foreground text-sm">
                  {t("cell_locking.frequency_locking.nr.enabled_label")}
                </p>
              </div>
              <div className="flex items-center space-x-2">
                {isLocking ? (
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                ) : null}
                <Switch
                  id="nr-freq-locking"
                  checked={isEnabled}
                  onCheckedChange={handleToggle}
                  disabled={isDisabled}
                />
                <Label htmlFor="nr-freq-locking">
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
                    {slots.map((slot, i) => (
                      <NrFreqSlot
                        key={i}
                        index={i}
                        slot={slot}
                        matchedBands={matchedBandsPerSlot[i]}
                        supportedBands={supportedBands}
                        disabled={isDisabled}
                        onArfcnChange={updateSlotArfcn}
                        onScsChange={updateSlotScs}
                        onUseCurrent={
                          i === 0 ? handleUseCurrent : undefined
                        }
                        hasActiveCell={i === 0 ? hasActiveNrCell : false}
                      />
                    ))}
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
              {t("cell_locking.frequency_locking.nr.lock_dialog.title")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingEntries.length === 1
                ? t("cell_locking.frequency_locking.nr.lock_dialog.description_single", {
                    arfcn: pendingEntries[0].arfcn,
                    scs: pendingEntries[0].scs,
                  })
                : t("cell_locking.frequency_locking.nr.lock_dialog.description_multi", {
                    count: pendingEntries.length,
                  })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t("actions.cancel", { ns: "common" })}
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmLock}>
              {t("cell_locking.frequency_locking.nr.lock_dialog.confirm")}
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
              {t("cell_locking.frequency_locking.nr.unsupported_dialog.title")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("cell_locking.frequency_locking.nr.unsupported_dialog.description_prefix")}
              <br />
              <br />
              <strong>{t("cell_locking.frequency_locking.nr.unsupported_dialog.matched_bands_label")}</strong>{" "}
              {matchedBandsPerSlot
                .flat()
                .map((b) => `n${b.band}`)
                .join(", ") || t("cell_locking.frequency_locking.nr.unsupported_dialog.unknown")}
              <br />
              <strong>{t("cell_locking.frequency_locking.nr.unsupported_dialog.supported_bands_label")}</strong>{" "}
              {supportedBands.map((b) => `n${b}`).join(", ")}
              <br />
              <br />
              {t("cell_locking.frequency_locking.nr.unsupported_dialog.confirm_prompt")}
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
              {t("cell_locking.frequency_locking.nr.unsupported_dialog.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unlock confirmation dialog */}
      <AlertDialog open={showUnlockDialog} onOpenChange={setShowUnlockDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("cell_locking.frequency_locking.nr.unlock_dialog.title")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("cell_locking.frequency_locking.nr.unlock_dialog.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t("actions.cancel", { ns: "common" })}
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmUnlock}>
              {t("cell_locking.frequency_locking.nr.unlock_dialog.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

// =============================================================================
// NrFreqSlot — Single NR-ARFCN + SCS form row
// =============================================================================

interface NrFreqSlotProps {
  index: number;
  slot: SlotState;
  matchedBands: NRBandEntry[];
  supportedBands: number[];
  disabled: boolean;
  onArfcnChange: (index: number, arfcn: string) => void;
  onScsChange: (index: number, scs: string) => void;
  onUseCurrent?: () => void;
  hasActiveCell: boolean;
}

function NrFreqSlot({
  index,
  slot,
  matchedBands,
  supportedBands,
  disabled,
  onArfcnChange,
  onScsChange,
  onUseCurrent,
  hasActiveCell,
}: NrFreqSlotProps) {
  const { t } = useTranslation("cellular");
  const slotNum = index + 1;
  const arfcnId = `nr-freq-arfcn${slotNum}`;
  const scsId = `nr-freq-scs${slotNum}`;

  const arfcnLabel = index === 0
    ? t("cell_locking.frequency_locking.nr.arfcn_label")
    : t("cell_locking.frequency_locking.nr.arfcn_label_n", { n: slotNum });
  const scsLabel = index === 0
    ? t("cell_locking.frequency_locking.nr.scs_label")
    : t("cell_locking.frequency_locking.nr.scs_label_n", { n: slotNum });

  return (
    <div className="grid grid-cols-1 @sm/card:grid-cols-2 gap-4">
      <Field>
        <div className="flex items-center justify-between">
          <FieldLabel htmlFor={arfcnId}>{arfcnLabel}</FieldLabel>
          {onUseCurrent && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onUseCurrent}
              disabled={disabled || !hasActiveCell}
            >
              {t("cell_locking.frequency_locking.nr.use_current")}
            </Button>
          )}
        </div>
        <Input
          id={arfcnId}
          type="text"
          placeholder={t("cell_locking.frequency_locking.nr.arfcn_placeholder", { label: arfcnLabel })}
          value={slot.arfcn}
          onChange={(e) => onArfcnChange(index, e.target.value)}
          disabled={disabled}
        />
        <BandMatchDisplay
          bands={matchedBands}
          hasInput={slot.arfcn.length > 0}
          supportedBands={supportedBands}
          prefix="n"
          noMatchLabelKey="this_nr_arfcn"
        />
      </Field>
      <Field>
        <FieldLabel htmlFor={scsId}>{scsLabel}</FieldLabel>
        <Select
          value={slot.scs}
          onValueChange={(v) => onScsChange(index, v)}
          disabled={disabled}
        >
          <SelectTrigger
            id={scsId}
            aria-label={t("cell_locking.frequency_locking.nr.scs_slot_aria", { label: scsLabel, n: slotNum })}
          >
            <SelectValue placeholder={t("cell_locking.frequency_locking.nr.scs_placeholder")} />
          </SelectTrigger>
          <SelectContent>
            {SCS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={String(opt.value)}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    </div>
  );
}

export default NrFreqLockingComponent;
