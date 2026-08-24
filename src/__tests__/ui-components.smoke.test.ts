import { describe, it, expect } from "bun:test";
import { ServiceStatusBadge } from "@/components/local-network/service-status-badge";
import { SaveButton } from "@/components/ui/save-button";
import { ANTENNA_PORTS } from "@/types/modem-status";

describe("UI Components & Constants Smoke Tests", () => {
  it("verifies ServiceStatusBadge component exports correctly", () => {
    expect(ServiceStatusBadge).toBeDefined();
    expect(typeof ServiceStatusBadge).toBe("function");
  });

  it("verifies SaveButton component exports correctly", () => {
    expect(SaveButton).toBeDefined();
    expect(typeof SaveButton).toBe("function");
  });

  it("verifies canonical ANTENNA_PORTS metadata", () => {
    expect(ANTENNA_PORTS).toBeDefined();
    expect(ANTENNA_PORTS).toHaveLength(4);
    expect(ANTENNA_PORTS[0].name).toBe("Main");
    expect(ANTENNA_PORTS[0].rx).toBe("PRX");
    expect(ANTENNA_PORTS[1].name).toBe("Diversity");
    expect(ANTENNA_PORTS[1].rx).toBe("DRX");
  });
});
