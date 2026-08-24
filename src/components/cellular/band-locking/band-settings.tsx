"use client";

import { useTranslation } from "react-i18next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TbInfoCircleFilled } from "react-icons/tb";
import {
  TriangleAlertIcon,
  CheckCircle2Icon,
  MinusCircleIcon,
} from "lucide-react";
import { toast } from "sonner";
import type { FailoverState } from "@/types/band-locking";
import type { CarrierComponent } from "@/types/modem-status";

// =============================================================================
// BandSettingsComponent — Failover Toggle + Active Bands Display
// =============================================================================
// Props come from BandLockingComponent (coordinator).
// Active bands are derived from carrier_components (QCAINFO data).
// =============================================================================

interface BandSettingsProps {
  /** Failover toggle + activation state */
  failover: FailoverState;
  /** Active carrier components from useModemStatus (QCAINFO Tier 2) */
  carrierComponents: CarrierComponent[];
  /** Callback to toggle failover on/off */
  onToggleFailover: (enabled: boolean) => Promise<boolean>;
  /** True while initial data is loading */
  isLoading: boolean;
  /** True when a Connection Scenario controls bands — disables failover toggle */
  isScenarioControlled?: boolean;
}

/**
 * Extract active band names from carrier_components for a given technology.
 * Returns sorted, comma-separated display string (e.g., "B1, B3, B41, B41").
 *
 * One entry per carrier component — NOT deduplicated. Intra-band carrier
 * aggregation legitimately puts two carriers on the same band (e.g. two B41
 * SCCs on different EARFCNs), and the band count must line up 1:1 with the
 * active channel count from getActiveArfcnDisplay.
 */
function getActiveBandDisplay(
  components: CarrierComponent[],
  technology: "LTE" | "NR",
): string {
  const bands = components
    .filter((c) => c.technology === technology)
    .map((c) => c.band)
    .filter(Boolean);

  if (bands.length === 0) return "—";

  // Sort numerically by band number (strip prefix for comparison)
  bands.sort((a, b) => {
    const numA = parseInt(a.replace(/^[BN]/, ""), 10);
    const numB = parseInt(b.replace(/^[BN]/, ""), 10);
    return numA - numB;
  });

  return bands.join(", ");
}

/**
 * Extract active E/ARFCNs from carrier_components for a given technology.
 * Returns sorted, comma-separated display string (e.g., "301, 1650, 40364").
 *
 * One entry per carrier component — NOT deduplicated, so the channel count
 * lines up 1:1 with the band count from getActiveBandDisplay.
 */
function getActiveArfcnDisplay(
  components: CarrierComponent[],
  technology: "LTE" | "NR",
): string {
  const arfcns = components
    .filter((c) => c.technology === technology && c.earfcn != null)
    .map((c) => c.earfcn as number);

  if (arfcns.length === 0) return "—";

  // Sort numerically (no dedup — one entry per carrier)
  arfcns.sort((a, b) => a - b);
  return arfcns.join(", ");
}

