"use client";

import * as React from "react";
import Image from "next/image";
import { ChevronsUpDown } from "lucide-react";
import { useTranslation } from "react-i18next";

import QManagerLogo from "@/public/qmanager-logo.svg";
import { authFetch } from "@/lib/auth-fetch";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

export function AppSwitcher() {
  const { t } = useTranslation("sidebar");
  const [open, setOpen] = React.useState(false);

  // Subtitle is the live device hostname (falls back to "Admin" until loaded).
  const [hostname, setHostname] = React.useState("Admin");

  React.useEffect(() => {
    authFetch("/cgi-bin/quecmanager/system/settings.sh")
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.settings?.hostname) {
          setHostname(json.settings.hostname);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <SidebarMenu>
      <Collapsible asChild open={open} onOpenChange={setOpen}>
        <SidebarMenuItem>
          <CollapsibleTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg">
                <Image
                  src={QManagerLogo}
                  alt=""
                  className="size-full"
                  priority
                />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">QManager</span>
                <span className="truncate text-xs text-muted-foreground">
                  {hostname}
                </span>
              </div>
              <ChevronsUpDown className="ml-auto size-4 text-muted-foreground" />
            </SidebarMenuButton>
          </CollapsibleTrigger>

          {/* LuCI link removed — this platform (Quectel systemd) has no OpenWrt
              LuCI installed; /cgi-bin/luci only opened a duplicate dashboard. */}
        </SidebarMenuItem>
      </Collapsible>
    </SidebarMenu>
  );
}
