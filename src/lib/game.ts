import type { Difficulty, Priority } from "./types";

export const DIFFICULTIES: Difficulty[] = ["EASY", "NORMAL", "HARD", "EPIC", "LEGENDARY"];
export const PRIORITIES: Priority[] = ["LOW", "NORMAL", "HIGH", "URGENT"];

export const DIFFICULTY_BASE_XP: Record<Difficulty, number> = {
  EASY: 10,
  NORMAL: 25,
  HARD: 50,
  EPIC: 100,
  LEGENDARY: 200,
};

export const PRIORITY_MULTIPLIER: Record<Priority, number> = {
  LOW: 1,
  NORMAL: 1.2,
  HIGH: 1.5,
  URGENT: 2,
};

/** Task XP = difficulty base × priority multiplier, rounded to the nearest 5. */
export function taskXp(difficulty: Difficulty, priority: Priority): number {
  const raw = DIFFICULTY_BASE_XP[difficulty] * PRIORITY_MULTIPLIER[priority];
  return Math.max(5, Math.round(raw / 5) * 5);
}

/** Even percentage split; the remainder goes to the first assignees so the total is 100. */
export function evenShares(count: number): number[] {
  if (count <= 0) return [];
  const base = Math.floor(100 / count);
  const rest = 100 - base * count;
  return Array.from({ length: count }, (_, i) => base + (i < rest ? 1 : 0));
}

/** Splits task XP by percentage shares; rounding leftovers go to the largest share. */
export function splitXp(total: number, shares: number[]): number[] {
  const sum = shares.reduce((a, b) => a + b, 0);
  if (sum === 0) return shares.map(() => 0);
  const parts = shares.map((s) => Math.floor((total * s) / sum));
  const leftover = total - parts.reduce((a, b) => a + b, 0);
  if (leftover > 0) parts[shares.indexOf(Math.max(...shares))] += leftover;
  return parts;
}

/** Total XP needed to reach a level: 50·n·(n−1) → L2 = 100, L5 = 1000, L10 = 4500, L20 = 19000. */
export function xpForLevel(level: number): number {
  return 50 * level * (level - 1);
}

export function levelFromXp(xp: number): number {
  // Inverse of xpForLevel, then guard against float edge cases.
  let level = Math.max(1, Math.floor((1 + Math.sqrt(1 + (4 * xp) / 50)) / 2));
  while (xpForLevel(level + 1) <= xp) level++;
  while (level > 1 && xpForLevel(level) > xp) level--;
  return level;
}

export function levelProgress(xp: number) {
  const level = levelFromXp(xp);
  const from = xpForLevel(level);
  const to = xpForLevel(level + 1);
  return { level, current: xp - from, needed: to - from, ratio: (xp - from) / (to - from) };
}

export type Title = { level: number; ka: string; en: string };

export const TITLES: Title[] = [
  { level: 1, ka: "კოსმოსის კადეტი", en: "Space Cadet" },
  { level: 5, ka: "ვარსკვლავთმზვერავი", en: "Star Scout" },
  { level: 10, ka: "ორბიტის მცველი", en: "Orbit Guardian" },
  { level: 15, ka: "გალაქტიკის რაინდი", en: "Galaxy Knight" },
  { level: 20, ka: "კოსმოსის ლეგენდა", en: "Cosmic Legend" },
];

export function titleForLevel(level: number): Title {
  return [...TITLES].reverse().find((t) => level >= t.level) ?? TITLES[0];
}

export type Avatar = { key: string; emoji: string; ka: string; en: string; from: string; to: string };

