# KaniUp — ტექნიკური გეგმა

## სტეკი

| ფენა | არჩევანი | შენიშვნა |
|---|---|---|
| აპი | **Next.js 15 (App Router) + React 19 + TypeScript** | frontend + backend ერთ პროექტში |
| ბაზა | **Firebase Firestore** | ყველა წაკითხვა/ჩაწერა სერვერიდან (Admin SDK) — უფლებებს სერვერი ამოწმებს |
| ავტორიზაცია | **Firebase Auth** — Magic link + Google | სესია `__session` cookie-ით; შესვლა მხოლოდ მოწვევით |
| ფაილები | **Firebase Storage** | ატვირთვა/ჩამოტვირთვა სერვერის გავლით, უფლებების შემოწმებით |
| Real-time | Firestore `pings` დოკუმენტები + `onSnapshot` | სერვერი ყოველ ცვლილებაზე „აპინგებს“, ბრაუზერი ახლდება |
| ლოკალურად | **Firebase Emulator Suite** (`npm run emulators`) | ინტერნეტი / ნამდვილი პროექტი არ სჭირდება |
| ჰოსტინგი | Firebase App Hosting (მოგვიანებით) | |
| Email | SMTP (nodemailer) — შეტყობინებებისთვის | შესვლის მეილებს Firebase თვითონ აგზავნის |
| Push | Web Push / FCM | |
| SMS | — | არ გვინდა (მომავალში ქართული პროვაიდერი) |
| UI | Tailwind CSS 4, dnd-kit, ხმები Web Audio-თი, **ნეონის გარეშე** | |
| ინტეგრაცია | REST API `/api/v1/*` + API გასაღებები, **MCP სერვერი** | |

## მონაცემთა მოდელი (Firestore კოლექციები)

- `users` (roleId, isOwner, avatar, xp, streak, achievements, phone)
- `roles` — **ადმინი ქმნის ახალს**; permissions[], scopedOnly (სტუმრის ტიპი)
- `grants` — ადამიანს კონკრეტულ გალაქტიკაზე / ფოლდერზე / პლანეტაზე სხვა როლი
- `overrides` — როლის უფლების შეცვლა მხოლოდ კონკრეტულ ადგილას
- `galaxies`, `folders` (parentId — უსასრულო ჩაშენება), `planets` (statuses[], customFields[], tags{})
- `tasks` (parentId — 1 დონის საბთასქი, assigneeIds[], xpShares{}, attachments[], timeSpentSec, timers{}, fields{})
- `tasks/{id}/comments` (parentId, reactions{}, mentions[], system)
- `activity`, `xpEvents`, `invitations`, `counters`, `pings`

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
2. **თასქები** — CRUD, საბთასქები, List + Kanban (drag & drop), თასქის პანელი, ფილტრები, „ჩემი მისიები“, ფაილები, time tracking, სტატუსების და custom ველების რედაქტორი ✅
2½. **Firebase-ზე გადასვლა** + დინამიური როლები + ნეონის გარეშე დიზაინი ✅
3. **RPG** — XP, ლეველები, ტიტულები, ბეჯები, streak, leaderboard, ხმები/ანიმაციები, ავატარები ✅
4. **კომენტარები** — ჩატი real-time, mention, რეაქციები, პასუხები, სისტემური მესიჯები ✅
5. **უფლებები** — როლების შექმნა/რედაქტორი, დონეების მიხედვით, სტუმრები ✅
6. **შეტყობინებები** — email, push, ზარი, დედლაინების დილის შეხსენება ⏭ შემდეგი
7. **ხედები** — Calendar, Gantt, კოსმოსური რუკა
8. **API + MCP** — API გასაღებები, REST, MCP სერვერი Claude-ისთვის
9. **Deploy** — Firebase App Hosting
