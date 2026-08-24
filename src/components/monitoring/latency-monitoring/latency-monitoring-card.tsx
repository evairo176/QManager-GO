"use client";

import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "motion/react";
import { BarChart, CartesianGrid, XAxis, Bar } from "recharts";
import { useModemStatus } from "@/hooks/use-modem-status";
import { useLatencyHistory } from "@/hooks/use-latency-history";
import type { PingHistoryEntry } from "@/types/modem-status";
import type { PingEntry } from "./ping-entries-card";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

// =============================================================================
// Types
// =============================================================================

type ViewMode = "realtime" | "hourly" | "twelvehour" | "daily";

interface RealtimeDataPoint {
  timestamp: number;
  latency: number;
  packet_loss: number;
  ok: boolean;
}

interface AggregatedDataPoint {
  timestamp: number;
  latency: number;
  packet_loss: number;
  sampleCount: number;
}

interface ChartDataPoint {
  timestamp: number;
  latency: number;
  packet_loss: number;
}

/** Max entries shown in the chart and table for real-time view */
const REALTIME_LIMIT = 10;

// =============================================================================
// Helper Functions
// =============================================================================

function buildRealtimeData(
  history: (number | null)[],
  intervalSec: number,
  historySize: number,
): RealtimeDataPoint[] {
  const now = Date.now();
  return history.map((value, i) => {
    const timestamp = now - (historySize - i - 1) * intervalSec * 1000;
    if (value === null) {
      return { timestamp, latency: 0, packet_loss: 100, ok: false };
    }
    return { timestamp, latency: value, packet_loss: 0, ok: true };
  });
}

function aggregateByBucket(
  entries: PingHistoryEntry[],
  bucketMs: number,
): AggregatedDataPoint[] {
  if (entries.length === 0) return [];

  const buckets = new Map<
    number,
    { sumLat: number; countLat: number; countNull: number; total: number }
  >();

  for (const entry of entries) {
    const ts = entry.ts * 1000;
    const bucketStart = Math.floor(ts / bucketMs) * bucketMs;

    let bucket = buckets.get(bucketStart);
    if (!bucket) {
      bucket = { sumLat: 0, countLat: 0, countNull: 0, total: 0 };
      buckets.set(bucketStart, bucket);
    }

    bucket.total++;
    if (entry.lat === null) {
      bucket.countNull++;
    } else {
      bucket.sumLat += entry.lat;
      bucket.countLat++;
    }
  }

  const result: AggregatedDataPoint[] = [];
  for (const [timestamp, bucket] of buckets) {
    result.push({
      timestamp,
      latency:
        bucket.countLat > 0
          ? Math.round((bucket.sumLat / bucket.countLat) * 10) / 10
          : 0,
      packet_loss:
        bucket.total > 0
          ? Math.round((bucket.countNull / bucket.total) * 100 * 10) / 10
          : 0,
      sampleCount: bucket.total,
    });
  }

  result.sort((a, b) => a.timestamp - b.timestamp);
  return result;
}

function computeTotals(data: ChartDataPoint[]): {
  latency: number;
  packet_loss: number;
} {
  if (data.length === 0) return { latency: 0, packet_loss: 0 };

  const sumLat = data.reduce((acc, d) => acc + d.latency, 0);
  const sumLoss = data.reduce((acc, d) => acc + d.packet_loss, 0);

  return {
    latency: Math.round((sumLat / data.length) * 10) / 10,
    packet_loss: Math.round((sumLoss / data.length) * 10) / 10,
  };
}

// =============================================================================
// Hook: useLatencyMonitoring
// =============================================================================
// Exposes table entries + metadata so the parent can pass them to PingEntriesCard.

export interface LatencyMonitoringData {
  entries: PingEntry[];
  emptyMessage: string;
  isRealtime: boolean;
}

export function useLatencyMonitoring() {
  const { t } = useTranslation("monitoring");
  const [viewMode, setViewMode] = useState<ViewMode>("realtime");

  const { data: modemStatus } = useModemStatus({ pollInterval: 5000 });
  const { data: pingHistory } = useLatencyHistory({
    enabled: viewMode !== "realtime",
  });

  const emptyMessages = useMemo<Record<ViewMode, string>>(
    () => ({
      realtime: t("latency.empty_realtime"),
      hourly: t("latency.empty_hourly"),
      twelvehour: t("latency.empty_12hour"),
      daily: t("latency.empty_daily"),
    }),
    [t],
  );

  const realtimeData = useMemo<RealtimeDataPoint[]>(() => {
    if (!modemStatus?.connectivity) return [];
    const { latency_history, history_interval_sec, history_size } =
      modemStatus.connectivity;
    if (!latency_history || latency_history.length === 0) return [];
    return buildRealtimeData(
      latency_history,
      history_interval_sec,
      history_size,
    );
  }, [modemStatus?.connectivity]);

  const hourlyData = useMemo(
    () => aggregateByBucket(pingHistory, 3_600_000),
    [pingHistory],
  );
  const twelveHourData = useMemo(
    () => aggregateByBucket(pingHistory, 43_200_000),
    [pingHistory],
  );
  const dailyData = useMemo(
    () => aggregateByBucket(pingHistory, 86_400_000),
    [pingHistory],
  );

  const chartData = useMemo<ChartDataPoint[]>(() => {
    switch (viewMode) {
      case "realtime":
        return realtimeData.slice(-REALTIME_LIMIT).map((d) => ({
          timestamp: d.timestamp,
          latency: d.latency,
          packet_loss: d.packet_loss,
        }));
      case "hourly":
        return hourlyData;
      case "twelvehour":
        return twelveHourData;
      case "daily":
        return dailyData;
      default:
        return [];
    }
  }, [viewMode, realtimeData, hourlyData, twelveHourData, dailyData]);

  const total = useMemo(() => {
    if (viewMode === "realtime" && modemStatus?.connectivity) {
      return {
        latency: modemStatus.connectivity.avg_latency_ms ?? 0,
        packet_loss: modemStatus.connectivity.packet_loss_pct,
      };
    }
    return computeTotals(chartData);
  }, [viewMode, modemStatus?.connectivity, chartData]);

  // Build table entries with uniform PingEntry shape
  const tableData = useMemo<LatencyMonitoringData>(() => {
    const isRealtime = viewMode === "realtime";

    let entries: PingEntry[];
    if (isRealtime) {
      // Take the most recent N entries
      entries = realtimeData.slice(-REALTIME_LIMIT);
    } else {
      const source =
        viewMode === "hourly"
          ? hourlyData
          : viewMode === "twelvehour"
            ? twelveHourData
            : dailyData;
      entries = source.map((d) => ({
        timestamp: d.timestamp,
        latency: d.latency,
        packet_loss: d.packet_loss,
        ok: true,
      }));
    }

    return {
      entries,
      emptyMessage: emptyMessages[viewMode],
      isRealtime,
    };
  }, [viewMode, realtimeData, hourlyData, twelveHourData, dailyData, emptyMessages]);

  return { viewMode, setViewMode, chartData, total, tableData };
}

