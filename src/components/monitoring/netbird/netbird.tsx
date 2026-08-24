"use client";

import { useTranslation, Trans } from "react-i18next";
import { useNetBird } from "@/hooks/use-netbird";
import { NetBirdConnectionCard } from "./netbird-connection-card";
import { NetBirdPeersCard } from "./netbird-peers-card";

import {
  Card,
  CardContent,
} from "@/components/ui/card";

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

import { TriangleAlertIcon } from "lucide-react";

import Link from "next/link";

const NetBirdComponent = () => {
  const { t } = useTranslation("monitoring");
  const hookData = useNetBird();

  // Mutual exclusion guard — other VPN is installed
  if (!hookData.isLoading && hookData.status?.other_vpn_installed) {
    return (
      <div className="@container/main mx-auto p-2">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">{t("netbird.page_title")}</h1>
          <p className="text-muted-foreground">
            {t("netbird.page_description")}
          </p>
        </div>
        <div className="grid grid-cols-1 @3xl/main:grid-cols-2 grid-flow-row gap-4">
          <Card>
            <CardContent>
              <Empty className="h-full bg-muted/30">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <TriangleAlertIcon />
                  </EmptyMedia>
                  <EmptyTitle>
                    {t("netbird.mutex_title")}
                  </EmptyTitle>
                  <EmptyDescription className="max-w-xs text-pretty">
                    <Trans
                      i18nKey="netbird.mutex_description"
                      ns="monitoring"
                      values={{ other_vpn: hookData.status.other_vpn_name }}
                      components={{
                        link: <Link href="/monitoring/tailscale" className="underline font-medium" />,
                      }}
                    />
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="@container/main mx-auto p-2">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">{t("netbird.page_title")}</h1>
        <p className="text-muted-foreground">
          {t("netbird.page_description")}
        </p>
      </div>
      <div className="grid grid-cols-1 @3xl/main:grid-cols-2 grid-flow-row gap-4">
        <NetBirdConnectionCard {...hookData} />
        <NetBirdPeersCard
          status={hookData.status}
          isLoading={hookData.isLoading}
          error={hookData.error}
        />
      </div>
    </div>
  );
};

export default NetBirdComponent;
