"use client";

import { useTranslation } from "react-i18next";
import { ActivityIcon } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useRealtime } from "@/components/realtime-provider";
import { authFetch } from "@/lib/auth-fetch";

// =============================================================================
// RealtimeToggle — master switch for live data polling (sidebar footer).
// Turning it OFF stops every polling hook (refetchInterval → false), reducing
// modem AT-command traffic and CPU/RAM usage. The pref persists in the backend
// config and localStorage.
// =============================================================================

export function RealtimeToggle() {
  const { t } = useTranslation("common");
  const { enabled, setEnabled } = useRealtime();

  const handleChange = async (checked: boolean) => {
    setEnabled(checked);
    // Persist server-side; failure is non-fatal (local pref still applies).
    try {
      await authFetch("/cgi-bin/quecmanager/system/realtime.sh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: checked }),
      });
      toast.success(
        checked ? t("realtime.toast_on") : t("realtime.toast_off"),
        { duration: 2500 },
      );
    } catch {
      toast.error(t("realtime.toast_error"), { duration: 3500 });
    }
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          asChild
          className="data-[active=true]:bg-transparent data-[active=true]:font-medium"
        >
          <div className="flex w-full items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-2">
              <ActivityIcon className="size-4 shrink-0" />
              <span className="truncate">{t("realtime.live_data")}</span>
            </span>
            <Switch
              checked={enabled}
              onCheckedChange={handleChange}
              aria-label={t("realtime.live_data")}
            />
          </div>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
