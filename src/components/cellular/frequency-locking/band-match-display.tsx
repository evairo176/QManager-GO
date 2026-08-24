"use client";

// =============================================================================
// BandMatchDisplay — Inline band match feedback below an EARFCN/ARFCN input
// =============================================================================
// Shared by both LTE and NR frequency locking cards. Shows which bands match
// the entered frequency, highlighting unsupported bands in destructive color.
// =============================================================================

import { useTranslation } from "react-i18next";

interface BandEntry {
  band: number;
  name: string;
}

interface BandMatchDisplayProps {
  /** Matched band entries from earfcn lookup */
  bands: BandEntry[];
  /** Whether the input field has any value */
  hasInput: boolean;
  /** Hardware-supported band numbers for this technology */
  supportedBands: number[];
  /** Band prefix for display (e.g., "B" for LTE, "n" for NR) */
  prefix: string;
  /** i18n key for the "no match" label variant */
  noMatchLabelKey?: "this_channel" | "this_nr_arfcn" | "this_frequency";
}

export function BandMatchDisplay({
  bands,
  hasInput,
  supportedBands,
  prefix,
  noMatchLabelKey = "this_frequency",
}: BandMatchDisplayProps) {
  const { t } = useTranslation("cellular");

  if (!hasInput) return null;

  if (bands.length === 0) {
    const labelKey = noMatchLabelKey ?? "this_frequency";
    return (
      <p className="text-xs text-destructive mt-1">
        {t("cell_locking.frequency_locking.band_match.no_match", {
          label: t(`cell_locking.frequency_locking.band_match.no_match_label.${labelKey}`),
        })}
      </p>
    );
  }

  return (
    <p className="text-xs text-muted-foreground mt-1">
      {t("cell_locking.frequency_locking.band_match.possible_prefix")}
      {bands.map((b, i) => {
        const isSupported = supportedBands.length === 0 || supportedBands.includes(b.band);
        return (
          <span key={b.band}>
            {i > 0 && ", "}
            <span className={isSupported ? "" : "text-destructive font-medium"}>
              {prefix}{b.band} ({b.name}){!isSupported && t("cell_locking.frequency_locking.band_match.unsupported_suffix")}
            </span>
          </span>
        );
      })}
    </p>
  );
}
