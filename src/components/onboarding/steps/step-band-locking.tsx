"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { authFetch } from "@/lib/auth-fetch";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useModemStatus } from "@/hooks/use-modem-status";
import { parseBandString } from "@/types/band-locking";

// =============================================================================
// StepBandLocking — Onboarding step 5: band presets (optional)
// =============================================================================

const BAND_LOCK_ENDPOINT = "/cgi-bin/quecmanager/bands/lock.sh";

// Preset band strings (colon-delimited, sorted numerically)
const LTE_PRESETS: Record<string, string> = {
  low: "5:8:12:13:17:20:26:28:71",
  mid: "1:2:3:4:7:25:66",
};

const NR5G_PRESETS: Record<string, string> = {
  low: "5:8:28:71",
  mid: "41:77:78:79",
};

type BandPreset = "all" | "low" | "mid" | "custom";

function mergeUniqueBands(...bandGroups: number[][]): number[] {
  return [...new Set(bandGroups.flat())].sort((a, b) => a - b);
}

interface BandPresetSectionProps {
  title: string;
  prefix: string;
  availableBands: number[];
  presets: Record<string, string>;
  selectedPreset: BandPreset;
  customBands: Set<number>;
  loading: boolean;
  onPresetChange: (preset: BandPreset) => void;
  onCustomBandToggle: (band: number) => void;
}

