"use client";

import * as React from "react";
import Image from "next/image";
import { ChevronsUpDown, ExternalLink } from "lucide-react";
import { useTranslation } from "react-i18next";

import QManagerLogo from "@/public/qmanager-logo.svg";
import OpenWrtLogo from "@/public/openwrt.svg";
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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
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

          <CollapsibleContent>
            <SidebarMenuSub>
              {/* LuCI — opens the advanced OpenWRT UI in a new tab */}
              <SidebarMenuSubItem>
                <SidebarMenuSubButton asChild>
                  <a
                    href="/cgi-bin/luci"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Image
                      src={OpenWrtLogo}
                      alt=""
                      className="size-4 shrink-0"
                    />
                    <span>{t("items.luci")}</span>
                    <span className="ml-auto inline-flex">
                      <ExternalLink
                        className="size-3.5 text-muted-foreground"
                        aria-label={t("switcher.opens_new_tab")}
                      />
                    </span>
                  </a>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            </SidebarMenuSub>
          </CollapsibleContent>
        </SidebarMenuItem>
      </Collapsible>
    </SidebarMenu>
  );
}
