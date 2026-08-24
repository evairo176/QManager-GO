import type { ReactNode } from "react";
import { CheckIcon, AlertTriangleIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// =============================================================================
// MetaPanel / MetaPair — a soft, presentational summary panel
// =============================================================================
// Used inside settings cards to preview the effect of a selected preset: a
// titled, muted container holding a short blurb and a row of label-over-value
// stat cells. Purely presentational — no state, no fetching.
//
// Type + Manrope only (DESIGN.md): numeric values use tabular-nums so figures
// stay column-aligned when they change. Status glyphs follow the outline
// status-badge idiom (semantic success/warning tokens, size-3 lucide icon),
// never a solid fill.
// =============================================================================

interface MetaPanelProps {
  /** Bold heading for the panel — usually the active preset's label. */
  title: string;
  /** One-line muted description shown under the title. */
  blurb: string;
  /** Stat cells (typically a grid of <MetaPair />). */
  children: ReactNode;
  className?: string;
}

export function MetaPanel({ title, blurb, children, className }: MetaPanelProps) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-muted/40 px-3 py-2.5",
        className,
      )}
    >
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="text-xs text-muted-foreground">{blurb}</p>
      {children}
    </div>
  );
}

interface MetaPairProps {
  /** Muted caption above the value. */
  label: string;
  /** The value — rendered with tabular-nums for column-aligned figures. */
  value: string;
  /**
   * Optional status glyph rendered beside the value:
   *   "ok"   → success check
   *   "warn" → warning triangle
   *   null / undefined → no glyph
   */
  glyph?: "ok" | "warn" | null;
}

export function MetaPair({ label, value, glyph }: MetaPairProps) {
  return (
    <div className="grid gap-0.5">
      <span className="text-[0.6875rem] leading-none text-muted-foreground">
        {label}
      </span>
      <span className="flex items-center gap-1 text-sm font-medium tabular-nums text-foreground">
        {value}
        {glyph === "ok" && (
          <CheckIcon
            className="size-3 text-success-on-surface"
            aria-hidden="true"
          />
        )}
        {glyph === "warn" && (
          <AlertTriangleIcon
            className="size-3 text-warning-on-surface"
            aria-hidden="true"
          />
        )}
      </span>
    </div>
  );
}
