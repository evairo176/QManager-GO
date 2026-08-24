// Run with: bun test lib/scenario-schedule.test.ts
import { describe, it, expect } from "bun:test";
import {
  parseHhmm,
  formatHhmm,
  resolveScheduledScenario,
  nextChangeAt,
  validateSchedule,
  hasBlockingScheduleErrors,
  groupDays,
  stripScenarioKeys,
} from "./scenario-schedule";
import type {
  ScenarioSchedule,
  DayOfWeek,
  ProfileScenarioBinding,
} from "@/types/sim-profile";

const ALL_DAYS: DayOfWeek[] = [0, 1, 2, 3, 4, 5, 6];

/** Build a Date for a given weekday + HH:MM. 2024-01-07 is a Sunday. */
function at(dow: DayOfWeek, hh: number, mm: number): Date {
  // 2024-01-07 = Sunday (dow 0). Add `dow` days to reach the target weekday.
  const d = new Date(2024, 0, 7 + dow, hh, mm, 0, 0);
  expect(d.getDay()).toBe(dow);
  return d;
}

describe("parseHhmm / formatHhmm", () => {
  it("parses valid times", () => {
    expect(parseHhmm("00:00")).toBe(0);
    expect(parseHhmm("08:30")).toBe(510);
    expect(parseHhmm("23:59")).toBe(1439);
  });
  it("rejects malformed times", () => {
    expect(parseHhmm("24:00")).toBeNull();
    expect(parseHhmm("12:60")).toBeNull();
    expect(parseHhmm("abc")).toBeNull();
    expect(parseHhmm("")).toBeNull();
  });
  it("formats minutes-of-day", () => {
    expect(formatHhmm(0)).toBe("00:00");
    expect(formatHhmm(510)).toBe("08:30");
    expect(formatHhmm(1439)).toBe("23:59");
  });
});

describe("resolveScheduledScenario — touching boundary (end-exclusive)", () => {
  const schedule: ScenarioSchedule = {
    enabled: true,
    blocks: [
      { start: "08:00", end: "12:00", days: ALL_DAYS, scenario: "gaming" },
      { start: "12:00", end: "18:00", days: ALL_DAYS, scenario: "streaming" },
    ],
  };
  it("resolves to first block inside its window", () => {
    expect(resolveScheduledScenario(at(1, 8, 0), schedule, "balanced")).toBe("gaming");
    expect(resolveScheduledScenario(at(1, 11, 59), schedule, "balanced")).toBe("gaming");
  });
  it("at exactly 12:00 resolves to the SECOND block (end exclusive on first)", () => {
    expect(resolveScheduledScenario(at(1, 12, 0), schedule, "balanced")).toBe("streaming");
  });
  it("at 18:00 falls through to default (end exclusive on second)", () => {
    expect(resolveScheduledScenario(at(1, 18, 0), schedule, "balanced")).toBe("balanced");
  });
});

describe("resolveScheduledScenario — overnight wrap 22:00-06:00", () => {
  const schedule: ScenarioSchedule = {
    enabled: true,
    blocks: [{ start: "22:00", end: "06:00", days: ALL_DAYS, scenario: "streaming" }],
  };
  it("matches late evening", () => {
    expect(resolveScheduledScenario(at(2, 22, 0), schedule, "balanced")).toBe("streaming");
    expect(resolveScheduledScenario(at(2, 23, 30), schedule, "balanced")).toBe("streaming");
  });
  it("matches early morning before end", () => {
    expect(resolveScheduledScenario(at(2, 5, 59), schedule, "balanced")).toBe("streaming");
  });
  it("does not match at end (exclusive) or midday", () => {
    expect(resolveScheduledScenario(at(2, 6, 0), schedule, "balanced")).toBe("balanced");
    expect(resolveScheduledScenario(at(2, 12, 0), schedule, "balanced")).toBe("balanced");
  });
});

describe("resolveScheduledScenario — first-in-array wins on overlap", () => {
  const schedule: ScenarioSchedule = {
    enabled: true,
    blocks: [
      { start: "08:00", end: "18:00", days: ALL_DAYS, scenario: "gaming" },
      { start: "10:00", end: "12:00", days: ALL_DAYS, scenario: "streaming" },
    ],
  };
  it("topmost block wins even when a later block also matches", () => {
    expect(resolveScheduledScenario(at(3, 11, 0), schedule, "balanced")).toBe("gaming");
  });
});

describe("resolveScheduledScenario — day filtering + gap + empty", () => {
  it("a block on a different day does not match (gap → default)", () => {
    const schedule: ScenarioSchedule = {
      enabled: true,
      blocks: [{ start: "08:00", end: "12:00", days: [1], scenario: "gaming" }], // Mon only
    };
    expect(resolveScheduledScenario(at(0, 9, 0), schedule, "balanced")).toBe("balanced"); // Sun
    expect(resolveScheduledScenario(at(1, 9, 0), schedule, "balanced")).toBe("gaming"); // Mon
  });
  it("empty schedule resolves to default", () => {
    const schedule: ScenarioSchedule = { enabled: true, blocks: [] };
    expect(resolveScheduledScenario(at(1, 9, 0), schedule, "gaming")).toBe("gaming");
  });
  it("disabled schedule resolves to default", () => {
    const schedule: ScenarioSchedule = {
      enabled: false,
      blocks: [{ start: "00:00", end: "23:59", days: ALL_DAYS, scenario: "streaming" }],
    };
    expect(resolveScheduledScenario(at(1, 9, 0), schedule, "balanced")).toBe("balanced");
  });
});

