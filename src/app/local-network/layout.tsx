import { AppLayout } from "@/components/app-layout";
import { LayoutSubNav } from "@/components/layout-sub-nav";

export default function LocalNetworkLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppLayout>
      <LayoutSubNav section="local-network" />
      {children}
    </AppLayout>
  );
}
