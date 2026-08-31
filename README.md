# ClashBid 🏏

**ClashBid** is a high-performance cricket/sports auction platform for organizers to import rosters, manage teams and wallets, and run auctions in two modes: **live multiplayer bidding** or a **static single-bidder ledger** for in-person events.

Live demo: **[clashbid.live](https://clashbid.live)**

---

## 🚀 Key Features

### Two auction modes

| Mode | Best for | How it works |
|------|----------|--------------|
| **Live** | Remote captains bidding in real time | Room code, Socket.io, timers, bid rollbacks |
| **Static** | One admin calling sales at a physical event | CSV import, manual Sold/Unsold, wallet enforcement, live commentary, undo |

Invite codes are tied to a mode at signup — admins get the dashboard that matches their invite (`live` or `static`).

### Admin control center
- **CSV import**: Upload teams and players from CSV (batched for large rosters — 150+ players supported).
- **Invite & user management**: Super-admins generate invite codes; captains/players join via OTP signup.
- **Live auction flow**: Start, pause, resume, reset timer; control when each player goes under the hammer.
- **Static ledger**: Register sales/unsold, enforce purse and squad limits, undo last action, export reports.
- **Test auction runner**: Simulated live auction to dry-run configuration.
- **Export**: CSV reports for sold, unsold, and team-wise rosters.

### Captain & player experience (live mode)
- Join with a 6-digit room code.
- Real-time bidding with dynamic increments.
- Bid rollback requests and pass/skip.
- Live wallet, squad count, and roster sync across all clients.

---

## 🛠️ Tech Stack

### Frontend
- React 18, TypeScript, Vite
- Tailwind CSS, shadcn/ui (Radix)
- TanStack React Query, Socket.io-client
- `zod`, `lucide-react`, `canvas-confetti`

### Backend
- Node.js, Express, TypeScript (`tsx` in dev)
- PostgreSQL + Prisma ORM
- Redis + Socket.io Redis adapter
- JWT access/refresh tokens, CSRF on auth routes, rate limiting
- OTP via EmailJS

### Deployment (production)
- **Frontend**: Vercel
- **Backend**: Render (`server/render.yaml`)
- **Database**: PostgreSQL (Supabase or self-hosted) — use pooled `DATABASE_URL` + direct `DIRECT_URL` for Prisma

---

## 📂 Project Structure

```
├── .env.example              # Frontend env template
├── docker-compose.yml        # Full stack: postgres, redis, server, frontend
├── docker-compose.dev.yml    # Hot-reload overrides for local dev
├── Dockerfile.frontend       # Production frontend (Vite + nginx)
├── Dockerfile.frontend.dev     # Dev frontend (Vite dev server)
├── nginx/default.conf        # API + Socket.io proxy for Docker frontend
├── samples/                  # Demo CSVs for static mode testing
│   ├── demo_static_teams_5.csv
│   └── demo_static_players_60.csv
├── scripts/                  # Smoke & isolation tests
├── server/                   # Express API + Socket.io
│   ├── Dockerfile            # Production backend
│   ├── Dockerfile.dev        # Dev backend with tsx watch
│   ├── prisma/schema.prisma
│   ├── render.yaml
│   └── src/
│       ├── controllers/      # Auction, auth, invite, team, player
│       ├── routes/v1/
│       ├── sockets/          # Live bidding handlers
│       └── middleware/
└── src/                      # React SPA
    ├── components/
    │   ├── admin/            # AuctionTab, StaticAuctionTab, StaticBidderBoard, …
    │   └── auction/          # AuctionRoom (live)
    ├── lib/                  # api.ts, static-auction-patch.ts, …
    └── pages/
```

---

## ⚙️ Installation & Setup

### Prerequisites
- **Node.js** v20+
- **npm**
- **Docker Desktop** (recommended — runs DB, Redis, API, and frontend together)

---

### Option A — Docker (recommended)

Runs **postgres**, **redis**, **backend**, and **frontend** in one command. No separate terminal windows or local DB install.

```bash
# Production-like build (nginx serves the frontend)
docker compose up --build

# Open the app
open http://localhost:8080
```

**Hot reload** (edit `src/` or `server/src/` without rebuilding images):

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

**Stop and reset database volumes:**

```bash
docker compose down -v
```

| Service   | URL / port |
|-----------|------------|
| Frontend  | http://localhost:8080 |
| API       | http://localhost:5001 |
| Postgres  | localhost:5432 (`bidarena` / `bidarena`) |
| Redis     | localhost:6379 |

Docker Compose sets `SIGNUP_BYPASS_CODE=TESTBYPASS` on the server so you can sign up locally without EmailJS or a real invite code. Use **`TESTBYPASS`** during signup.

To manage invite codes locally, add your email to `SUPER_ADMIN_EMAILS` in `docker-compose.yml` under the `server` service.

---

### Option B — Manual local development

#### 1. Environment files

**Backend** — copy `server/.env.example` → `server/.env`:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection (pooled in prod) |
| `DIRECT_URL` | Direct PostgreSQL URL (required for Prisma migrations) |
| `REDIS_URL` | Redis connection |
| `PORT` | Backend port (default `5001`) |
| `CLIENT_ORIGIN` | Frontend origin for CORS (default `http://localhost:8080`) |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | JWT signing secrets |
| `EMAILJS_*` | OTP email delivery (optional locally) |
| `SIGNUP_BYPASS_CODE` | Local signup shortcut (e.g. `TESTBYPASS`) |
| `SUPER_ADMIN_EMAILS` | Comma-separated emails allowed to create invites |

**Frontend** — copy `.env.example` → `.env`:

```env
VITE_API_URL=/api/v1
VITE_SERVER_URL=http://localhost:5001
```

Vite proxies `/api` to `VITE_SERVER_URL` during `npm run dev`.

#### 2. Start databases only (via Docker)

```bash
docker compose up postgres redis -d
```

#### 3. Backend

```bash
cd server
npm install
npx prisma db push
npm run dev
```

#### 4. Frontend (new terminal, project root)

```bash
npm install
npm run dev
```

Open **http://localhost:8080**.

---

## 🧪 Sample data (static mode)

Ready-made CSVs in `samples/`:

- `demo_static_teams_5.csv` — 5 teams, ₹10 cr purse, logos in Supabase `auction-media`
- `demo_static_players_60.csv` — 60 players, photos uploaded to Supabase Storage
- Regenerate: `cd server && npx tsx scripts/seed-demo-media.ts`

Create a **static** invite (super-admin) or sign up with bypass code + static mode, then import these files from the admin dashboard.

---

## 🛠️ Development scripts

### Frontend (root)

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite dev server on `:8080` |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview production build |

### Backend (`server/`)

| Command | Description |
|---------|-------------|
| `npm run dev` | `tsx watch` with hot reload |
| `npm run build` | Compile TypeScript + Prisma generate |
| `npm run start` | Run compiled `dist/index.js` |
| `npm run db:push` | Apply `schema.prisma` to database |
| `npm run db:migrate` | Create/apply migrations |
| `npm run db:studio` | Prisma Studio GUI |
| `npm run test:smoke` | Production API smoke tests |

### Repo scripts (`scripts/`)

| Script | Purpose |
|--------|---------|
| `scripts/production-smoke-test.ts` | End-to-end API checks |
| `scripts/static-ledger-smoke.ts` | Static auction sell/undo/unsold flow |
| `scripts/test-auction-isolation.ts` | Live auction isolation tests |

Run from `server/` where noted in each script, or via `npx tsx ../scripts/...`.

---

## 🌐 Production deployment

1. **Backend (Render)** — deploy `server/` using `render.yaml`. Set env vars from `server/.env.example`. Redeploy after pushing API changes (e.g. `/auctions/:id/static-board`).
2. **Frontend (Vercel)** — deploy root; set `VITE_API_URL` to your Render API base (e.g. `https://your-api.onrender.com/api/v1`) and `VITE_SERVER_URL` to the same host for Socket.io.
3. **Database** — Supabase PostgreSQL: `DATABASE_URL` = pooled (port 6543), `DIRECT_URL` = direct (port 5432).

After deploy, verify the backend route exists:

```bash
curl -s -o /dev/null -w "%{http_code}" https://YOUR_API/health
# Expect 200

curl -s https://YOUR_API/api/v1/auctions/test/static-board
# Expect auth error (401), not "Route not found"
```

---

## 🔒 Security & gating

1. **Invite-only signup** — Valid invite codes (generated by super-admin emails) gate who can register and which auction mode they receive.
2. **Signup bypass** — For local/Docker testing, use the code matching `SIGNUP_BYPASS_CODE` (default `TESTBYPASS`).
3. **JWT + CSRF** — Short-lived access tokens; refresh on auth routes only.

---

## 📄 License

This project is proprietary. All rights reserved. Contact [subscription.clashbid@gmail.com](mailto:subscription.clashbid@gmail.com) for inquiries.
