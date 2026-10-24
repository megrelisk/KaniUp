// Demo data for the local Firebase emulators: `npm run db:seed` (emulators must be running).
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { taskXp } from "../src/lib/game";
import { DEFAULT_ROLES } from "../src/lib/roles";
import type { Difficulty, PlanetDoc, Priority, Status, TaskDoc, UserDoc } from "../src/lib/types";

if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error("Refusing to seed a non-emulator database.");

initializeApp({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID });
const db = getFirestore();
const auth = getAuth();
const now = () => new Date().toISOString();
const day = 86_400_000;

async function main() {
  if (!(await db.collection("galaxies").limit(1).get()).empty) return console.log("already seeded");
  for (const r of DEFAULT_ROLES) await db.collection("roles").doc(r.id).set(r);

  const owner = (process.env.OWNER_EMAILS ?? "owner@kani.ge").split(",")[0].trim();
  const people = [
    { email: owner, name: "Admin", roleId: "admin", isOwner: true, avatar: "polar-bear", xp: 1250 },
    { email: "oto@kani.ge", name: "ოთო", roleId: "astronaut", isOwner: false, avatar: "tiger", xp: 4700, phone: "555 12 34 56" },
    { email: "lado@kani.ge", name: "ლადო", roleId: "astronaut", isOwner: false, avatar: "penguin", xp: 2100 },
    { email: "nika@kani.ge", name: "ნიკა", roleId: "navigator", isOwner: false, avatar: "race-car", xp: 600 },
  ];
  const ids: string[] = [];
  for (const p of people) {
    const u = await auth.createUser({ email: p.email, displayName: p.name, emailVerified: true }).catch(() => auth.getUserByEmail(p.email));
    ids.push(u.uid);
    await db.collection("users").doc(u.uid).set({
      streak: 0,
      bestStreak: 0,
      lastStreakDay: null,
      visitStreak: 0,
      bestVisitStreak: 0,
      lastVisitDay: null,
      achievements: {},
      phone: null,
      ...p,
      deactivatedAt: null,
      createdAt: now(),
    } satisfies Omit<UserDoc, "id">);
  }
  const [admin, oto, lado, nika] = ids;

  const galaxy = async (name: string, icon: string, color: string, position: number) =>
    (await db.collection("galaxies").add({ name, icon, color, position, createdAt: now(), deletedAt: null })).id;
  const dev = await galaxy("დეველოპმენტი", "💻", "#6366f1", 0);
  const mkt = await galaxy("მარკეტინგი", "📣", "#ec4899", 1);
  const web = (await db.collection("folders").add({ name: "ვებ პროექტები", galaxyId: dev, planetId: null, parentId: null, position: 0, createdAt: now(), deletedAt: null })).id;

  const statuses = (): Status[] =>
    [
      ["Backlog", "#64748b", "BACKLOG"],
      ["To Do", "#3b82f6", "OPEN"],
      ["In Progress", "#f59e0b", "ACTIVE"],
      ["In Review", "#8b5cf6", "REVIEW"],
      ["Done", "#10b981", "DONE"],
    ].map(([name, color, kind], position) => ({ id: db.collection("_").doc().id, name, color, kind: kind as Status["kind"], position }));
  const planet = async (name: string, galaxyId: string, color: string, icon: string, folderId: string | null) => {
    const p: Omit<PlanetDoc, "id"> = { name, galaxyId, folderId, color, icon, position: Date.now(), statuses: statuses(), customFields: [], tags: { frontend: "#3b82f6", design: "#ec4899" }, createdAt: now(), deletedAt: null };
    const ref = await db.collection("planets").add(p);
    return { id: ref.id, ...p };
  };
  const kani = await planet("კანის საიტი", dev, "#06b6d4", "🌐", web);
  const doctorium = await planet("დოქტორიუმის აპლიკაცია", dev, "#10b981", "🩺", null);
  const social = await planet("სოციალური მედია", mkt, "#ec4899", "📱", null);
  kani.customFields = [{ id: "figma", name: "Figma", type: "URL", options: [] }];
  await db.collection("planets").doc(kani.id).update({ customFields: kani.customFields });

  let number = 0;
  const task = async (p: typeof kani, statusIndex: number, title: string, difficulty: Difficulty, priority: Priority, assigneeIds: string[], dueIn: number | null, extra: Partial<TaskDoc> = {}) => {
    const share = assigneeIds.length ? Math.floor(100 / assigneeIds.length) : 0;
    const status = p.statuses[statusIndex];
    const doc: Omit<TaskDoc, "id"> = {
      number: ++number,
      title,
      description: "",
      planetId: p.id,
      folderId: null,
      parentId: null,
      statusId: status.id,
      difficulty,
      priority,
      xp: taskXp(difficulty, priority),
      xpOverride: false,
      assigneeIds,
      xpShares: Object.fromEntries(assigneeIds.map((id, i) => [id, share + (i === 0 ? 100 - share * assigneeIds.length : 0)])),
      tags: [],
      fields: {},
      attachments: [],
      timeSpentSec: 0,
      timers: {},
      startDate: null,
      dueDate: dueIn === null ? null : new Date(Date.now() + dueIn * day).toISOString(),
      position: number * 1000,
      creatorId: admin,
      completedAt: status.kind === "DONE" ? now() : null,
      reviewedAt: null,
      commentCount: 0,
      createdAt: now(),
      updatedAt: now(),
      deletedAt: null,
      ...extra,
    };
    return (await db.collection("tasks").add(doc)).id;
  };

  const redesign = await task(kani, 1, "მთავარი გვერდის რედიზაინი", "EPIC", "HIGH", [oto], 5, { tags: ["design", "frontend"], commentCount: 2, timeSpentSec: 5400, description: "ახალი დიზაინი Figma-ს მიხედვით." });
  await task(kani, 2, "კონტაქტის ფორმის ვალიდაცია", "EASY", "NORMAL", [lado], -1);
  await task(kani, 3, "SEO მეტა თეგები", "NORMAL", "LOW", [lado, oto], 2);
  await task(kani, 0, "ბლოგის სექცია", "HARD", "NORMAL", [], null);
  await task(kani, 4, "Footer-ის განახლება", "EASY", "LOW", [oto], -3);
  await task(doctorium, 2, "ექიმთან ჩაწერის სისტემა", "LEGENDARY", "URGENT", [oto, nika], 0);
  await task(doctorium, 1, "Push შეტყობინებები", "HARD", "HIGH", [lado], 7);
  await task(doctorium, 3, "ავტორიზაცია SMS კოდით", "NORMAL", "HIGH", [nika], 1);
  await task(social, 1, "ოქტომბრის კონტენტ-გეგმა", "NORMAL", "NORMAL", [admin], 3);
  await task(social, 2, "Instagram რილსები", "HARD", "NORMAL", [admin, lado], -2);
  for (const sub of ["Hero ბლოკი", "ნავიგაციის მენიუ", "მობილური ვერსია"]) await task(kani, 1, sub, "NORMAL", "NORMAL", [oto], null, { parentId: redesign });
  for (const [authorId, body] of [
    [admin, "@oto Figma-ს ლინკი გამოგიგზავნე 🎨"],
    [oto, "მივიღე, ხვალ დავიწყებ! 🚀"],
  ]) {
    await db.collection("tasks").doc(redesign).collection("comments").add({ taskId: redesign, authorId, parentId: null, body, system: false, mentions: [], reactions: {}, attachments: [], editedAt: null, deletedAt: null, createdAt: now() });
  }
  await db.collection("counters").doc("tasks").set({ value: number });

  const diffs: Difficulty[] = ["NORMAL", "HARD", "EPIC", "LEGENDARY"];
  for (const [u, n] of [[oto, 12], [lado, 5], [nika, 2]] as const) {
    for (let i = 0; i < n; i++) {
      await db.collection("xpEvents").add({ userId: u, taskId: null, amount: [30, 75, 120, 400][i % 4], difficulty: diffs[i % 4], reason: "task_done", createdAt: new Date(Date.now() - i * day * 0.5).toISOString() });
    }
  }
  await db.collection("users").doc(oto).update({ "achievements.first_mission": now(), "achievements.streak_3": now(), streak: 3, lastStreakDay: new Date().toISOString().slice(0, 10) });
  await db.collection("users").doc(lado).update({ "achievements.first_mission": now() });
  console.log("seeded ✨");
}

main();
