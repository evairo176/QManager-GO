"use client";
import { motion, type Variants } from "motion/react";
import { SignalIcon, MoveUpRight } from "lucide-react";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { useTranslation } from "react-i18next";
import { PageHeader } from "@/components/page-header";
import { useModemStatus } from "@/hooks/use-modem-status";
import { detectRadioMode } from "./utils";
import { AntennaCard, AntennaCardSkeleton } from "./antenna-card";
import AlignmentMeterSection, { AlignmentMeterSkeleton } from "./alignment-meter";
// ---------------------------------------------------------------------------
// Legend
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Animation variants
// ---------------------------------------------------------------------------
const containerVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05 } },
};
const itemVariants: Variants = {
  hidden: { opacity: 0, y: 6 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.2, ease: "easeOut" },
  },
};
// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function AntennaAlignmentComponent() {
  const { t } = useTranslation("cellular");
  const { data, isLoading, isStale, error } = useModemStatus();
  const spa = data?.signal_per_antenna ?? null;
  const mode = spa ? detectRadioMode(spa) : null;
  return (
    <div className="@container/main mx-auto flex flex-col gap-6">
      {/* Static page header — never skeletoned; it doesn't depend on modem data */}
      <PageHeader
      icon={MoveUpRight}
      title={t("antennas.alignment.page.title")}
      description={t("antennas.alignment.page.description")}
    />
      {(error || isStale) && (
        <div
          role="alert"
          className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive mb-4"
        >
          {error
            ? t("antennas.alignment.error_warning")
            : t("antennas.alignment.stale_warning")}
        </div>
      )}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4">
          <AlignmentMeterSkeleton />
          <div className="grid grid-cols-1 gap-4 @3xl/main:grid-cols-2 @5xl/main:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <AntennaCardSkeleton key={i} />
            ))}
          </div>
        </div>
      ) : spa && mode ? (
        <div className="grid grid-cols-1 gap-4">
          <AlignmentMeterSection spa={spa} mode={mode} />
          <motion.div
            className="grid grid-cols-1 gap-4 @3xl/main:grid-cols-2 @5xl/main:grid-cols-4"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {[0, 1, 2, 3].map((index) => (
              <motion.div key={index} variants={itemVariants}>
                <AntennaCard index={index} spa={spa} mode={mode} />
              </motion.div>
            ))}
          </motion.div>
        </div>
      ) : (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SignalIcon />
            </EmptyMedia>
            <EmptyTitle>{t("antennas.alignment.empty_title")}</EmptyTitle>
            <EmptyDescription className="max-w-xs text-pretty">
              {t("antennas.alignment.empty_description")}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </div>
  );
}