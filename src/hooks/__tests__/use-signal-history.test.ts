import { describe, expect, it } from "bun:test";
import { formatRelativeTime } from "../use-signal-history";

describe("formatRelativeTime", () => {
  const latest = 1_710_000_010;

  it("returns 'Now' when entry timestamp equals latest", () => {
    expect(formatRelativeTime(latest, latest)).toBe("Now");
  });

  it("returns '-2s' for an entry 2 seconds older", () => {
    expect(formatRelativeTime(latest - 2, latest)).toBe("-2s");
  });

  it("returns '-10s' for an entry 10 seconds older", () => {
    expect(formatRelativeTime(latest - 10, latest)).toBe("-10s");
  });

  it("rounds to the nearest second for fractional drift", () => {
    // ts is whole seconds in the NDJSON, but guard against unexpected input
    expect(formatRelativeTime(latest - 2.6, latest)).toBe("-3s");
    expect(formatRelativeTime(latest - 2.4, latest)).toBe("-2s");
  });

  it("clamps future-dated entries to 'Now' (clock skew safety)", () => {
    expect(formatRelativeTime(latest + 5, latest)).toBe("Now");
  });
});
