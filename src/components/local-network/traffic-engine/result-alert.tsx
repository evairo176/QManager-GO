"use client";

import type { ReactNode } from "react";
import {
  CheckCircle2Icon,
  InfoIcon,
  TriangleAlertIcon,
  XCircleIcon,
  type LucideIcon,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

export type ResultTone = "success" | "warning" | "destructive" | "info";

const TONES: Record<ResultTone, { wrap: string; text: string; Icon: LucideIcon }> = {
  success: {
    wrap: "border-success/30 bg-success/10",
    text: "text-success",
    Icon: CheckCircle2Icon,
  },
  warning: {
    wrap: "border-warning/30 bg-warning/10",
    text: "text-warning",
    Icon: TriangleAlertIcon,
  },
  destructive: {
    wrap: "border-destructive/30 bg-destructive/10",
    text: "text-destructive",
    Icon: XCircleIcon,
  },
  info: {
    wrap: "border-info/30 bg-info/10",
    text: "text-info",
    Icon: InfoIcon,
  },
};

/**
 * Single source of truth for the engine's confidence-check result alerts
 * (verify / test / install). One tone scale, one icon set, one tint ramp, so
 * the Video and Masquerade surfaces can never drift apart on `bg-success/5`
 * vs `/10` the way the old twin surfaces did.
 */
export function ResultAlert({
  tone,
  children,
  className,
}: {
  tone: ResultTone;
  children: ReactNode;
  className?: string;
}) {
  const { wrap, text, Icon } = TONES[tone];
  return (
    <Alert className={cn(wrap, className)}>
      <Icon className={cn("size-4", text)} />
      <AlertDescription className={text}>{children}</AlertDescription>
    </Alert>
  );
}
