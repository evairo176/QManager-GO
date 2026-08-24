// lib/reboot/connection.test.ts
import { describe, it, expect } from "bun:test";
import {
  evaluateConnection,
  INITIAL_CONNECTION_STATE,
  WARN_AT,
  FAILURE_THRESHOLD,
  type ConnectionState,
} from "./connection";

describe("evaluateConnection", () => {
  it("resets the counter and hides the banner on success", () => {
    const prev: ConnectionState = { consecutiveFailures: 3 };
    const r = evaluateConnection(prev, true);
    expect(r.state.consecutiveFailures).toBe(0);
    expect(r.showBanner).toBe(false);
    expect(r.action).toBe("none");
  });

  it("increments on failure without action below WARN_AT", () => {
    const r = evaluateConnection(INITIAL_CONNECTION_STATE, false);
    expect(r.state.consecutiveFailures).toBe(1);
    expect(r.showBanner).toBe(false);
    expect(r.action).toBe("none");
  });

  it("shows the banner once WARN_AT consecutive failures is reached", () => {
    const r = evaluateConnection({ consecutiveFailures: WARN_AT - 1 }, false);
    expect(r.state.consecutiveFailures).toBe(WARN_AT);
    expect(r.showBanner).toBe(true);
    expect(r.action).toBe("none");
  });

  it("returns redirect once FAILURE_THRESHOLD is reached", () => {
    const r = evaluateConnection({ consecutiveFailures: FAILURE_THRESHOLD - 1 }, false);
    expect(r.state.consecutiveFailures).toBe(FAILURE_THRESHOLD);
    expect(r.action).toBe("redirect");
    expect(r.showBanner).toBe(true);
  });

  it("WARN_AT is below FAILURE_THRESHOLD so the banner always precedes redirect", () => {
    expect(WARN_AT).toBeLessThan(FAILURE_THRESHOLD);
  });
});
