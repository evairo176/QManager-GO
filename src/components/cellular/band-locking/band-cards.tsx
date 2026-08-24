"use client";

import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "motion/react";
import { SaveButton, useSaveFlash } from "@/components/ui/save-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircleIcon,
  ArrowLeftRightIcon,
  LockIcon,
  LockOpenIcon,
  RotateCcwIcon,
  ShieldIcon,
} from "lucide-react";
import { toast } from "sonner";
import { formatBandName, type BandCategory } from "@/types/band-locking";
import { DUR, EASE_OUT_QUART } from "@/lib/motion";

// Representative band counts per category for the loading skeleton, taken from
// the static hardware band universe (supported_bands_hw.env) of the supported
// RM5xx-class modems. The exact count varies per device, but rehearsing a
// realistic number keeps the placeholder grid the same height as the real grid
// so content resolves in place instead of jumping a few rows when data lands.
const SKELETON_BAND_COUNT: Record<BandCategory, number> = {
  lte: 33,
  nsa_nr5g: 35,
  sa_nr5g: 37,
  nrdc_nr5g: 37,
};

// Mixed placeholder label widths so the skeleton row reads as the real B/N band
// labels (B1 … B71, N257) rather than a mechanically uniform bar. Indexed by i % 6.
const SKELETON_LABEL_WIDTHS = ["w-6", "w-7", "w-7", "w-8", "w-6", "w-9"] as const;

// =============================================================================
// BandCardsComponent — Per-Category Band Checkbox Grid + Lock/Unlock Actions
// =============================================================================
// One instance per band category (LTE, NSA NR5G, SA NR5G, NR-DC).
// All data flows in via props from BandLockingComponent (coordinator).
//
// Local state: checkbox selection (initialized from currentLockedBands).
// Parent owns the CGI communication — this component only calls onLock/onUnlockAll.
// =============================================================================

interface BandCardsProps {
  title: string;
  description: string;
  /** Which band category this card manages */
  bandCategory: BandCategory;
  /**
   * The checkbox universe — full hardware band capability for this category
   * (from the static spec-sheet file, sorted). Superset of policyBands.
   */
  supportedBands: number[];
  /**
   * Bands the network/SIM actually uses (from policy_band, sorted). A subset of
   * supportedBands. Bands in supportedBands but NOT here are modem-supported-but-
   * network-unused and render in warning/yellow. Used ONLY for coloring/legend —
   * "Unlock all" and the count badge operate on the full supportedBands universe.
   * Defaults to supportedBands when omitted (e.g. NR-DC view-only — no yellow bands).
   */
  policyBands?: number[];
  /** Currently locked/configured bands (from the per-category band registers, sorted) */
  currentLockedBands: number[];
  /** Lock selected bands — returns success boolean */
  onLock: (bands: number[]) => Promise<boolean>;
  /** Unlock all bands (reset to full supported list) — returns success boolean */
  onUnlockAll: () => Promise<boolean>;
  /** True while any lock/unlock operation is in flight (shared across all cards) */
  isLocking: boolean;
  /** True while initial data is loading */
  isLoading: boolean;
  /** Error from the hook (shared) */
  error: string | null;
  /** True when a Connection Scenario controls bands — disables all interactions */
  disabled?: boolean;
  /**
   * When provided, renders a swap control in the header that flips this slot
   * between SA NR5G and NR-DC. Only the shared SA/NR-DC slot passes this.
   */
  onSwapView?: () => void;
  /** Short label of the mode the swap switches TO (e.g. "NR-DC"). */
  swapLabel?: string;
  /** Tooltip + accessible name for the swap control (e.g. "Switch to NR-DC bands"). */
  swapTitle?: string;
}

