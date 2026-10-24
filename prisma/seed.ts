// Demo data for local development: `npm run db:seed`.
import { PrismaClient, type Difficulty, type Priority } from "@prisma/client";
import { taskXp } from "../src/lib/game";

const db = new PrismaClient();

const STATUSES = [
  { name: "Backlog", color: "#64748b", kind: "BACKLOG" },
  { name: "To Do", color: "#38bdf8", kind: "OPEN" },
  { name: "In Progress", color: "#f59e0b", kind: "ACTIVE" },
  { name: "Review", color: "#a855f7", kind: "REVIEW" },
  { name: "Done", color: "#22c55e", kind: "DONE" },
] as const;

async function main() {
  const owner = (process.env.OWNER_EMAILS ?? "owner@kani.ge").split(",")[0].trim();
  const users = await Promise.all(
    [
      { email: owner, name: "Admin", role: "OWNER" as const, avatar: "polar-bear", xp: 1250 },
      { email: "oto@kani.ge", name: "ოთო", role: "MEMBER" as const, avatar: "tiger", xp: 4700 },
      { email: "lado@kani.ge", name: "ლადო", role: "MEMBER" as const, avatar: "penguin", xp: 2100 },
      { email: "nika@kani.ge", name: "ნიკა", role: "MANAGER" as const, avatar: "race-car", xp: 600 },
    ].map((u) => db.user.upsert({ where: { email: u.email }, create: u, update: {} })),
  );
  if (await db.galaxy.count()) return console.log("already seeded");

  const dev = await db.galaxy.create({ data: { name: "დეველოპმენტი", icon: "💻", color: "#8b5cf6", position: 0 } });
  const mkt = await db.galaxy.create({ data: { name: "მარკეტინგი", icon: "📣", color: "#f472b6", position: 1 } });
  const web = await db.folder.create({ data: { name: "ვებ პროექტები", galaxyId: dev.id } });

  const planet = (name: string, galaxyId: string, color: string, icon: string, folderId?: string) =>
    db.planet.create({
      data: { name, galaxyId, folderId, color, icon, statuses: { create: STATUSES.map((s, position) => ({ ...s, position })) } },
      include: { statuses: { orderBy: { position: "asc" } } },
    });
  const kani = await planet("კანის საიტი", dev.id, "#22d3ee", "🌐", web.id);
  const doctorium = await planet("დოქტორიუმის აპლიკაცია", dev.id, "#34d399", "🩺");
  const social = await planet("სოციალური მედია", mkt.id, "#f472b6", "📱");

  const [admin, oto, lado, nika] = users;
  const day = 86_400_000;
  const tasks: [typeof kani, number, string, Difficulty, Priority, string[], number | null][] = [
    [kani, 1, "მთავარი გვერდის რედიზაინი", "EPIC", "HIGH", [oto.id], 5],
    [kani, 2, "კონტაქტის ფორმის ვალიდაცია", "EASY", "NORMAL", [lado.id], -1],
    [kani, 3, "SEO მეტა თეგები", "NORMAL", "LOW", [lado.id, oto.id], 2],
    [kani, 0, "ბლოგის სექცია", "HARD", "NORMAL", [], null],
    [kani, 4, "Footer-ის განახლება", "EASY", "LOW", [oto.id], -3],
    [doctorium, 2, "ექიმთან ჩაწერის სისტემა", "LEGENDARY", "URGENT", [oto.id, nika.id], 0],
    [doctorium, 1, "Push შეტყობინებები", "HARD", "HIGH", [lado.id], 7],
    [doctorium, 3, "ავტორიზაცია SMS კოდით", "NORMAL", "HIGH", [nika.id], 1],
    [social, 1, "ოქტომბრის კონტენტ-გეგმა", "NORMAL", "NORMAL", [admin.id], 3],
    [social, 2, "Instagram რილსები", "HARD", "NORMAL", [admin.id, lado.id], -2],
  ];
  let pos = 1000;
  for (const [p, statusIndex, title, difficulty, priority, assignees, dueIn] of tasks) {
    const share = assignees.length ? Math.floor(100 / assignees.length) : 0;
    const task = await db.task.create({
      data: {
        title,
        planetId: p.id,
        statusId: p.statuses[statusIndex].id,
        difficulty,
        priority,
        xp: taskXp(difficulty, priority),
        dueDate: dueIn === null ? null : new Date(Date.now() + dueIn * day),
        position: (pos += 1000),
        creatorId: admin.id,
        completedAt: p.statuses[statusIndex].kind === "DONE" ? new Date() : null,
        assignees: { create: assignees.map((userId, i) => ({ userId, xpShare: share + (i === 0 ? 100 - share * assignees.length : 0) })) },
      },
    });
    if (title.startsWith("მთავარი")) {
      for (const sub of ["Hero ბლოკი", "ნავიგაციის მენიუ", "მობილური ვერსია"]) {
        await db.task.create({
          data: { title: sub, planetId: p.id, parentId: task.id, statusId: p.statuses[1].id, xp: taskXp("NORMAL", "NORMAL"), creatorId: admin.id, assignees: { create: [{ userId: oto.id }] } },
        });
      }
      await db.comment.createMany({
        data: [
          { taskId: task.id, authorId: admin.id, body: "@oto Figma-ს ლინკი გამოგიგზავნე 🎨" },
          { taskId: task.id, authorId: oto.id, body: "მივიღე, ხვალ დავიწყებ! 🚀" },
        ],
      });
    }
  }
  for (const [u, n] of [[oto, 12], [lado, 5], [nika, 2]] as const) {
    for (let i = 0; i < n; i++) await db.xpEvent.create({ data: { userId: u.id, amount: [30, 75, 120, 400][i % 4], reason: "task_done", createdAt: new Date(Date.now() - i * day * 0.5) } });
  }
  await db.userAchievement.createMany({ data: [{ userId: oto.id, key: "first_mission" }, { userId: oto.id, key: "streak_3" }, { userId: lado.id, key: "first_mission" }] });
  console.log("seeded ✨");
}

main().finally(() => db.$disconnect());
