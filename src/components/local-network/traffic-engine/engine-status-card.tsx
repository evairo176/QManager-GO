"use client";

import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2Icon, Loader2, MinusCircleIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EngineTransition, ViewMode } from "./traffic-engine";

interface EngineStatusCardProps {
  /** Which mode owns the running engine, or null when idle. */
  activeMode: ViewMode | null;
  /** Live stats of the running mode. Ignored visually while idle. */
  uptime: string;
  packets: number;
  rate: number;
  /** SNI domain, for the masquerading badge label. */
  sniDomain?: string;
  /**
   * In-flight engine transition, or null when settled. Drives a busy badge
   * (spinner + verb) and skeleton stats so every toggle — start, stop, and
   * switch — has a loading state, and the badge isn't contradicted by a stale
   * "Idle"/"Protecting" badge during the ~1s poll gap after the action lands.
   */
  transition?: EngineTransition;
  /**
   * Optional footer content (e.g. the engine-remove row). The composer passes
   * it only while idle, so a destructive action never sits under live stats.
   */
  footer?: ReactNode;
}

function Stat({
  label,
  value,
  unit,
  muted,
  loading,
}: {
  label: string;
  value: string;
  unit?: string;
  muted: boolean;
  /** Show a placeholder bar instead of the value while the engine transitions. */
  loading?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {loading ? (
        <Skeleton className="h-5 w-12 rounded" />
      ) : (
        <span className="flex items-baseline gap-1">
          <span
            className={cn(
              "text-xl font-semibold leading-none tabular-nums transition-colors duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]",
              muted ? "text-muted-foreground" : "text-foreground",
            )}
          >
            {value}
          </span>
          {unit && (
            <span className="text-xs text-muted-foreground">{unit}</span>
          )}
        </span>
      )}
    </div>
  );
}

/**
 * Informational status card. It reports what the single packet engine is doing
 * right now: a state badge in the header, and three quiet tabular readouts
 * below. No control lives here (enable/disable belongs to each mode panel), and
 * no hero number; "honest stats, calmly stated" is the whole brief.
 */
export function EngineStatusCard({
  activeMode,
  uptime,
  packets,
  rate,
  sniDomain,
  transition,
  footer,
}: EngineStatusCardProps) {
  const { t } = useTranslation("local-network");
  const running = activeMode !== null;
  const transitioning = !!transition;

  // A transition outranks the steady-state badge: during a switch the outgoing
  // mode still reads "running" for a beat, and we want "Switching…", not the
  // mode it's leaving.
  const badge = transitioning ? (
    <Badge variant="outline" className="border-info/30 bg-info/15 text-info">
      <Loader2 className="size-3 animate-spin" />
      {t(
        transition === "stop"
          ? "traffic_engine.state_stopping"
          : transition === "switch"
            ? "traffic_engine.state_switching"
            : "traffic_engine.state_starting",
      )}
    </Badge>
  ) : running ? (
    <Badge
      variant="outline"
      className="border-success/30 bg-success/15 text-success"
    >
      <CheckCircle2Icon className="size-3" />
      {activeMode === "video"
        ? t("traffic_engine.state_protecting")
        : t("traffic_engine.state_masquerading", { domain: sniDomain })}
    </Badge>
  ) : (
    <Badge
      variant="outline"
      className="border-muted-foreground/30 bg-muted/50 text-muted-foreground"
    >
      <MinusCircleIcon className="size-3" />
      {t("traffic_engine.state_idle")}
    </Badge>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("traffic_engine.engine_status_label")}</CardTitle>
        <CardDescription>
          {t("traffic_engine.status_card_description")}
        </CardDescription>
        {/* Live region sits on the state badge (changes only on engine
            state transitions), not on the stats — those tick every 1s poll
            and would otherwise spam a screen reader once a second. */}
        <CardAction aria-live="polite">{badge}</CardAction>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4">
          <Stat
            label={t("traffic_engine.tile_uptime")}
            value={running ? uptime : "—"}
            muted={!running}
            loading={transitioning}
          />
          <Stat
            label={t("traffic_engine.hero_packets_label")}
            value={running ? packets.toLocaleString() : "—"}
            muted={!running}
            loading={transitioning}
          />
          <Stat
            label={t("traffic_engine.hero_rate_label")}
            value={running ? rate.toLocaleString() : "—"}
            unit={running ? t("traffic_engine.hero_rate_unit") : undefined}
            muted={!running}
            loading={transitioning}
          />
        </div>
      </CardContent>
      {footer && <CardFooter className="border-t pt-4">{footer}</CardFooter>}
    </Card>
  );
}
