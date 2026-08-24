"use client";

import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Gauge, ArrowDown, ArrowUp, Activity, Play, RefreshCw } from "lucide-react";
import { authFetch } from "@/lib/auth-fetch";
import { toast } from "sonner";

export interface NativeSpeedTestResult {
  ping_latency_ms: number;
  jitter_ms: number;
  download_mbps: number;
  upload_mbps: number;
  server_host: string;
  timestamp: number;
  status: string;
}

export function SpeedtestCard() {
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<NativeSpeedTestResult | null>(null);

  const runTest = async () => {
    setIsRunning(true);
    toast.info("Starting speedtest check...");

    try {
      const res = await authFetch("/cgi-bin/quecmanager/network/speedtest.sh", {
        method: "POST",
      });

      if (!res.ok) {
        throw new Error("Speedtest request failed");
      }

      const data: NativeSpeedTestResult = await res.json();
      setResult(data);
      toast.success("Speedtest complete!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Speedtest failed");
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-lg font-semibold flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Gauge className="size-5 text-primary" />
            Network Speedtest
          </span>
          <Button
            size="sm"
            onClick={runTest}
            disabled={isRunning}
            className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {isRunning ? (
              <>
                <RefreshCw className="size-4 animate-spin" />
                Testing...
              </>
            ) : (
              <>
                <Play className="size-4" />
                Start Test
              </>
            )}
          </Button>
        </CardTitle>
        <CardDescription>
          Run a native latency, download, and upload throughput test directly from the modem.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 rounded-lg bg-muted/40 border flex flex-col gap-1">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Activity className="size-3 text-emerald-500" /> Ping
            </span>
            <span className="text-2xl font-bold tracking-tight tabular-nums">
              {result ? `${result.ping_latency_ms.toFixed(1)} ms` : "--"}
            </span>
          </div>

          <div className="p-4 rounded-lg bg-muted/40 border flex flex-col gap-1">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Activity className="size-3 text-amber-500" /> Jitter
            </span>
            <span className="text-2xl font-bold tracking-tight tabular-nums">
              {result ? `${result.jitter_ms.toFixed(1)} ms` : "--"}
            </span>
          </div>

          <div className="p-4 rounded-lg bg-muted/40 border flex flex-col gap-1">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <ArrowDown className="size-3 text-blue-500" /> Download
            </span>
            <span className="text-2xl font-bold tracking-tight text-blue-500 tabular-nums">
              {result ? `${result.download_mbps.toFixed(2)} Mbps` : "--"}
            </span>
          </div>

          <div className="p-4 rounded-lg bg-muted/40 border flex flex-col gap-1">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <ArrowUp className="size-3 text-indigo-500" /> Upload
            </span>
            <span className="text-2xl font-bold tracking-tight text-indigo-500 tabular-nums">
              {result ? `${result.upload_mbps.toFixed(2)} Mbps` : "--"}
            </span>
          </div>
        </div>

        {result && (
          <div className="mt-4 text-xs text-muted-foreground flex justify-between items-center border-t pt-3">
            <span>Server: {result.server_host}</span>
            <span>Last Run: {new Date(result.timestamp * 1000).toLocaleTimeString()}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
