"use client";

import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { authFetch } from "@/lib/auth-fetch";
import { resolveErrorMessage } from "@/lib/i18n/resolve-error";

import { Card, CardContent } from "@/components/ui/card";

import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  DownloadIcon,
  LoaderCircleIcon,
  RefreshCcwIcon,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { downloadCSV } from "@/lib/download-csv";
import { ScanningView } from "@/components/cellular/cell-scanner/scanning-view";
import ScannerEmptyView from "@/components/cellular/cell-scanner/empty-view";
import NeighbourScanResultView, {
  type NeighbourCellResult,
} from "./neighbour-scan-result";
import { useNeighbourScanner } from "@/hooks/use-neighbour-scanner";

// --- CSV row builder for neighbour scan results ------------------------------
function buildCsvRows(results: NeighbourCellResult[]): string[] {
  return results.map((r) =>
    [
      r.networkType,
      r.cellType,
      r.frequency,
      r.pci,
      r.signalStrength,
      r.rsrq ?? "",
      r.rssi ?? "",
      r.sinr ?? "",
    ].join(","),
  );
}

const NEIGHBOUR_CSV_HEADER =
  "Network,Cell Type,Frequency,PCI,Signal (dBm),RSRQ,RSSI,SINR";

const NeighbourCellScanner = () => {
  const { t } = useTranslation("cellular");
  const { status, results, error, elapsedSeconds, startScan } = useNeighbourScanner();
  const [lockTarget, setLockTarget] = useState<NeighbourCellResult | null>(
    null,
  );
  const [isLocking, setIsLocking] = useState(false);

  const hasScanResults = status === "complete" && results.length > 0;
  const isScanning = status === "running";

  // --- Lock Cell Handler -----------------------------------------------------
  const handleLockCell = useCallback((cell: NeighbourCellResult) => {
    setLockTarget(cell);
  }, []);

  const confirmLockCell = useCallback(async () => {
    if (!lockTarget) return;
    setIsLocking(true);

    try {
      const body = {
        type: "lte",
        action: "lock",
        cells: [{ earfcn: lockTarget.frequency, pci: lockTarget.pci }],
      };

      const res = await authFetch("/cgi-bin/quecmanager/tower/lock.sh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (data.success) {
        toast.success(t("cell_scanner.toast.lock_success_title"), {
          description: t("cell_scanner.neighbour.toast_lock_success_description", {
            pci: lockTarget.pci,
            earfcn: lockTarget.frequency,
          }),
        });
      } else {
        toast.error(t("cell_scanner.toast.lock_error_title"), {
          description: resolveErrorMessage(t, data.error, data.detail, t("cell_scanner.toast.lock_error_unknown")),
        });
      }
    } catch {
      toast.error(t("cell_scanner.toast.lock_error_title"), {
        description: t("cell_scanner.toast.lock_error_connection"),
      });
    } finally {
      setIsLocking(false);
      setLockTarget(null);
    }
  }, [lockTarget, t]);

  return (
    <>
      <Card className="@container/card">
        <CardContent className="pt-6">
          <div className="grid gap-4">
            {hasScanResults ? (
              <NeighbourScanResultView
                data={results}
                onLockCell={handleLockCell}
              />
            ) : isScanning ? (
              <ScanningView elapsedSeconds={elapsedSeconds} />
            ) : status === "error" ? (
              <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
                <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
                  <AlertCircle className="size-5 text-destructive" />
                </div>
                <div className="max-w-xs space-y-1">
                  <p className="text-sm font-medium text-foreground">
                    {error || t("cell_scanner.scanner.error_fallback")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("cell_scanner.scanner.error_description")}
                  </p>
                </div>
                <Button onClick={startScan} variant="outline" size="sm">
                  <RefreshCcwIcon className="size-4" />
                  {t("cell_scanner.scanner.retry_scan")}
                </Button>
              </div>
            ) : (
              <ScannerEmptyView onStartScan={startScan} />
            )}
          </div>
          {(hasScanResults || isScanning) && (
            <div className="mt-4 flex items-center gap-x-2">
              <Button onClick={startScan} disabled={isScanning}>
                {isScanning
                  ? t("cell_scanner.scanner.scanning")
                  : t("cell_scanner.scanner.start_new_scan")}
              </Button>
              {hasScanResults && (
                <Button
                  variant="outline"
                  onClick={() =>
                    downloadCSV(
                      NEIGHBOUR_CSV_HEADER,
                      buildCsvRows(results),
                      `neighbour_scan_${new Date().toISOString().slice(0, 10)}.csv`,
                    )
                  }
                  aria-label={t("cell_scanner.scanner.download_csv_aria")}
                >
                  <DownloadIcon />
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lock confirmation dialog */}
      <AlertDialog
        open={!!lockTarget}
        onOpenChange={(open) => !open && !isLocking && setLockTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("cell_scanner.lock_dialog.title")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("cell_scanner.lock_dialog.description")}
            </AlertDialogDescription>
            {lockTarget && (
              <p className="font-mono text-xs text-muted-foreground">
                {lockTarget.networkType} — PCI {lockTarget.pci}, EARFCN{" "}
                {lockTarget.frequency}
              </p>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLocking}>
              {t("actions.cancel", { ns: "common" })}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmLockCell();
              }}
              disabled={isLocking}
            >
              {isLocking ? (
                <>
                  <LoaderCircleIcon className="size-4 animate-spin" />
                  {t("cell_scanner.lock_dialog.locking")}
                </>
              ) : (
                t("cell_scanner.lock_dialog.confirm")
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default NeighbourCellScanner;
