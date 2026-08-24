"use client";

import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { motion } from "motion/react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const MotionTableRow = motion.create(TableRow);

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { RefreshCcwIcon, UsersIcon, ShieldIcon, AlertCircle, CheckCircle2Icon, MinusCircleIcon } from "lucide-react";
import type { TailscaleStatus, TailscalePeer } from "@/hooks/use-tailscale";

// =============================================================================
// TailscalePeersCard — Peer list table for Tailscale network
// =============================================================================

interface TailscalePeersCardProps {
  status: TailscaleStatus | null;
  isLoading: boolean;
  error?: string | null;
  refresh?: () => void;
}

function formatLastSeen(lastSeen: string, online: boolean, t: TFunction): string {
  if (online) return t("time.now", { ns: "common" });
  if (!lastSeen) return t("time.unknown", { ns: "common" });

  const date = new Date(lastSeen);
  const now = Date.now();
  const diffMs = now - date.getTime();

  if (diffMs < 0 || isNaN(diffMs)) return lastSeen;

  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return t("time.just_now", { ns: "common" });
  if (diffMin < 60) return t("time.minutes_ago", { ns: "common", count: diffMin });

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return t("time.hours_ago", { ns: "common", count: diffHr });

  const diffDay = Math.floor(diffHr / 24);
  return t("time.days_ago", { ns: "common", count: diffDay });
}

function capitalizeOS(os: string, t: TFunction): string {
  if (!os) return t("shared.os_unknown", { ns: "monitoring" });
  const map: Record<string, string> = {
    linux: t("shared.os_linux", { ns: "monitoring" }),
    windows: t("shared.os_windows", { ns: "monitoring" }),
    macos: t("shared.os_macos", { ns: "monitoring" }),
    darwin: t("shared.os_macos", { ns: "monitoring" }),
    ios: t("shared.os_ios", { ns: "monitoring" }),
    android: t("shared.os_android", { ns: "monitoring" }),
    freebsd: t("shared.os_freebsd", { ns: "monitoring" }),
  };
  return map[os.toLowerCase()] || os.charAt(0).toUpperCase() + os.slice(1);
}

export function TailscalePeersCard({
  status,
  isLoading,
  error,
  refresh,
}: TailscalePeersCardProps) {
  const { t } = useTranslation("monitoring");
  const isConnected = status?.backend_state === "Running";
  const peers: TailscalePeer[] = (isConnected && status?.peers) || [];
  const hasExitNode = peers.some((p) => p.exit_node);

  // --- Loading skeleton ------------------------------------------------------
  if (isLoading) {
    return (
      <Card className="@container/card">
        <CardHeader>
          <CardTitle>{t("tailscale.peers_title")}</CardTitle>
          <CardDescription>
            {t("tailscale.peers_description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <div className="border-b px-4 py-3">
              <div className="flex gap-4">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-14" />
                <Skeleton className="h-4 w-16" />
              </div>
            </div>
            <div className="divide-y">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-4 py-3">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-5 w-14 rounded-full" />
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // --- Error state (fetch failed, no data) ------------------------------------
  if (!isLoading && error && !status) {
    return (
      <Card className="@container/card">
        <CardHeader>
          <CardTitle>{t("tailscale.peers_title")}</CardTitle>
          <CardDescription>
            {t("tailscale.peers_description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <AlertCircle className="size-10 text-destructive" />
            <p className="text-sm text-muted-foreground text-center">
              {t("tailscale.peers_error_load")}
            </p>
            {refresh && (
              <Button variant="outline" size="sm" onClick={refresh}>
                <RefreshCcwIcon className="size-3.5" />
                {t("actions.retry", { ns: "common" })}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // --- Empty / not connected state -------------------------------------------
  if (!isConnected || peers.length === 0) {
    const message = !isConnected
      ? t("tailscale.peers_not_connected_message")
      : t("tailscale.peers_no_peers_message");

    return (
      <Card className="@container/card">
        <CardHeader>
          <CardTitle>{t("tailscale.peers_title")}</CardTitle>
          <CardDescription>
            {t("tailscale.peers_description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <UsersIcon className="size-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground text-center">
              {message}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // --- Peer table ------------------------------------------------------------
  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>{t("tailscale.peers_title")}</CardTitle>
        <CardDescription>
          {t("tailscale.peers_description")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("tailscale.peers_header_name")}</TableHead>
                <TableHead>{t("tailscale.peers_header_ip")}</TableHead>
                <TableHead className="hidden @sm/card:table-cell">{t("tailscale.peers_header_os")}</TableHead>
                <TableHead className="w-20">{t("tailscale.peers_header_status")}</TableHead>
                <TableHead className="hidden @md/card:table-cell w-24">
                  {t("tailscale.peers_header_last_seen")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody aria-live="polite">
              {peers.map((peer, i) => (
                <MotionTableRow
                  key={`${peer.hostname}-${peer.tailscale_ips?.[0] ?? i}`}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2, delay: Math.min(i * 0.05, 0.4), ease: "easeOut" }}
                >
                  <TableCell className="max-w-48">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-sm truncate">
                          {peer.hostname || t("shared.os_unknown")}
                        </span>
                        {peer.exit_node && (
                          <Badge
                            variant="outline"
                            className="text-xs shrink-0"
                          >
                            <ShieldIcon className="size-3 mr-1" />
                            {t("tailscale.peers_exit_node_badge")}
                          </Badge>
                        )}
                      </div>
                      {peer.dns_name && (
                        <span className="block text-xs text-muted-foreground truncate">
                          {peer.dns_name.replace(/\.$/, "")}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {peer.tailscale_ips?.[0] || "—"}
                  </TableCell>
                  <TableCell className="hidden @sm/card:table-cell text-sm">
                    {capitalizeOS(peer.os, t)}
                  </TableCell>
                  <TableCell>
                    {peer.online ? (
                      <Badge variant="outline" className="bg-success/15 text-success hover:bg-success/20 border-success/30">
                        <CheckCircle2Icon className="h-3 w-3" />
                        {t("tailscale.peers_status_online")}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-muted/50 text-muted-foreground border-muted-foreground/30">
                        <MinusCircleIcon className="h-3 w-3" />
                        {t("tailscale.peers_status_offline")}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="hidden @md/card:table-cell text-xs text-muted-foreground">
                    {formatLastSeen(peer.last_seen, peer.online, t)}
                  </TableCell>
                </MotionTableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between items-center">
        <div className="text-xs text-muted-foreground">
          {t("tailscale.peers_showing_count", {
            count: peers.length,
            total: peers.length,
          })}
        </div>
        {hasExitNode && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <ShieldIcon className="size-3" />
            {t("tailscale.peers_exit_node_active")}
          </div>
        )}
      </CardFooter>
    </Card>
  );
}
