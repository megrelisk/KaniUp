# 🪐 KaniUp

კოსმოსური RPG თასქ მენეჯერი (ClickUp-ის ანალოგი). პროდუქტის აღწერა — [docs/VISION.md](docs/VISION.md), ტექნიკური გეგმა — [docs/PLAN.md](docs/PLAN.md).

## ლოკალურად გაშვება

საჭიროა Node.js 20+ და Java 11+ (Firebase emulator-ებისთვის).

```bash
cp .env.example .env      # შეცვალე OWNER_EMAILS შენს მეილზე
npm install
npm run emulators         # ტერმინალი 1: Firebase Auth / Firestore / Storage ლოკალურად (UI: http://127.0.0.1:4000)
npm run db:seed           # ტერმინალი 2: (არასავალდებულო) სატესტო მონაცემები
npm run dev               # http://localhost:3000
```

**შესვლა ლოკალურად:** შეიყვანე მეილი → emulator-ის ტერმინალში (ან http://127.0.0.1:4000/auth) გამოჩნდება ლინკი „To sign in as …, follow this link“ — გახსენი ბრაუზერში.

```bash
npm test          # unit ტესტები
npm run typecheck
```
