"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { HintIcon } from "@/components/ui/hint-icon";
import { Loader2, Zap } from "lucide-react";

interface EngineCheckRowProps {
  /** Section heading (e.g. "Verify Service", "Test Injection"). */
  title: string;
  /** One-line explanation of what the check proves. */
  description: string;
  /** Optional tooltip explaining what a passing result means. */
  hint?: string;
  hintAriaLabel?: string;
  /** Run-button label and its in-flight label. */
  runLabel: string;
  busyLabel: string;
  /** Whether THIS mode owns the engine. Gates the button + idle hint. */
  running: boolean;
  /** True while the check is in flight. */
  busy: boolean;
  onRun: () => void;
  /** Result alerts, rendered only while running. */
  children?: ReactNode;
}

/**
 * The single confidence-check surface shared by Video Optimizer's "Verify
 * Service" and Masquerade's "Test Injection". One layout, one button shape, one
 * idle/result split — extracted (like {@link EngineEnableRow} and
 * {@link ResultAlert}) so the two checks are identical by construction and can
 * never drift apart by hand.
 */
export function EngineCheckRow({
  title,
  description,
  hint,
  hintAriaLabel,
  runLabel,
  busyLabel,
  running,
  busy,
  onRun,
  children,
}: EngineCheckRowProps) {
  return (
    <div className="flex flex-col gap-3 border-t pt-5" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            {hint && (
              <HintIcon label={hintAriaLabel ?? ""} variant="info" size="sm">
                {hint}
              </HintIcon>
            )}
            <p className="text-sm font-medium text-foreground">{title}</p>
          </div>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onRun}
          disabled={!running || busy}
        >
          {busy ? (
            <>
              <Loader2 className="animate-spin" />
              {busyLabel}
            </>
          ) : (
            <>
              <Zap />
              {runLabel}
            </>
          )}
        </Button>
      </div>

      {running ? children : null}
    </div>
  );
}