const BandCardsComponent = ({
  title,
  description,
  bandCategory,
  supportedBands,
  policyBands,
  currentLockedBands,
  onLock,
  onUnlockAll,
  isLocking,
  isLoading,
  error,
  disabled = false,
  onSwapView,
  swapLabel,
  swapTitle,
}: BandCardsProps) => {
  const { t } = useTranslation("cellular");
  const { saved, markSaved } = useSaveFlash();

  // --- Local checkbox state (number set for O(1) lookup) --------------------
  const [checkedBands, setCheckedBands] = useState<Set<number>>(
    () => new Set(currentLockedBands),
  );

  // Sync local state when currentLockedBands prop changes (initial load or after lock).
  // "Store previous value in state" pattern per React docs — no refs, no effects.
  // See: https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [prevLockedKey, setPrevLockedKey] = useState("");
  const lockedKey = currentLockedBands.join(":");
  if (prevLockedKey !== lockedKey && currentLockedBands.length > 0) {
    setPrevLockedKey(lockedKey);
    setCheckedBands(new Set(currentLockedBands));
  }

  // --- Two-layer band model -------------------------------------------------
  // policy = the network/SIM-used subset, used ONLY to color bands (primary vs
  // yellow). The universe is `supportedBands` — that's what "Unlock all" locks and
  // what the count/all-unlocked state measure against. Default policy to the full
  // universe so cards that don't pass it (NR-DC view-only) render all-primary.
  const policySet = useMemo(
    () => new Set(policyBands ?? supportedBands),
    [policyBands, supportedBands],
  );
  // Bands the modem supports but the network/SIM doesn't use — rendered yellow.
  const hasUnusedBands = useMemo(
    () => supportedBands.some((b) => !policySet.has(b)),
    [supportedBands, policySet],
  );

  // --- Derived state --------------------------------------------------------
  // "All unlocked" = every modem-supported band is locked. "Unlock all" locks the
  // full hardware universe, so this measures against supportedBands (not policy).
  const supportedSet = useMemo(() => new Set(supportedBands), [supportedBands]);
  const supportedCount = supportedBands.length;
  const isAllUnlocked = useMemo(() => {
    if (supportedCount === 0 || currentLockedBands.length === 0) return false;
    return (
      currentLockedBands.length === supportedCount &&
      currentLockedBands.every((b) => supportedSet.has(b))
    );
  }, [supportedCount, supportedSet, currentLockedBands]);

  // Whether the user's selection differs from what's currently on the modem
  const hasChanges = useMemo(() => {
    if (currentLockedBands.length !== checkedBands.size) return true;
    return currentLockedBands.some((b) => !checkedBands.has(b));
  }, [currentLockedBands, checkedBands]);

  const noneSelected = checkedBands.size === 0;

  // --- Handlers -------------------------------------------------------------
  const handleCheckboxChange = (band: number) => {
    setCheckedBands((prev) => {
      const next = new Set(prev);
      if (next.has(band)) {
        next.delete(band);
      } else {
        next.add(band);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    setCheckedBands(new Set(supportedBands));
  };

  const handleSelectNone = () => {
    setCheckedBands(new Set());
  };

  const handleLock = async () => {
    const bands = [...checkedBands].sort((a, b) => a - b);
    if (bands.length === 0) {
      toast.error(t("cell_locking.band_locking.toast.select_one_band"));
      return;
    }

    const categoryLabel = t(`cell_locking.band_locking.card_category_label.${bandCategory}`);
    const success = await onLock(bands);
    if (success) {
      markSaved();
      toast.success(
        t("cell_locking.band_locking.toast.locked_success", { category_label: categoryLabel }),
      );
    } else {
      toast.error(error || t("cell_locking.band_locking.toast.lock_error"));
    }
  };

  const handleUnlockAll = async () => {
    const categoryLabel = t(`cell_locking.band_locking.card_category_label.${bandCategory}`);
    const success = await onUnlockAll();
    if (success) {
      toast.success(t("cell_locking.band_locking.toast.unlocked_success", { category_label: categoryLabel }));
    } else {
      toast.error(error || t("cell_locking.band_locking.toast.unlock_error"));
    }
  };

  // --- Loading skeleton -----------------------------------------------------
  // Rehearses the real card structure so nothing shifts when data lands: the
  // real (already-translated) title + description, a header badge placeholder
  // plus the swap control on the shared SA/NR-DC slot, the same responsive
  // checkbox grid at a representative band count for this category, and the same
  // two-group footer. The placeholder checkboxes fade+scale in on the motion
  // system's curve with the same stagger as the live grid, so the skeleton
  // resolves into the real staggered grid as one continuous motion.
  if (isLoading) {
    const placeholderCount = SKELETON_BAND_COUNT[bandCategory];
    return (
      <Card className="@container/card">
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle>{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {onSwapView && <Skeleton className="h-7 w-20 rounded-md" />}
              <Skeleton className="h-6 w-24 rounded-md" />
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <motion.div
            className="grid @lg/card:grid-cols-8 @md/card:grid-cols-6 @sm/card:grid-cols-4 grid-cols-3 grid-flow-row gap-4 mt-2"
            initial="hidden"
            animate="visible"
            variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.025 } } }}
          >
            {Array.from({ length: placeholderCount }).map((_, i) => (
              <motion.div
                key={i}
                className="flex items-center space-x-2"
                variants={{ hidden: { opacity: 0, scale: 0.88 }, visible: { opacity: 1, scale: 1 } }}
                transition={{ duration: DUR.fast, ease: EASE_OUT_QUART }}
              >
                <Skeleton className="size-4 rounded" />
                <Skeleton className={`h-4 ${SKELETON_LABEL_WIDTHS[i % SKELETON_LABEL_WIDTHS.length]}`} />
              </motion.div>
            ))}
          </motion.div>
        </CardContent>

        <CardFooter className="flex flex-wrap items-center justify-between gap-2 mt-4">
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-32" />
            <Skeleton className="size-9 rounded-md" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-20" />
            <Skeleton className="h-9 w-24" />
          </div>
        </CardFooter>
      </Card>
    );
  }

  // --- Empty state (no supported bands for this category) -------------------
  if (supportedBands.length === 0) {
    return (
      <Card className="@container/card">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {t("cell_locking.band_locking.card_empty")}
          </p>
        </CardContent>
      </Card>
    );
  }

  // Combined disable flag: scenario-controlled OR mid-lock
  const isDisabled = disabled || isLocking;

  return (
    <Card className="@container/card" aria-disabled={disabled || undefined}>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div className={disabled ? "text-muted-foreground" : undefined}>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <div className="flex shrink-0 items-center gap-2">
          {onSwapView && (
            <Button
              size="xs"
              variant="secondary"
              onClick={onSwapView}
              disabled={isDisabled}
              aria-label={swapTitle}
              title={swapTitle}
              className="gap-1.5"
            >
              <ArrowLeftRightIcon className="size-3.5" />
              {swapLabel}
            </Button>
          )}
          {disabled ? (
            <Badge
              variant="outline"
              className="bg-info/15 text-info hover:bg-info/20 border-info/30"
            >
              <ShieldIcon className="h-3 w-3" />
              {t("cell_locking.band_locking.card_badges.scenario_controlled")}
            </Badge>
          ) : isAllUnlocked ? (
            <Badge
              variant="outline"
              className="bg-success/15 text-success hover:bg-success/20 border-success/30"
            >
              <LockOpenIcon className="h-3 w-3" />
              {t("cell_locking.band_locking.card_badges.all_unlocked")}
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="bg-warning/15 text-warning hover:bg-warning/20 border-warning/30"
            >
              <LockIcon className="h-3 w-3" />
              {t("cell_locking.band_locking.card_badges.bands_locked", { locked: currentLockedBands.length, total: supportedCount })}
            </Badge>
          )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {/* Band checkbox grid */}
        <motion.div
          className="grid @lg/card:grid-cols-8 @md/card:grid-cols-6 @sm/card:grid-cols-4 grid-cols-3 grid-flow-row gap-4 mt-2"
          initial="hidden"
          animate="visible"
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.025 } } }}
        >
          {supportedBands.map((band) => {
            // Modem-supported but network/SIM-unused → warning/yellow accent.
            const unused = !policySet.has(band);
            return (
            <motion.div
              key={band}
              className="flex items-center space-x-2"
              variants={{ hidden: { opacity: 0, scale: 0.88 }, visible: { opacity: 1, scale: 1 } }}
              transition={{ duration: DUR.fast, ease: EASE_OUT_QUART }}
            >
              <Checkbox
                id={`${bandCategory}-${band}`}
                checked={checkedBands.has(band)}
                onCheckedChange={() => handleCheckboxChange(band)}
                disabled={isDisabled}
                className={
                  unused
                    ? "border-warning-on-surface/50 data-[state=checked]:bg-warning data-[state=checked]:border-warning data-[state=checked]:text-warning-foreground dark:data-[state=checked]:bg-warning"
                    : undefined
                }
              />
              <Label
                htmlFor={`${bandCategory}-${band}`}
                className={`${disabled ? "cursor-default" : "cursor-pointer"}${unused ? " text-warning-on-surface" : ""}`}
              >
                {formatBandName(bandCategory, band)}
              </Label>
            </motion.div>
            );
          })}
        </motion.div>

        {/* Legend — only when the card has modem-supported-but-unused (yellow) bands */}
        {hasUnusedBands && (
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 shrink-0 rounded-[3px] bg-primary" aria-hidden="true" />
              {t("cell_locking.band_locking.legend.used")}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 shrink-0 rounded-[3px] bg-warning" aria-hidden="true" />
              {t("cell_locking.band_locking.legend.unused")}
            </span>
          </div>
        )}
      </CardContent>

      {/* Inline error — persistent until next operation */}
      {error && !isLocking && (
        <div className="px-6 pb-2">
          <div
            role="alert"
            className="flex items-center gap-2 rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive"
          >
            <AlertCircleIcon className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Screen reader live region for operation results */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {isLocking ? t("cell_locking.band_locking.card_live_region", {
          category_label: t(`cell_locking.band_locking.card_category_label.${bandCategory}`),
        }) : ""}
      </div>

      <CardFooter className="flex flex-wrap items-center justify-between gap-2 mt-4">
        <div className="flex items-center gap-2">
          <SaveButton
            onClick={handleLock}
            isSaving={isLocking}
            saved={saved}
            label={t("cell_locking.band_locking.card_buttons.lock_selected")}
            disabled={isDisabled || noneSelected || !hasChanges}
          />
          <Button
            variant="outline"
            size="icon"
            onClick={handleUnlockAll}
            disabled={isDisabled || isAllUnlocked}
            aria-label={t("cell_locking.band_locking.card_buttons.unlock_all_aria")}
            title={t("cell_locking.band_locking.card_buttons.unlock_all_title")}
          >
            <RotateCcwIcon />
          </Button>
        </div>
        {/* Quick actions row */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleSelectAll}
            disabled={isDisabled}
          >
            {t("cell_locking.band_locking.card_buttons.select_all")}
          </Button>
          <Button
            variant="outline"
            onClick={handleSelectNone}
            disabled={isDisabled}
          >
            {t("cell_locking.band_locking.card_buttons.deselect_all")}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
};

export default BandCardsComponent;
