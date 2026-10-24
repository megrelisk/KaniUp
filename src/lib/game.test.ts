import { describe, expect, it } from "vitest";
import { evenShares, levelFromXp, levelProgress, nextStreak, splitXp, taskXp, titleForLevel, xpForLevel } from "./game";

describe("taskXp", () => {
  it("scales with difficulty and priority", () => {
    expect(taskXp("EASY", "LOW")).toBe(10);
    expect(taskXp("NORMAL", "NORMAL")).toBe(30);
    expect(taskXp("HARD", "HIGH")).toBe(75);
    expect(taskXp("LEGENDARY", "URGENT")).toBe(400);
  });
});

describe("shares", () => {
  it("splits evenly to 100", () => {
    expect(evenShares(3)).toEqual([34, 33, 33]);
    expect(evenShares(0)).toEqual([]);
  });
  it("splits xp without losing points", () => {
    const parts = splitXp(100, [34, 33, 33]);
    expect(parts.reduce((a, b) => a + b)).toBe(100);
    expect(splitXp(75, [70, 30])).toEqual([53, 22]);
  });
});

describe("levels", () => {
  it("matches the level curve", () => {
    expect(xpForLevel(2)).toBe(100);
    expect(levelFromXp(0)).toBe(1);
    expect(levelFromXp(99)).toBe(1);
    expect(levelFromXp(100)).toBe(2);
    expect(levelFromXp(4500)).toBe(10);
    expect(levelFromXp(4499)).toBe(9);
    expect(levelProgress(150)).toMatchObject({ level: 2, current: 50, needed: 200 });
  });
  it("picks titles at milestones", () => {
    expect(titleForLevel(4).en).toBe("Space Cadet");
    expect(titleForLevel(5).en).toBe("Star Scout");
    expect(titleForLevel(37).en).toBe("Cosmic Legend");
  });
});

describe("nextStreak", () => {
  it("continues, holds and resets", () => {
    expect(nextStreak(0, null, "2026-10-24")).toBe(1);
    expect(nextStreak(3, "2026-10-23", "2026-10-24")).toBe(4);
    expect(nextStreak(3, "2026-10-24", "2026-10-24")).toBe(3);
    expect(nextStreak(3, "2026-10-21", "2026-10-24")).toBe(1);
    expect(nextStreak(9, "2026-10-31", "2026-11-01")).toBe(10);
  });
});
