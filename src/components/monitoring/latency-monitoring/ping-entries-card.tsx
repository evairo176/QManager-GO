"use client";

import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "motion/react";
import {
  Card,
  CardContent,
  CardDescription,
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

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ArrowUpDown } from "lucide-react";

// =============================================================================
// Types
// =============================================================================

export interface PingEntry {
  timestamp: number;
  latency: number;
  packet_loss: number;
  ok: boolean;
}

type SortOrder = "newest" | "oldest";

interface PingEntriesCardProps {
  entries: PingEntry[];
  emptyMessage: string;
  isRealtime: boolean;
}

// =============================================================================
// Component
// =============================================================================

const PingEntriesCard = ({
  entries,
  emptyMessage,
  isRealtime,
}: PingEntriesCardProps) => {
  const { t } = useTranslation("monitoring");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");

  const sortedEntries = useMemo(
    () => (sortOrder === "newest" ? entries.toReversed() : entries),
    [entries, sortOrder],
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{t("latency.entries_title")}</CardTitle>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 gap-1">
                <ArrowUpDown className="h-3.5 w-3.5" />
                <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                  {t("latency.entries_sort_button")}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{t("latency.entries_sort_label")}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={sortOrder === "newest"}
                onCheckedChange={() => setSortOrder("newest")}
              >
                {t("latency.entries_sort_newest")}
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={sortOrder === "oldest"}
                onCheckedChange={() => setSortOrder("oldest")}
              >
                {t("latency.entries_sort_oldest")}
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <CardDescription>
          {t("latency.entries_description")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("latency.entries_header_latency")}</TableHead>
              <TableHead>{t("latency.entries_header_packet_loss")}</TableHead>
              <TableHead>{t("latency.entries_header_date")}</TableHead>
              <TableHead>{t("latency.entries_header_time")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedEntries.length > 0 ? (
              sortedEntries.map((ping, index) => (
                <MotionTableRow
                  key={ping.timestamp}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2, delay: Math.min(index * 0.04, 0.4), ease: "easeOut" }}
                >
                  <TableCell>
                    {isRealtime && !ping.ok
                      ? t("latency.entries_cell_timeout")
                      : `${ping.latency} ms`}
                  </TableCell>
                  <TableCell>{ping.packet_loss}%</TableCell>
                  <TableCell>
                    {new Date(ping.timestamp).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </TableCell>
                  <TableCell>
                    {new Date(ping.timestamp).toLocaleTimeString(undefined, {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                      hour12: false,
                    })}
                  </TableCell>
                </MotionTableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4} className="text-center">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default PingEntriesCard;
