import { describe, expect, it } from "vitest";
import { deadlineState } from "./deadlines";

// 25 Sep 2026, 09:00 in Tbilisi (UTC+4).
const morning = new Date("2026-09-25T05:00:00Z");

describe("deadlineState", () => {
  it("reminds on the morning of the deadline day", () => {
    expect(deadlineState("2026-09-25T15:00:00Z", null, morning)).toEqual({ kind: "due_today" });
  });
  it("reports overdue tasks every following morning", () => {
    expect(deadlineState("2026-09-24T15:00:00Z", null, morning)).toEqual({ kind: "overdue", days: 1 });
    expect(deadlineState("2026-09-20T15:00:00Z", null, morning)).toEqual({ kind: "overdue", days: 5 });
  });
  it("ignores future, missing and completed deadlines", () => {
    expect(deadlineState("2026-09-26T15:00:00Z", null, morning)).toBeNull();
    expect(deadlineState(null, null, morning)).toBeNull();
    expect(deadlineState("2026-09-24T15:00:00Z", "2026-09-24T10:00:00Z", morning)).toBeNull();
  });
});
