import { AppLayout } from "@/components/app-layout";
import { LayoutSubNav } from "@/components/layout-sub-nav";

export default function CellularLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppLayout>
      <LayoutSubNav section="cellular" />
      {children}
    </AppLayout>
  );
}
