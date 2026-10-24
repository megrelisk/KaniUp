# 🪐 KaniUp

კოსმოსური RPG თასქ მენეჯერი (ClickUp-ის ანალოგი). პროდუქტის აღწერა — [docs/VISION.md](docs/VISION.md), ტექნიკური გეგმა — [docs/PLAN.md](docs/PLAN.md).

## ლოკალურად გაშვება

```bash
cp .env.example .env        # შეავსე DATABASE_URL, AUTH_SECRET, OWNER_EMAILS
npm install
npm run db:push             # ბაზის სქემა
npm run db:seed             # (არასავალდებულო) სატესტო მონაცემები
npm run dev                 # http://localhost:3000
```

SMTP არ არის მითითებული → შესვლის ლინკი სერვერის კონსოლში იბეჭდება.

```bash
npm test          # unit ტესტები
npm run typecheck
```
