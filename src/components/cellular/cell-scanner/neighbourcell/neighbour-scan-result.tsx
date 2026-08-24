"use client";

import * as React from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
  type Row,
} from "@tanstack/react-table";
import { ArrowUpDown, ChevronDown, LockIcon, MoreVertical } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { motion } from "motion/react";

const MotionTableRow = motion.create(TableRow);
import { Badge } from "@/components/ui/badge";
import { SignalBadge, NetworkTypeBadge } from "../signal-badges";

export interface NeighbourCellResult {
  id: string;
  networkType: string;
  cellType: string;
  frequency: number;
  pci: number;
  signalStrength: number;
  rsrq?: number | null;
  rssi?: number | null;
  sinr?: number | null;
}

interface NeighbourScanResultViewProps {
  data: NeighbourCellResult[];
  onLockCell?: (cell: NeighbourCellResult) => void;
}


function getColumns(
  t: TFunction,
  onLockCell?: (cell: NeighbourCellResult) => void,
): ColumnDef<NeighbourCellResult>[] {
  return [
    {
      accessorKey: "networkType",
      header: () => (
        <div className="pl-4">
          {t("cell_scanner.neighbour.column_headers.network")}
        </div>
      ),
      cell: ({ row }) => (
        <div className="pl-4">
          <NetworkTypeBadge type={row.getValue("networkType")} />
        </div>
      ),
    },
    {
      accessorKey: "cellType",
      header: t("cell_scanner.neighbour.column_headers.cell_type"),
      cell: ({ row }) => (
        <div className="font-medium">{row.getValue("cellType")}</div>
      ),
    },
    {
      accessorKey: "frequency",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          {t("cell_scanner.neighbour.column_headers.frequency")}
          <ArrowUpDown className="size-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const freq = row.getValue("frequency") as number;
        return <div className="font-semibold">{freq === 0 ? "-" : freq}</div>;
      },
    },
    {
      accessorKey: "pci",
      header: t("cell_scanner.neighbour.column_headers.pci"),
      cell: ({ row }) => {
        const pci = row.getValue("pci") as number;
        return <div className="font-semibold">{pci === 0 ? "-" : pci}</div>;
      },
    },
    {
      accessorKey: "signalStrength",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          {t("cell_scanner.neighbour.column_headers.signal")}
          <ArrowUpDown className="size-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const strength = row.getValue("signalStrength") as number;
        if (strength === 0) {
          return (
            <Badge className="bg-warning/15 text-warning hover:bg-warning/20 border-warning/30">
              {t("cell_scanner.signal_badge.no_data")}
            </Badge>
          );
        }
        return (
          <div className="flex items-center gap-2">
            <SignalBadge strength={strength} />
            <span className="font-semibold">{strength} dBm</span>
          </div>
        );
      },
    },
    {
      id: "actions",
      header: () => null,
      enableHiding: false,
      cell: ({ row }: { row: Row<NeighbourCellResult> }) => {
        const cellData = row.original;
        // Only LTE cells can be locked — NR5G lacks required scs/band params
        if (cellData.networkType !== "LTE") return null;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="data-[state=open]:bg-muted text-muted-foreground flex size-8"
                size="icon"
              >
                <MoreVertical className="size-4" />
                <span className="sr-only">
                  {t("cell_scanner.result_table.open_menu")}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={() => onLockCell?.(cellData)}>
                <LockIcon className="size-4" />
                {t("cell_scanner.result_table.lock_cell")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];
}

const NeighbourScanResultView = ({
  data,
  onLockCell,
}: NeighbourScanResultViewProps) => {
  const { t } = useTranslation("cellular");
  // Only animate rows on initial mount — skip on sort/filter/page changes
  const hasAnimated = React.useRef(false);
  React.useEffect(() => { hasAnimated.current = true; }, []);
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    [],
  );
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const columns = React.useMemo(() => getColumns(t, onLockCell), [t, onLockCell]);

  const columnLabels = React.useMemo<Record<string, string>>(() => ({
    networkType: t("cell_scanner.neighbour.column_headers.network"),
    cellType: t("cell_scanner.neighbour.column_headers.cell_type"),
    frequency: t("cell_scanner.neighbour.column_headers.frequency"),
    pci: t("cell_scanner.neighbour.column_headers.pci"),
    signalStrength: t("cell_scanner.neighbour.column_headers.signal"),
  }), [t]);

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
    },
  });

  return (
    <div className="relative flex flex-col gap-4 overflow-hidden">
      <div className="flex flex-col @sm/card:flex-row items-start @sm/card:items-center gap-2">
        <Input
          placeholder={t("cell_scanner.neighbour.filter_placeholder")}
          value={
            (table.getColumn("cellType")?.getFilterValue() as string) ?? ""
          }
          onChange={(event) =>
            table.getColumn("cellType")?.setFilterValue(event.target.value)
          }
          className="w-full @sm/card:max-w-sm"
        />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="@sm/card:ml-auto">
              {t("cell_scanner.result_table.columns_button")}{" "}
              <ChevronDown className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {table
              .getAllColumns()
              .filter((column) => column.getCanHide())
              .map((column) => {
                return (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) =>
                      column.toggleVisibility(!!value)
                    }
                  >
                    {columnLabels[column.id] ?? column.id}
                  </DropdownMenuCheckboxItem>
                );
              })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <Table className="min-w-[600px]">
          <TableHeader className="bg-muted sticky top-0 z-10">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row, index) => (
                <MotionTableRow
                  key={row.id}
                  initial={hasAnimated.current ? false : { opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={hasAnimated.current ? undefined : { duration: 0.2, delay: Math.min(index * 0.05, 0.4), ease: "easeOut" }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </MotionTableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  {t("cell_scanner.result_table.empty_row")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-col @sm/card:flex-row @sm/card:items-center gap-2 py-4">
        <div className="text-muted-foreground @sm/card:flex-1 text-sm">
          {t("cell_scanner.neighbour.footer_count", {
            count: table.getFilteredRowModel().rows.length,
          })}
        </div>
        <div className="flex gap-2 @sm/card:ml-auto">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 @sm/card:flex-none @max-sm/card:min-h-11"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            {t("cell_scanner.result_table.previous")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 @sm/card:flex-none @max-sm/card:min-h-11"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            {t("cell_scanner.result_table.next")}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NeighbourScanResultView;
