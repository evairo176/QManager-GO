"use client";

import { RefreshCcwIcon, ScanSearchIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

interface ScannerEmptyViewProps {
  onStartScan?: () => void;
}

const ScannerEmptyView = ({ onStartScan }: ScannerEmptyViewProps) => {
  const { t } = useTranslation("cellular");

  return (
    <Empty className="from-muted/50 to-background h-full bg-linear-to-b from-30%">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <ScanSearchIcon />
        </EmptyMedia>
        <EmptyTitle>{t("cell_scanner.scanner.empty_title")}</EmptyTitle>
        <EmptyDescription>
          {t("cell_scanner.scanner.empty_description")}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button onClick={onStartScan}>
          <RefreshCcwIcon />
          {t("cell_scanner.scanner.start_new_scan")}
        </Button>
      </EmptyContent>
    </Empty>
  );
};

export default ScannerEmptyView;
