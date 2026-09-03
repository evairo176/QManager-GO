import { AppLayout } from "@/components/app-layout";
import { LayoutSubNav } from "@/components/layout-sub-nav";

export default function SystemSettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppLayout>
      <LayoutSubNav section="system-settings" />
      {children}
    </AppLayout>
  );
}
