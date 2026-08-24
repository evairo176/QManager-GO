"use client";

import { Fragment } from "react";
import { useTranslation } from "react-i18next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CircleArrowDownIcon, CircleArrowUpIcon } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import type { AmbrData } from "@/types/cellular-settings";
import { formatBitrate } from "@/types/cellular-settings";
import { TbInfoCircleFilled } from "react-icons/tb";

interface CellularAMBRCardProps {
  ambr: AmbrData | null;
  isLoading: boolean;
}

const CellularAMBRCard = ({ ambr, isLoading }: CellularAMBRCardProps) => {
  const { t } = useTranslation("cellular");

  if (isLoading) {
    return (
      <Card className="@container/card">
        <CardHeader>
          <CardTitle>{t("core_settings.basic.ambr.card.title")}</CardTitle>
          <CardDescription>
            {t("core_settings.basic.ambr.card.description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-y-6">
            <div className="grid gap-2">
              <Skeleton className="h-4 w-20" />
              <Separator />
              <Skeleton className="h-6 w-full" />
              <Separator />
              <Skeleton className="h-6 w-full" />
              <Separator />
            </div>
            <div className="grid gap-2">
              <Skeleton className="h-4 w-24" />
              <Separator />
              <Skeleton className="h-6 w-full" />
              <Separator />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>{t("core_settings.basic.ambr.card.title")}</CardTitle>
        <CardDescription>
          {t("core_settings.basic.ambr.card.description")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-y-6">
          {/* LTE AMBR Section */}
          <div className="grid gap-2">
            <div className="flex items-center gap-1.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" className="inline-flex" aria-label={t("core_settings.basic.ambr.tooltip.aria")}>
                    <TbInfoCircleFilled className="size-5 text-info" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="whitespace-pre-line">
                    {t("core_settings.basic.ambr.tooltip.content")}
                  </p>
                </TooltipContent>
              </Tooltip>
              <h2 className="font-semibold text-sm">{t("core_settings.basic.ambr.section.lte")}</h2>
            </div>

            <Separator />
            {ambr && ambr.lte.length > 0 ? (
              ambr.lte.map((entry, index) => (
                <Fragment key={`lte-${index}`}>
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-muted-foreground text-sm">
                      {entry.apn}
                    </p>
                    <div className="flex items-center gap-x-4">
                      <div className="flex items-center gap-x-1">
                        <CircleArrowDownIcon className="size-4 text-info" />
                        <p className="font-semibold text-sm">
                          {formatBitrate(entry.dl_kbps)}
                        </p>
                      </div>
                      <div className="flex items-center gap-x-1">
                        <CircleArrowUpIcon className="size-4 text-info" />
                        <p className="font-semibold text-sm">
                          {formatBitrate(entry.ul_kbps)}
                        </p>
                      </div>
                    </div>
                  </div>
                  <Separator />
                </Fragment>
              ))
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  {t("core_settings.basic.ambr.empty.lte")}
                </p>
                <Separator />
              </>
            )}
          </div>

          {/* NR5G AMBR Section */}
          <div className="grid gap-2">
            <div className="flex items-center gap-1.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" className="inline-flex" aria-label={t("core_settings.basic.ambr.tooltip.aria")}>
                    <TbInfoCircleFilled className="size-5 text-info" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="whitespace-pre-line">
                    {t("core_settings.basic.ambr.tooltip.content")}
                  </p>
                </TooltipContent>
              </Tooltip>
              <h2 className="font-semibold text-sm">{t("core_settings.basic.ambr.section.nr5g")}</h2>
            </div>
            <Separator />
            {ambr && ambr.nr5g.length > 0 ? (
              ambr.nr5g.map((entry, index) => (
                <Fragment key={`nr5g-${index}`}>
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-muted-foreground text-sm">
                      {entry.dnn}
                    </p>
                    <div className="flex items-center gap-x-4">
                      <div className="flex items-center gap-x-1">
                        <CircleArrowDownIcon className="size-4 text-info" />
                        <p className="font-semibold text-sm">
                          {formatBitrate(entry.dl_kbps)}
                        </p>
                      </div>
                      <div className="flex items-center gap-x-1">
                        <CircleArrowUpIcon className="size-4 text-info" />
                        <p className="font-semibold text-sm">
                          {formatBitrate(entry.ul_kbps)}
                        </p>
                      </div>
                    </div>
                  </div>
                  <Separator />
                </Fragment>
              ))
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  {t("core_settings.basic.ambr.empty.nr5g")}
                </p>
                <Separator />
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default CellularAMBRCard;
