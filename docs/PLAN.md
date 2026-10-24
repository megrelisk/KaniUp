# KaniUp — ტექნიკური გეგმა

## სტეკი

| ფენა | არჩევანი | რატომ |
|---|---|---|
| აპი | **Next.js 15 (App Router) + React 19 + TypeScript** | frontend + backend ერთ პროექტში |
| ბაზა | **PostgreSQL + Prisma** | იერარქია, უფლებები, რთული ფილტრები — რელაციური ბაზა საჭიროა |
| ჰოსტინგი | **Firebase App Hosting** (Next.js) + **Cloud SQL Postgres** (იმავე Google პროექტში) | მომხმარებელს Firebase უკვე აქვს |
| ავტორიზაცია | **Auth.js (NextAuth v5)** — Google + Magic link | Prisma-სთან პირდაპირ მუშაობს, ლოკალურად ტესტირებადი |
| ფაილები | Firebase Storage (dev-ში ლოკალური დისკი) | |
| Real-time | Server-Sent Events + Postgres LISTEN/NOTIFY | WebSocket სერვერის გარეშე, Cloud Run-ზე მუშაობს |
| Email | SMTP (nodemailer) — კომპანიის მეილი ან Google Workspace | |
| SMS | ადაპტერი — ქართული პროვაიდერი (smsoffice.ge / Magti / სხვ.) | Twilio არა |
| Push | Web Push (VAPID) | |
| Cron | Cloud Scheduler → `/api/cron/deadlines` (ყოველ დილას 09:00 თბილისით) | |
| UI | Tailwind CSS 4, dnd-kit (drag & drop), Framer Motion, ხმები Web Audio-თი | |
| i18n | ქართული / ინგლისური | |
| ინტეგრაცია | REST API `/api/v1/*` + API გასაღებები, **MCP სერვერი** `/api/mcp` | Claude-დან თასქების მართვა |
| ტესტები | Vitest | |

## მონაცემთა მოდელი (მოკლედ)

- `User` (role, avatar, xp, level, streak, locale, phone)
- `Galaxy` → `Folder` (parentFolderId, უსასრულო) → `Planet` → `Folder` → `Task` → `Task` (subtask, parentId)
- `Status` (per planet, order, isDone, isReview)
- `TaskAssignee` (xpShare), `Tag`, `TaskTag`, `Attachment`, `CustomField`, `CustomFieldValue`
- `Comment` (parentId — პასუხი, reactions, mentions, system=true სისტემური მესიჯებისთვის)
- `RoleGrant` (userId, role, scope: galaxy/folder/planet) + `RolePermission` (role × permission, ადმინი არედაქტირებს)
- `Invitation` (email, role, scope, token, expiresAt = +3 დღე)
- `XpEvent`, `Achievement`/`UserAchievement`, `ActivityLog`, `Notification`, `ApiKey`

## XP ფორმულა (საწყისი)

`XP = base(სირთულე) × multiplier(პრიორიტეტი)` — დამრგვალებული 5-მდე.

| სირთულე | base | | პრიორიტეტი | × |
|---|---|---|---|---|
| Easy | 10 | | Low | 1.0 |
| Normal | 25 | | Normal | 1.2 |
| Hard | 50 | | High | 1.5 |
| Epic | 100 | | Urgent | 2.0 |
| Legendary | 200 | | | |

რამდენიმე შემსრულებლისას — თანაბრად; ადმინს Done-მდე შეუძლია წილების შეცვლა.
ლეველი: `level n`-ისთვის საჭირო ჯამური XP = `50 × n × (n − 1)` (L2 = 100, L5 = 1000, L10 = 4500, L20 = 19000).

## ეტაპები

1. **საფუძველი** — პროექტი, ბაზის სქემა, ავტორიზაცია, მოწვევები, თემა, ენები, ნავიგაცია (sidebar ხე) ✅
2. **თასქები** — CRUD, საბთასქები, List + Kanban (drag & drop), თასქის პანელი, ფილტრები, „ჩემი მისიები“ ✅
3. **RPG** — XP, ლეველები, ტიტულები, ბეჯები, streak, leaderboard, ხმები/ანიმაციები, ავატარები
4. **კომენტარები** — ჩატი real-time, mention, რეაქციები, პასუხები, ფაილები, სისტემური მესიჯები
5. **უფლებები** — როლების რედაქტორი, დონეების მიხედვით, სტუმრები
6. **შეტყობინებები** — email, SMS, push, ზარი, დედლაინების cron
7. **ხედები** — Calendar, Gantt, კოსმოსური რუკა; custom fields; activity log
8. **API + MCP** — API გასაღებები, REST, MCP სერვერი Claude-ისთვის
9. **Deploy** — Firebase App Hosting + Cloud SQL