describe("nextChangeAt", () => {
  it("returns the next boundary where the resolved scenario changes", () => {
    const schedule: ScenarioSchedule = {
      enabled: true,
      blocks: [
        { start: "08:00", end: "12:00", days: ALL_DAYS, scenario: "gaming" },
        { start: "12:00", end: "18:00", days: ALL_DAYS, scenario: "streaming" },
      ],
    };
    // At 09:00 (gaming), next change is 12:00 (→ streaming)
    expect(nextChangeAt(at(1, 9, 0), schedule, "balanced")).toBe("12:00");
    // At 13:00 (streaming), next change is 18:00 (→ balanced default)
    expect(nextChangeAt(at(1, 13, 0), schedule, "balanced")).toBe("18:00");
    // At 06:00 (default before first block), next change is 08:00 (→ gaming)
    expect(nextChangeAt(at(1, 6, 0), schedule, "balanced")).toBe("08:00");
  });
  it("returns null for a constant schedule (empty)", () => {
    const schedule: ScenarioSchedule = { enabled: true, blocks: [] };
    expect(nextChangeAt(at(1, 9, 0), schedule, "balanced")).toBeNull();
  });
  it("returns null when disabled", () => {
    const schedule: ScenarioSchedule = { enabled: false, blocks: [] };
    expect(nextChangeAt(at(1, 9, 0), schedule, "balanced")).toBeNull();
  });
});

describe("validateSchedule / hasBlockingScheduleErrors", () => {
  it("flags malformed, zero-length, and empty-days blocks", () => {
    const schedule: ScenarioSchedule = {
      enabled: true,
      blocks: [
        { start: "bad", end: "12:00", days: ALL_DAYS, scenario: "gaming" },
        { start: "08:00", end: "08:00", days: ALL_DAYS, scenario: "gaming" },
        { start: "08:00", end: "12:00", days: [], scenario: "gaming" },
      ],
    };
    const { errors } = validateSchedule(schedule);
    expect(errors[0]).toBe("invalid_start");
    expect(errors[1]).toBe("zero_length");
    expect(errors[2]).toBe("no_days");
    expect(hasBlockingScheduleErrors(schedule)).toBe(true);
  });
  it("flags overlaps as warnings (non-blocking)", () => {
    const schedule: ScenarioSchedule = {
      enabled: true,
      blocks: [
        { start: "08:00", end: "12:00", days: ALL_DAYS, scenario: "gaming" },
        { start: "10:00", end: "14:00", days: ALL_DAYS, scenario: "streaming" },
      ],
    };
    const { errors, overlapWarnings } = validateSchedule(schedule);
    expect(Object.keys(errors).length).toBe(0);
    expect(overlapWarnings).toContain(0);
    expect(overlapWarnings).toContain(1);
    expect(hasBlockingScheduleErrors(schedule)).toBe(false);
  });
  it("no overlap when days differ", () => {
    const schedule: ScenarioSchedule = {
      enabled: true,
      blocks: [
        { start: "08:00", end: "12:00", days: [1], scenario: "gaming" },
        { start: "08:00", end: "12:00", days: [2], scenario: "streaming" },
      ],
    };
    expect(validateSchedule(schedule).overlapWarnings.length).toBe(0);
  });
  it("disabled schedule has no blocking errors", () => {
    const schedule: ScenarioSchedule = {
      enabled: false,
      blocks: [{ start: "bad", end: "x", days: [], scenario: "gaming" }],
    };
    expect(hasBlockingScheduleErrors(schedule)).toBe(false);
  });
});

describe("groupDays", () => {
  it("classifies the canonical groupings", () => {
    expect(groupDays(ALL_DAYS)).toBe("all");
    expect(groupDays([1, 2, 3, 4, 5])).toBe("weekdays");
    expect(groupDays([0, 6])).toBe("weekends");
    expect(groupDays([])).toBe("none");
  });
  it("is order-insensitive", () => {
    expect(groupDays([5, 4, 3, 2, 1] as DayOfWeek[])).toBe("weekdays");
    expect(groupDays([6, 0])).toBe("weekends");
  });
  it("falls back to custom for anything else", () => {
    expect(groupDays([1, 2, 3])).toBe("custom");
    expect(groupDays([0, 1, 2, 3, 4, 5])).toBe("custom"); // 6 of 7 days
    expect(groupDays([0])).toBe("custom"); // single weekend day
    expect(groupDays([1, 2, 3, 4, 5, 6])).toBe("custom"); // weekdays + Sat
  });
});

describe("stripScenarioKeys", () => {
  it("removes _key from every block without mutating the input", () => {
    const binding: ProfileScenarioBinding = {
      default: "balanced",
      schedule: {
        enabled: true,
        blocks: [
          { start: "08:00", end: "12:00", days: ALL_DAYS, scenario: "gaming", _key: "a" },
          { start: "12:00", end: "18:00", days: ALL_DAYS, scenario: "streaming", _key: "b" },
        ],
      },
    };
    const out = stripScenarioKeys(binding);
    expect(out.schedule.blocks.every((b) => !("_key" in b))).toBe(true);
    // Input untouched.
    expect(binding.schedule.blocks[0]._key).toBe("a");
    // Other fields preserved.
    expect(out.schedule.blocks[0].scenario).toBe("gaming");
    expect(out.default).toBe("balanced");
    expect(out.schedule.enabled).toBe(true);
  });
  it("is a no-op shape for blocks that never had a key", () => {
    const binding: ProfileScenarioBinding = {
      default: "balanced",
      schedule: { enabled: false, blocks: [] },
    };
    expect(stripScenarioKeys(binding)).toEqual(binding);
  });
});