// =============================================================================
// Chart Card Component
// =============================================================================

interface LatencyMonitoringCardProps {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  chartData: ChartDataPoint[];
  total: { latency: number; packet_loss: number };
}

const LatencyMonitoringCard = ({
  viewMode,
  setViewMode,
  chartData,
  total,
}: LatencyMonitoringCardProps) => {
  const { t } = useTranslation("monitoring");
  const [activeChart, setActiveChart] = useState<"latency" | "packet_loss">(
    "latency",
  );

  const chartConfig = useMemo<ChartConfig>(
    () => ({
      latency: {
        label: t("latency.chart_label_latency"),
        color: "var(--chart-3)",
      },
      packet_loss: {
        label: t("latency.chart_label_packet_loss"),
        color: "var(--chart-6)",
      },
    }),
    [t],
  );

  const viewInfo = useMemo<Record<ViewMode, string>>(
    () => ({
      realtime: t("latency.view_info_realtime"),
      hourly: t("latency.view_info_hourly"),
      twelvehour: t("latency.view_info_12hour"),
      daily: t("latency.view_info_daily"),
    }),
    [t],
  );

  return (
    <Card>
      <CardHeader className="flex flex-col items-stretch border-b p-0 sm:flex-row">
        <div className="flex flex-1 flex-col justify-center gap-1 px-6 pt-4 pb-3 sm:py-6">
          <CardTitle>{t("latency.card_title")}</CardTitle>
          <CardDescription>{viewInfo[viewMode]}</CardDescription>
        </div>
        <div className="flex">
          {(["latency", "packet_loss"] as const).map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={activeChart === key}
              aria-label={`${t("latency.card_title")} — ${chartConfig[key].label}`}
              data-active={activeChart === key}
              className="data-[active=true]:bg-muted/50 relative z-30 flex flex-1 flex-col justify-center gap-1 border-t px-6 py-4 text-left even:border-l sm:border-t-0 sm:border-l sm:px-8 sm:py-6"
              onClick={() => setActiveChart(key)}
            >
              <span className="text-muted-foreground text-xs">
                {chartConfig[key].label}
              </span>
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={Math.round(total[key])}
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 5 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  className="text-base leading-none font-bold sm:text-3xl tabular-nums"
                >
                  {total[key].toLocaleString()}
                  {key === "latency" ? "ms" : "%"}
                </motion.span>
              </AnimatePresence>
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:p-6">
        <Tabs
          defaultValue="realtime"
          onValueChange={(value) => setViewMode(value as ViewMode)}
        >
          <TabsList>
            <TabsTrigger value="realtime">{t("latency.tab_realtime")}</TabsTrigger>
            <TabsTrigger value="hourly">{t("latency.tab_hourly")}</TabsTrigger>
            <TabsTrigger value="twelvehour">{t("latency.tab_12hour")}</TabsTrigger>
            <TabsTrigger value="daily">{t("latency.tab_daily")}</TabsTrigger>
          </TabsList>
        </Tabs>
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[250px] w-full mt-4"
        >
          <BarChart
            accessibilityLayer
            data={chartData}
            margin={{ left: 12, right: 12 }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="timestamp"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={16}
              tickFormatter={(value) => {
                const date = new Date(value);
                if (viewMode === "realtime") {
                  return date.toLocaleTimeString(undefined, {
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                } else if (viewMode === "hourly" || viewMode === "twelvehour") {
                  return date.toLocaleTimeString(undefined, {
                    hour: "2-digit",
                  });
                } else {
                  return date.toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  });
                }
              }}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  className="min-w-[180px] w-auto"
                  labelFormatter={(_value, payload) => {
                    const ts = payload?.[0]?.payload?.timestamp;
                    if (!ts) return "";
                    if (viewMode === "daily") {
                      return new Date(ts).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      });
                    }
                    return new Date(ts).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    });
                  }}
                />
              }
            />
            <Bar
              dataKey={activeChart}
              fill={`var(--color-${activeChart})`}
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};

export default LatencyMonitoringCard;
