"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { pageVariants } from "@/lib/motion";

import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

import { Separator } from "@/components/ui/separator";
import { AppSidebar } from "@/components/app-sidebar";
import { useBreadcrumbs } from "@/hooks/use-breadcrumbs";
import { SimSwapBanner } from "@/components/monitoring/watchdog/sim-swap-banner";
import { isLoggedIn } from "@/hooks/use-auth";
import { useAutoLogout } from "@/hooks/use-auto-logout";
import { useBootPendingReboot } from "@/hooks/use-boot-pending-reboot";
import { ReconnectingBanner } from "@/components/reboot/reconnecting-banner";
import { HeaderStatusPill } from "@/components/header-status-pill";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const breadcrumbs = useBreadcrumbs();
  const pathname = usePathname();
  useAutoLogout();
  useBootPendingReboot();

  // Sync cookie check — no API call, no loading state. The redirect runs during
  // render (not in an effect) on purpose: an effect-based redirect would briefly
  // flash the protected layout to a logged-out user before navigating. The
  // component unmounts on navigation, so this render-phase side effect is benign.
  if (typeof document !== "undefined" && !isLoggedIn()) {
    // eslint-disable-next-line react-hooks/immutability -- intentional sync redirect to avoid flashing protected content; navigates away immediately
    window.location.href = "/login/";
    return null;
  }

  return (
    <SidebarProvider>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:shadow-lg focus:ring-2 focus:ring-ring"
      >
        Skip to main content
      </a>
      <AppSidebar />
      <SidebarInset className="relative overflow-hidden">
        {/* Ambient atmospheric spotlight glow — GSAP web inspired */}
        <div
          className="pointer-events-none fixed -top-36 left-1/2 -translate-x-1/2 h-80 w-[900px] max-w-full rounded-full bg-gradient-to-b from-primary/15 via-primary/5 to-transparent blur-3xl opacity-50 dark:opacity-30 z-0"
          aria-hidden="true"
        />

        <header className="bg-background/75 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border/40 backdrop-blur-xl px-4 sm:px-6 transition-colors shadow-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <SidebarTrigger className="-ml-1 text-muted-foreground hover:text-foreground transition-colors" />
            <Separator
              orientation="vertical"
              className="mr-1.5 data-[orientation=vertical]:h-4 opacity-50"
            />
            <Breadcrumb className="min-w-0">
              <BreadcrumbList className="flex-nowrap overflow-hidden text-ellipsis">
                {breadcrumbs.map((breadcrumb, index) => (
                  <React.Fragment key={breadcrumb.href}>
                    {index > 0 && (
                      <BreadcrumbSeparator className="hidden desktop:block text-muted-foreground/50" />
                    )}
                    <BreadcrumbItem
                      className={
                        breadcrumb.isCurrentPage ? "" : "hidden desktop:block"
                      }
                    >
                      {breadcrumb.isCurrentPage ? (
                        <BreadcrumbPage className="font-semibold text-foreground bg-accent/60 px-2 py-0.5 rounded-md text-xs sm:text-sm">
                          {breadcrumb.label}
                        </BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink
                          href={breadcrumb.href}
                          className="text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {breadcrumb.label}
                        </BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                  </React.Fragment>
                ))}
              </BreadcrumbList>
            </Breadcrumb>
          </div>

          {/* Command Strip Header Actions */}
          <HeaderStatusPill />
        </header>

        <SimSwapBanner />
        <ReconnectingBanner />

        {/* Route transition — refined rise + settle with deblur */}
        <AnimatePresence mode="wait">
          <motion.main
            id="main-content"
            key={pathname}
            className="relative z-10 mx-auto w-full max-w-7xl px-3 sm:px-6 lg:px-8 py-5 flex-1"
            variants={pageVariants}
            initial="hidden"
            animate="enter"
            exit="exit"
          >
            {children}
          </motion.main>
        </AnimatePresence>
      </SidebarInset>
    </SidebarProvider>
  );
}
