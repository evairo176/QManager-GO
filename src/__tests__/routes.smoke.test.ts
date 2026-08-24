import { describe, it, expect } from "bun:test";

describe("App Router Smoke Tests", () => {
  it("verifies main & auth route pages export default component", async () => {
    const mods = await Promise.all([
      import("@/app/page"),
      import("@/app/login/page"),
      import("@/app/dashboard/page"),
      import("@/app/about-device/page"),
      import("@/app/reboot/page"),
      import("@/app/setup/page"),
      import("@/app/support/page"),
    ]);
    for (const mod of mods) {
      expect(mod.default).toBeDefined();
    }
  });

  it("verifies cellular route pages export default component", async () => {
    const mods = await Promise.all([
      import("@/app/cellular/page"),
      import("@/app/cellular/antenna-alignment/page"),
      import("@/app/cellular/antenna-statistics/page"),
      import("@/app/cellular/cell-locking/page"),
      import("@/app/cellular/cell-scanner/page"),
      import("@/app/cellular/custom-profiles/page"),
      import("@/app/cellular/settings/page"),
      import("@/app/cellular/sms/page"),
    ]);
    for (const mod of mods) {
      expect(mod.default).toBeDefined();
    }
  });

  it("verifies local-network route pages export default component", async () => {
    const mods = await Promise.all([
      import("@/app/local-network/page"),
      import("@/app/local-network/custom-dns/page"),
      import("@/app/local-network/dpi-masking/page"),
      import("@/app/local-network/ip-passthrough/page"),
      import("@/app/local-network/traffic-engine/page"),
      import("@/app/local-network/ttl-settings/page"),
    ]);
    for (const mod of mods) {
      expect(mod.default).toBeDefined();
    }
  });

  it("verifies monitoring & system-settings route pages export default component", async () => {
    const mods = await Promise.all([
      import("@/app/monitoring/page"),
      import("@/app/monitoring/alerts/page"),
      import("@/app/monitoring/latency/page"),
      import("@/app/monitoring/watchdog/page"),
      import("@/app/system-settings/page"),
      import("@/app/system-settings/adaptive-polling/page"),
      import("@/app/system-settings/at-terminal/page"),
      import("@/app/system-settings/bandwidth-monitor/page"),
      import("@/app/system-settings/config-backup/page"),
      import("@/app/system-settings/connection-quality/page"),
      import("@/app/system-settings/languages/page"),
      import("@/app/system-settings/logs/page"),
    ]);
    for (const mod of mods) {
      expect(mod.default).toBeDefined();
    }
  });
});