const BandSettingsComponent = ({
  failover,
  carrierComponents,
  onToggleFailover,
  isLoading,
  isScenarioControlled = false,
}: BandSettingsProps) => {
  const { t } = useTranslation("cellular");

  // --- Derive active bands from carrier_components --------------------------
  const activeLte = getActiveBandDisplay(carrierComponents, "LTE");
  const activeLteArfcn = getActiveArfcnDisplay(carrierComponents, "LTE");
  const activeNr = getActiveBandDisplay(carrierComponents, "NR");
  const activeNrArfcn = getActiveArfcnDisplay(carrierComponents, "NR");

  // --- Failover toggle handler ----------------------------------------------
  const handleFailoverToggle = async (checked: boolean) => {
    const success = await onToggleFailover(checked);
    if (success) {
      toast.success(
        checked
          ? t("cell_locking.band_locking.settings_card.toast.failover_enabled")
          : t("cell_locking.band_locking.settings_card.toast.failover_disabled"),
      );
    } else {
      toast.error(t("cell_locking.band_locking.settings_card.toast.failover_error"));
    }
  };

  // --- Failover status badge ------------------------------------------------
  const renderFailoverStatus = () => {
    if (isLoading) return <Skeleton className="h-5 w-32" />;

    if (!failover.enabled) {
      return (
        <Badge
          variant="outline"
          className="bg-muted/50 text-muted-foreground border-muted-foreground/30"
        >
          <MinusCircleIcon className="h-3 w-3" />
          {t("cell_locking.band_locking.settings_card.status.disabled")}
        </Badge>
      );
    }

    if (failover.activated) {
      return (
        <Badge
          variant="outline"
          className="bg-warning/15 text-warning hover:bg-warning/20 border-warning/30"
        >
          <TriangleAlertIcon className="h-3 w-3" />
          {t("cell_locking.band_locking.settings_card.status.fallback_active")}
        </Badge>
      );
    }

    return (
      <Badge
        variant="outline"
        className="bg-success/15 text-success hover:bg-success/20 border-success/30"
      >
        <CheckCircle2Icon className="h-3 w-3" />
        {t("cell_locking.band_locking.settings_card.status.ready")}
      </Badge>
    );
  };

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>{t("cell_locking.band_locking.settings_card.title")}</CardTitle>
        <CardDescription>
          {t("cell_locking.band_locking.settings_card.description")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2">
          <Separator />

          {/* Failover Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex"
                    aria-label={t("cell_locking.band_locking.settings_card.band_failover_info_aria")}
                  >
                    <TbInfoCircleFilled className="size-5 text-info" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{t("cell_locking.band_locking.settings_card.band_failover_tooltip")}</p>
                </TooltipContent>
              </Tooltip>
              <p className="font-semibold text-muted-foreground text-sm">
                {t("cell_locking.band_locking.settings_card.band_failover_label")}
              </p>
            </div>
            <div className="flex items-center space-x-2">
              {isLoading ? (
                <Skeleton className="h-5 w-20" />
              ) : (
                <>
                  <Switch
                    id="band-failover"
                    checked={failover.enabled}
                    onCheckedChange={handleFailoverToggle}
                    disabled={isScenarioControlled}
                  />
                  <Label htmlFor="band-failover">
                    {failover.enabled
                      ? t("state.enabled", { ns: "common" })
                      : t("state.disabled", { ns: "common" })}
                  </Label>
                </>
              )}
            </div>
          </div>
          <Separator />

          {/* Failover Status */}
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-muted-foreground">
              {t("cell_locking.band_locking.settings_card.status_label")}
            </p>
            <div className="flex items-center gap-1.5">
              {renderFailoverStatus()}
            </div>
          </div>
          <Separator />

          {/* Active LTE Bands */}
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-muted-foreground">
              {t("cell_locking.band_locking.settings_card.active_lte_bands")}
            </p>
            <div className="flex items-center gap-1.5">
              {isLoading ? (
                <Skeleton className="h-4 w-28" />
              ) : (
                <p className="text-sm font-semibold">{activeLte}</p>
              )}
            </div>
          </div>
          <Separator />

          {/* Active LTE EARFCNs */}
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-muted-foreground">
              {t("cell_locking.band_locking.settings_card.active_lte_channels")}
            </p>
            <div className="flex items-center gap-1.5">
              {isLoading ? (
                <Skeleton className="h-4 w-28" />
              ) : (
                <p className="text-sm font-semibold">{activeLteArfcn}</p>
              )}
            </div>
          </div>
          <Separator />

          {/* Active NR Bands */}
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-muted-foreground">
              {t("cell_locking.band_locking.settings_card.active_nr_bands")}
            </p>
            <div className="flex items-center gap-1.5">
              {isLoading ? (
                <Skeleton className="h-4 w-20" />
              ) : (
                <p className="text-sm font-semibold">{activeNr}</p>
              )}
            </div>
          </div>
          <Separator />

          {/* Active NR ARFCNs */}
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-muted-foreground">
              {t("cell_locking.band_locking.settings_card.active_nr_channels")}
            </p>
            <div className="flex items-center gap-1.5">
              {isLoading ? (
                <Skeleton className="h-4 w-24" />
              ) : (
                <p className="text-sm font-semibold">{activeNrArfcn}</p>
              )}
            </div>
          </div>
          <Separator />
        </div>
      </CardContent>
    </Card>
  );
};

export default BandSettingsComponent;
