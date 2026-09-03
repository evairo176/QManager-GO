import { AppLayout } from "@/components/app-layout";
import { LayoutSubNav } from "@/components/layout-sub-nav";

export default function MonitoringLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppLayout>
      <LayoutSubNav section="monitoring" />
      {children}
    </AppLayout>
  );
}
