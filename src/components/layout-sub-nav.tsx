"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  RadioTower,
  Signal,
  Compass,
  Scan,
  Lock,
  User,
  MessageCircle,
  Settings,
  Activity,
  ShieldAlert,
  LineChart,
  Bell,
  Bird,
  Network,
  Globe,
  Cpu,
  ArrowRightLeft,
  EyeOff,
  Sliders,
  Languages,
  Database,
  Gauge,
  RefreshCw,
  BarChart3,
  FileText,
  Download,
  Terminal,
  type LucideIcon,
} from "lucide-react";

export type SectionType = "cellular" | "monitoring" | "local-network" | "system-settings";

interface SubNavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
}

const SECTION_NAV_DATA: Record<SectionType, SubNavItem[]> = {
  cellular: [
    { title: "Overview", href: "/cellular", icon: RadioTower },
    { title: "Antenna Stats", href: "/cellular/antenna-statistics", icon: Signal },
    { title: "Antenna Alignment", href: "/cellular/antenna-alignment", icon: Compass },
    { title: "Cell Scanner", href: "/cellular/cell-scanner", icon: Scan },
    { title: "Band Locking", href: "/cellular/cell-locking", icon: Lock },
    { title: "Custom Profiles", href: "/cellular/custom-profiles", icon: User },
    { title: "SMS Center", href: "/cellular/sms", icon: MessageCircle },
    { title: "Settings", href: "/cellular/settings", icon: Settings },
  ],
  monitoring: [
    { title: "Events", href: "/monitoring", icon: Activity },
    { title: "Watchdog", href: "/monitoring/watchdog", icon: ShieldAlert },
    { title: "Latency", href: "/monitoring/latency", icon: LineChart },
    { title: "Alerts", href: "/monitoring/alerts", icon: Bell },
    { title: "NetBird", href: "/monitoring/netbird", icon: Bird },
    { title: "Tailscale", href: "/monitoring/tailscale", icon: Network },
  ],
  "local-network": [
    { title: "LAN & Devices", href: "/local-network", icon: Network },
    { title: "Custom DNS", href: "/local-network/custom-dns", icon: Globe },
    { title: "Traffic Engine", href: "/local-network/traffic-engine", icon: Cpu },
    { title: "IP Passthrough", href: "/local-network/ip-passthrough", icon: ArrowRightLeft },
    { title: "DPI Masking", href: "/local-network/dpi-masking", icon: EyeOff },
    { title: "TTL & MTU", href: "/local-network/ttl-settings", icon: Sliders },
  ],
  "system-settings": [
    { title: "General", href: "/system-settings", icon: Settings },
    { title: "Languages", href: "/system-settings/languages", icon: Languages },
    { title: "Backup & Restore", href: "/system-settings/config-backup", icon: Database },
    { title: "Connection Quality", href: "/system-settings/connection-quality", icon: Gauge },
    { title: "Adaptive Polling", href: "/system-settings/adaptive-polling", icon: RefreshCw },
    { title: "Bandwidth Monitor", href: "/system-settings/bandwidth-monitor", icon: BarChart3 },
    { title: "System Logs", href: "/system-settings/logs", icon: FileText },
    { title: "Software Update", href: "/system-settings/software-update", icon: Download },
    { title: "AT Terminal", href: "/system-settings/at-terminal", icon: Terminal },
  ],
};

export function LayoutSubNav({ section }: { section: SectionType }) {
  const pathname = usePathname();
  const items = SECTION_NAV_DATA[section] || [];

  return (
    <div className="relative mb-6 -mx-1 sm:mx-0">
      <nav
        aria-label={`${section} sub-navigation`}
        className="glass-surface flex items-center gap-1.5 overflow-x-auto p-1.5 rounded-xl border shadow-sm scrollbar-none"
      >
        {items.map((item) => {
          // Exact match for base route, startsWith for subroutes
          const isBase = item.href === `/${section}`;
          const isActive = isBase
            ? pathname === item.href || pathname === `${item.href}/`
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group relative flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-200 shrink-0",
                isActive
                  ? "bg-gradient-to-b from-primary to-primary/90 text-primary-foreground shadow-md shadow-primary/25"
                  : "text-muted-foreground hover:bg-muted/70 hover:text-foreground active:scale-[0.97]",
              )}
            >
              <Icon
                className={cn(
                  "size-3.5 transition-transform duration-200 group-hover:scale-110",
                  isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground",
                )}
              />
              <span>{item.title}</span>
              {item.badge && (
                <span
                  className={cn(
                    "ml-1 rounded-full px-1.5 py-0.2 text-[10px] font-mono",
                    isActive ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground",
                  )}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
