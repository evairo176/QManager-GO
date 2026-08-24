import { describe, it, expect } from "bun:test";
import { useApnSettings } from "@/hooks/use-apn-settings";
import { useLanConfig } from "@/hooks/use-lan-config";
import { useModemStatus } from "@/hooks/use-modem-status";

describe("Frontend Hooks Smoke Tests", () => {
  it("verifies custom React hooks export functions correctly", () => {
    expect(useModemStatus).toBeDefined();
    expect(typeof useModemStatus).toBe("function");

    expect(useApnSettings).toBeDefined();
    expect(typeof useApnSettings).toBe("function");

    expect(useLanConfig).toBeDefined();
    expect(typeof useLanConfig).toBe("function");
  });
});
