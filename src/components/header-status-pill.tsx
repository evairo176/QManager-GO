"use client";

import React from "react";
import { useModemStatus } from "@/hooks/use-modem-status";
import { ModeToggle } from "@/components/public/mode-toggle";
import { Activity, Wifi } from "lucide-react";
import { cn } from "@/lib/utils";

export function HeaderStatusPill() {
  const { data, isLoading, isStale } = useModemStatus();

  const isOnline = data?.modem_reachable && !isStale;
  const networkType = data?.network?.type || "";
  const carrierName = data?.network?.carrier || "";

  return (
    <div className="flex items-center gap-2">
      {/* Live Connection Status Badge */}
      <div
        className={cn(
          "hidden sm:inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium border transition-all duration-300",
          isOnline
            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
            : isLoading
              ? "bg-muted text-muted-foreground border-border/60"
              : "bg-destructive/10 text-destructive border-destructive/20",
        )}
      >
        <span className="relative flex h-2 w-2">
          {isOnline && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          )}
          <span
            className={cn(
              "relative inline-flex rounded-full h-2 w-2",
              isOnline ? "bg-emerald-500" : isLoading ? "bg-amber-500" : "bg-destructive",
            )}
          />
        </span>
        <span className="font-mono tracking-tight font-semibold">
          {isOnline ? (networkType || "ONLINE") : isLoading ? "CONNECTING" : "OFFLINE"}
        </span>
        {isOnline && carrierName && (
          <span className="text-[11px] opacity-70 hidden md:inline max-w-[110px] truncate">
            {carrierName}
          </span>
        )}
      </div>

      {/* Theme Switcher Button */}
      <div className="flex items-center">
        <ModeToggle size="icon-sm" />
      </div>
    </div>
  );
}
