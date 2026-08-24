"use client";

import Image from "next/image";
import { useTranslation } from "react-i18next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import QManagerLogo from "@/public/qmanager-logo.svg";
import packageJson from "@/package.json";

import type { AboutDeviceData } from "@/types/about-device";

// =============================================================================
// AboutQManagerCard — QManager info + network details
// =============================================================================

interface AboutQManagerCardProps {
  data: AboutDeviceData | null;
  isLoading: boolean;
}

const AboutQManagerCard = ({ data, isLoading }: AboutQManagerCardProps) => {
  const { t } = useTranslation("system-settings");

  const networkRows = [
    { label: t("about_device.about_qmanager.fields.device_ip_label"), value: data?.network.device_ip },
    { label: t("about_device.about_qmanager.fields.lan_subnet_label"), value: data?.network.lan_subnet },
    { label: t("about_device.about_qmanager.fields.wwan_ipv4_label"), value: data?.network.wan_ipv4 },
    { label: t("about_device.about_qmanager.fields.wwan_ipv6_label"), value: data?.network.wan_ipv6 },
    { label: t("about_device.about_qmanager.fields.public_ipv4_label"), value: data?.network.public_ipv4 },
    { label: t("about_device.about_qmanager.fields.public_ipv6_label"), value: data?.network.public_ipv6 },
  ];

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle className="text-2xl font-semibold">
          {t("about_device.about_qmanager.card_title")}
        </CardTitle>
        <CardDescription>
          {t("about_device.about_qmanager.card_description")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6">
          {/* Logo */}
          <div className="flex items-center justify-center">
            <Image
              src={QManagerLogo}
              alt="QManager Logo"
              className="size-24"
              priority
            />
          </div>

          {/* Description */}
          <div className="grid gap-y-4">
            {/*
              LITERAL-KEEP ZONE — Rus's personal voice signature.
              This paragraph is intentionally NOT wrapped in t(). See
              Plan 13 spec (docs/superpowers/specs/2026-04-20-i18n-about-support-design.md)
              and Plan 8's MNO_PRESETS precedent.
            */}
            <p className="text-sm text-muted-foreground text-pretty leading-relaxed font-medium">
              Hey there! Rus here. QManager is the latest iteration of
              QuecManager, built with a newer and more reliable approach
              compared to its predecessor &mdash; while still combining
              technical settings for advanced users with a simplified UI for
              those just getting started. QManager promises to deliver the same
              features QuecManager had, only better, more reliable, and more
              user-friendly. Special thanks to{" "}
              <span className="text-blue-500">iamromulan</span>,{" "}
              <span className="text-blue-500">clndwhr</span>, and{" "}
              <span className="text-blue-500">Wutang Clan</span>! If you like
              this project, any kind of support is much appreciated. Thanks! 💙
            </p>

            {/* All rights reserved */}
            <p className="text-sm text-muted-foreground text-center">
              {t("about_device.about_qmanager.copyright", { year: new Date().getFullYear() })}
            </p>
          </div>

          {/* QManager version */}
          <div>
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              {t("about_device.about_qmanager.sections.qmanager")}
            </h3>
            <dl className="grid divide-y divide-border border-y border-border">
              <div className="flex items-center justify-between py-2">
                <dt className="text-sm font-semibold text-muted-foreground">
                  {t("about_device.about_qmanager.fields.version_label")}
                </dt>
                <dd className="text-sm font-semibold tabular-nums">
                  {packageJson.version}
                </dd>
              </div>
            </dl>
          </div>

          {/* Network info */}
          <div>
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              {t("about_device.about_qmanager.sections.network")}
            </h3>
            <dl className="grid divide-y divide-border border-y border-border">
              {isLoading
                ? Array.from({ length: 6 }).map((_, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between py-2"
                    >
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                  ))
                : networkRows.map((row) => (
                    <div
                      key={row.label}
                      className="flex items-center justify-between py-2"
                    >
                      <dt className="text-sm font-semibold text-muted-foreground">
                        {row.label}
                      </dt>
                      <dd
                        className="text-sm font-semibold tabular-nums min-w-0 truncate ml-4"
                        title={row.value || undefined}
                      >
                        {row.value || "-"}
                      </dd>
                    </div>
                  ))}
            </dl>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AboutQManagerCard;