export const AVATARS: Avatar[] = [
  { key: "polar-bear", emoji: "🐻‍❄️", ka: "პოლარული დათვი", en: "Polar Bear", from: "#67e8f9", to: "#6366f1" },
  { key: "penguin", emoji: "🐧", ka: "პინგვინი", en: "Penguin", from: "#38bdf8", to: "#1e3a8a" },
  { key: "fox", emoji: "🦊", ka: "მელა", en: "Fox", from: "#fb923c", to: "#be123c" },
  { key: "panda", emoji: "🐼", ka: "პანდა", en: "Panda", from: "#a3e635", to: "#15803d" },
  { key: "tiger", emoji: "🐯", ka: "ვეფხვი", en: "Tiger", from: "#fbbf24", to: "#c2410c" },
  { key: "lion", emoji: "🦁", ka: "ლომი", en: "Lion", from: "#facc15", to: "#a16207" },
  { key: "wolf", emoji: "🐺", ka: "მგელი", en: "Wolf", from: "#94a3b8", to: "#334155" },
  { key: "owl", emoji: "🦉", ka: "ბუ", en: "Owl", from: "#d6a36b", to: "#713f12" },
  { key: "octopus", emoji: "🐙", ka: "რვაფეხა", en: "Octopus", from: "#f472b6", to: "#7e22ce" },
  { key: "frog", emoji: "🐸", ka: "ბაყაყი", en: "Frog", from: "#4ade80", to: "#0f766e" },
  { key: "koala", emoji: "🐨", ka: "კოალა", en: "Koala", from: "#cbd5e1", to: "#475569" },
  { key: "monkey", emoji: "🐵", ka: "მაიმუნი", en: "Monkey", from: "#f59e0b", to: "#78350f" },
  { key: "unicorn", emoji: "🦄", ka: "მარტორქა", en: "Unicorn", from: "#f0abfc", to: "#6d28d9" },
  { key: "dragon", emoji: "🐉", ka: "დრაკონი", en: "Dragon", from: "#34d399", to: "#047857" },
  { key: "dino", emoji: "🦖", ka: "დინოზავრი", en: "Dino", from: "#86efac", to: "#166534" },
  { key: "race-car", emoji: "🏎️", ka: "ბოლიდი", en: "Race Car", from: "#f87171", to: "#991b1b" },
  { key: "rocket", emoji: "🚀", ka: "რაკეტა", en: "Rocket", from: "#818cf8", to: "#312e81" },
  { key: "ufo", emoji: "🛸", ka: "მფრინავი თეფში", en: "UFO", from: "#5eead4", to: "#0e7490" },
  { key: "robot", emoji: "🤖", ka: "რობოტი", en: "Robot", from: "#a5b4fc", to: "#3730a3" },
  { key: "alien", emoji: "👾", ka: "უცხოპლანეტელი", en: "Alien", from: "#c084fc", to: "#4c1d95" },
];

export function avatarByKey(key: string | null | undefined): Avatar {
  return AVATARS.find((a) => a.key === key) ?? AVATARS[0];
}

export type AchievementDef = { key: string; icon: string; ka: string; en: string; descKa: string; descEn: string };

export const ACHIEVEMENTS: AchievementDef[] = [
  { key: "first_mission", icon: "🎯", ka: "პირველი მისია", en: "First Mission", descKa: "პირველი თასქი შესრულდა", descEn: "Completed your first task" },
  { key: "streak_3", icon: "🔥", ka: "ანთება", en: "Ignition", descKa: "3 დღე ზედიზედ", descEn: "3-day streak" },
  { key: "streak_5", icon: "☄️", ka: "კომეტა", en: "Comet", descKa: "5 დღე ზედიზედ", descEn: "5-day streak" },
  { key: "streak_7", icon: "🌠", ka: "მეტეორული კვირა", en: "Meteor Week", descKa: "7 დღე ზედიზედ", descEn: "7-day streak" },
  { key: "streak_30", icon: "🌞", ka: "სუპერნოვა", en: "Supernova", descKa: "30 დღე ზედიზედ", descEn: "30-day streak" },
  { key: "on_time_10", icon: "⏱️", ka: "დროის ოსტატი", en: "Time Master", descKa: "10 თასქი დედლაინამდე", descEn: "10 tasks before the deadline" },
  { key: "tasks_50", icon: "🛰️", ka: "ორბიტული სადგური", en: "Space Station", descKa: "50 შესრულებული თასქი", descEn: "50 completed tasks" },
  { key: "legendary_1", icon: "👑", ka: "ლეგენდის მკვლელი", en: "Legend Slayer", descKa: "Legendary თასქი შესრულდა", descEn: "Completed a Legendary task" },
];

export const STREAK_MILESTONES: [number, string][] = [
  [3, "streak_3"],
  [5, "streak_5"],
  [7, "streak_7"],
  [30, "streak_30"],
];

/** Day key in Tbilisi time — streaks and deadline reminders are counted in local days. */
export function tbilisiDay(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tbilisi" }).format(date);
}

/**
 * Streak counts consecutive days on which the user handed in work (moved a task
 * to Review). Returns the new streak given the last streak day.
 */
export function nextStreak(current: number, lastDay: string | null, today: string): number {
  if (lastDay === today) return current;
  if (lastDay && daysBetween(lastDay, today) === 1) return current + 1;
  return 1;
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
}

/** The streak to display: it lapses once a full day passes without a hand-in. */
export function activeStreak(streak: number, lastDay: string | null, today: string): number {
  if (!lastDay) return 0;
  return daysBetween(lastDay, today) <= 1 ? streak : 0;
}
