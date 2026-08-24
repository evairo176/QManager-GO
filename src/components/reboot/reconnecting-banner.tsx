"use client";

import { AnimatePresence, motion } from "motion/react";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useConnectionStatus } from "@/lib/reboot/connection";

/**
 * Transient banner shown when the dashboard has missed a couple of consecutive
 * health checks but has not yet crossed the auto-logout threshold. Gives the
 * user a heads-up ("reconnecting…") instead of an abrupt logout. Driven by the
 * connection-status signal reported from use-auto-logout. Distinct from the
 * deferred pending-reboot banner, so the two never collide.
 */
export function ReconnectingBanner() {
  const { reconnecting } = useConnectionStatus();
  const { t } = useTranslation("common");

  return (
    <AnimatePresence>
      {reconnecting && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          role="status"
          aria-live="polite"
          className="mx-2 mb-2 flex items-center gap-2 rounded-md border border-warning/30 bg-warning/15 px-3 py-2 text-sm text-warning lg:mx-6"
        >
          <Loader2 className="size-3 animate-spin" />
          <span>{t("connection.reconnecting")}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
