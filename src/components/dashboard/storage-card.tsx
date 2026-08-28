"use client";

import { useMemo } from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  TbAlertTriangleFilled,
  TbInfoCircleFilled,
  TbRefresh,
  TbDeviceFloppy,
} from "react-icons/tb";
import { useTranslation } from "react-i18next";
import {
  formatBytes,
  useStorage,
  type StorageMount,
} from "@/hooks/use-storage";

// Thresholds (percent used) for the color legend.
const THRESHOLD_WARN = 75; // yellow from 75%
const THRESHOLD_CRIT = 90; // red from 90%

function usageColor(pct: number): string {
  if (pct >= THRESHOLD_CRIT) return "bg-destructive";
  if (pct >= THRESHOLD_WARN) return "bg-amber-500";
  return "bg-emerald-500";
}

function usageTextColor(pct: number): string {
  if (pct >= THRESHOLD_CRIT) return "text-destructive";
  if (pct >= THRESHOLD_WARN) return "text-amber-500";
  return "text-emerald-500";
}

function StorageRow({ mount }: { mount: StorageMount }) {
  const reduce = useReducedMotion();
  const pct = Math.min(100, Math.max(0, mount.used_percent));
  const color = usageColor(pct);
  const t = useTranslation("dashboard").t;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2 text-sm">
        <div className="flex items-center gap-1.5">
          <span className="font-medium">{mount.label}</span>
          <span className="text-xs text-muted-foreground">
            {mount.mount_point}
          </span>
          {mount.read_only && (
            <Badge variant="outline" className="gap-1 text-[10px]">
              <TbInfoCircleFilled className="size-2.5" />
              {t("storage.read_only")}
            </Badge>
          )}
        </div>
        <span
          className={cn("font-mono text-xs font-semibold", usageTextColor(pct))}
        >
          {pct}%
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
        <motion.div
          className={cn("h-full rounded-full", color)}
          initial={reduce ? { width: 0 } : false}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span className="font-mono">
          {formatBytes(mount.used_bytes)}
          <span className="mx-1 opacity-50">/</span>
          {formatBytes(mount.total_bytes)}
        </span>
        <span className="font-mono">{formatBytes(mount.free_bytes)} free</span>
      </div>
    </div>
  );
}

function Legend() {
  const t = useTranslation("dashboard").t;
  const items = [
    { color: "bg-emerald-500", label: t("storage.legend_low") },
    { color: "bg-amber-500", label: t("storage.legend_medium") },
    { color: "bg-destructive", label: t("storage.legend_high") },
  ];
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-xs text-muted-foreground">
      {items.map((item) => (
        <span key={item.color} className="flex items-center gap-1.5">
          <span className={cn("inline-block h-2.5 w-2.5 rounded-full", item.color)} />
          {item.label}
        </span>
      ))}
    </div>
  );
}

export function StorageCard() {
  const { mounts, loading, error, refresh } = useStorage();
  const t = useTranslation("dashboard").t;

  const highest = useMemo(() => {
    return mounts.reduce<StorageMount | null>((acc, m) => {
      if (!acc || m.used_percent > acc.used_percent) return m;
      return acc;
    }, null);
  }, [mounts]);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-sm">
          <TbDeviceFloppy className="size-4 text-primary" />
          {t("storage.title")}
          {highest && highest.used_percent >= THRESHOLD_WARN && (
            <Badge
              variant={highest.used_percent >= THRESHOLD_CRIT ? "destructive" : "secondary"}
              className="gap-1"
            >
              <TbAlertTriangleFilled className="size-3" />
              {t("storage.high_usage")}
            </Badge>
          )}
        </CardTitle>
        <button
          type="button"
          onClick={() => void refresh()}
          className="text-muted-foreground transition-colors hover:text-foreground"
          aria-label={t("storage.refresh")}
        >
          <TbRefresh className="size-4" />
        </button>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {loading && mounts.length === 0 ? (
          <div className="flex flex-col gap-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <TbAlertTriangleFilled className="size-4" />
            {error}
          </div>
        ) : mounts.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <TbInfoCircleFilled className="size-4" />
            {t("storage.empty")}
          </div>
        ) : (
          <>
            {mounts.map((m) => (
              <StorageRow key={m.mount_point} mount={m} />
            ))}
            <Legend />
          </>
        )}
      </CardContent>
    </Card>
  );
}