function BandPresetSection({
  title,
  prefix,
  availableBands,
  presets,
  selectedPreset,
  customBands,
  loading,
  onPresetChange,
  onCustomBandToggle,
}: BandPresetSectionProps) {
  const { t } = useTranslation("onboarding");
  const presetBands = useMemo(
    () => ({
      low: parseBandString(presets.low).filter((band) => availableBands.includes(band)),
      mid: parseBandString(presets.mid).filter((band) => availableBands.includes(band)),
    }),
    [availableBands, presets.low, presets.mid],
  );

  const options: { id: BandPreset; label: string; detail?: string }[] = [
    { id: "all", label: t("band_locking.preset_label_all") },
    {
      id: "low",
      label: t("band_locking.preset_label_low"),
      detail: presetBands.low
        .map((b) => `${prefix}${b}`)
        .join(", "),
    },
    {
      id: "mid",
      label: t("band_locking.preset_label_mid"),
      detail: presetBands.mid
        .map((b) => `${prefix}${b}`)
        .join(", "),
    },
    { id: "custom", label: t("band_locking.preset_label_custom") },
  ];

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium">{title}</p>
      <div role="radiogroup" aria-label={title} className="flex flex-col gap-1.5">
        {options.map((opt) => (
          <motion.button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={selectedPreset === opt.id}
            onClick={() => onPresetChange(opt.id)}
            whileTap={{ scale: 0.97 }}
            transition={{ type: "spring", stiffness: 600, damping: 30 }}
            className={cn(
              "flex items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors duration-150",
              "hover:border-primary/50 hover:bg-primary/5",
              selectedPreset === opt.id
                ? "border-primary bg-primary/5"
                : "border-border"
            )}
          >
            <span
              className={cn(
                "mt-0.5 block size-3.5 shrink-0 rounded-full border-2 transition-colors",
                selectedPreset === opt.id
                  ? "border-primary bg-primary"
                  : "border-muted-foreground/40"
              )}
            />
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-sm font-medium">{opt.label}</span>
              {opt.detail && (
                <span className="text-xs text-muted-foreground truncate">
                  {opt.detail}
                </span>
              )}
            </div>
          </motion.button>
        ))}
      </div>

      {/* Custom band grid */}
      {selectedPreset === "custom" && (
        loading && availableBands.length === 0 ? (
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
            {t("band_locking.loading_bands")}
          </div>
        ) : availableBands.length > 0 ? (
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <div className="grid grid-cols-6 gap-1.5 max-h-36 overflow-y-auto pr-1">
              {availableBands.map((band) => {
                const id = `band-${prefix}-${band}`;
                return (
                  <div key={band} className="flex items-center gap-1">
                    <Checkbox
                      id={id}
                      checked={customBands.has(band)}
                      onCheckedChange={() => onCustomBandToggle(band)}
                    />
                    <Label
                      htmlFor={id}
                      className="text-xs cursor-pointer select-none whitespace-nowrap"
                    >
                      {prefix}{band}
                    </Label>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
            {t("band_locking.error_no_bands")}
          </div>
        )
      )}
    </div>
  );
}

interface StepBandLockingProps {
  onSubmitRef: (fn: () => Promise<void>) => void;
  onLoadingChange: (loading: boolean) => void;
  onSuccess: () => void;
}

export function StepBandLocking({
  onSubmitRef,
  onLoadingChange,
  onSuccess,
}: StepBandLockingProps) {
  const { t } = useTranslation("onboarding");
  const { data, isLoading, error } = useModemStatus();
  const [ltePreset, setLtePreset] = useState<BandPreset>("all");
  const [nr5gPreset, setNr5gPreset] = useState<BandPreset>("all");
  const [lteCustom, setLteCustom] = useState<Set<number>>(new Set());
  const [nr5gCustom, setNr5gCustom] = useState<Set<number>>(new Set());

  const supportedLteBands = useMemo(
    () => parseBandString(data?.device.supported_lte_bands),
    [data?.device.supported_lte_bands],
  );
  const supportedNrBands = useMemo(
    () =>
      mergeUniqueBands(
        parseBandString(data?.device.supported_nsa_nr5g_bands),
        parseBandString(data?.device.supported_sa_nr5g_bands),
      ),
    [data?.device.supported_nsa_nr5g_bands, data?.device.supported_sa_nr5g_bands],
  );

  const toggleBand = (
    set: Set<number>,
    setter: (s: Set<number>) => void,
    band: number
  ) => {
    const next = new Set(set);
    if (next.has(band)) next.delete(band);
    else next.add(band);
    setter(next);
  };

  const getBandString = (
    preset: BandPreset,
    presets: Record<string, string>,
    custom: Set<number>,
    supportedBands: number[],
  ): string | null => {
    if (preset === "all") return null;
    if (preset === "custom") {
      const selected = [...custom].filter((band) => supportedBands.includes(band));
      if (selected.length === 0) return null;
      return selected.sort((a, b) => a - b).join(":");
    }
    const selected = parseBandString(presets[preset]).filter((band) => supportedBands.includes(band));
    if (selected.length === 0) return null;
    return selected.join(":");
  };

  const submit = useCallback(async () => {
    const lteBands = getBandString(ltePreset, LTE_PRESETS, lteCustom, supportedLteBands);
    const nr5gBands = getBandString(nr5gPreset, NR5G_PRESETS, nr5gCustom, supportedNrBands);

    if (!lteBands && !nr5gBands) {
      // No selection — skip
      onSuccess();
      return;
    }

    onLoadingChange(true);
    try {
      const requests: Promise<unknown>[] = [];
      if (lteBands) {
        requests.push(
          authFetch(BAND_LOCK_ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ band_type: "lte", bands: lteBands }),
          })
        );
      }
      if (nr5gBands) {
        // Lock both NSA and SA with same selection
        requests.push(
          authFetch(BAND_LOCK_ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ band_type: "nsa_nr5g", bands: nr5gBands }),
          })
        );
        requests.push(
          authFetch(BAND_LOCK_ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ band_type: "sa_nr5g", bands: nr5gBands }),
          })
        );
      }
      await Promise.allSettled(requests);
    } catch {
      // Non-fatal
    } finally {
      onLoadingChange(false);
      onSuccess();
    }
  }, [ltePreset, nr5gPreset, lteCustom, nr5gCustom, onLoadingChange, onSuccess, supportedLteBands, supportedNrBands]);

  useEffect(() => {
    onSubmitRef(submit);
  }, [submit, onSubmitRef]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h2 className="text-2xl font-semibold tracking-tight">{t("band_locking.heading")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("band_locking.description")}
        </p>
      </div>

      <div className="flex flex-col gap-5">
        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {t("band_locking.error_bands_unavailable")}
          </div>
        )}

        <BandPresetSection
          title={t("band_locking.section_lte_title")}
          prefix="B"
          availableBands={supportedLteBands}
          presets={LTE_PRESETS}
          selectedPreset={ltePreset}
          customBands={lteCustom}
          loading={isLoading}
          onPresetChange={setLtePreset}
          onCustomBandToggle={(b) => toggleBand(lteCustom, setLteCustom, b)}
        />

        <div className="border-t border-border" />

        <BandPresetSection
          title={t("band_locking.section_5g_title")}
          prefix="N"
          availableBands={supportedNrBands}
          presets={NR5G_PRESETS}
          selectedPreset={nr5gPreset}
          customBands={nr5gCustom}
          loading={isLoading}
          onPresetChange={setNr5gPreset}
          onCustomBandToggle={(b) => toggleBand(nr5gCustom, setNr5gCustom, b)}
        />
      </div>
    </div>
  );
}
