# ClashBid 🏏

**ClashBid** is a high-performance, real-time cricket/sports auction platform designed for organizers to host seamless, interactive player auctions. Whether you are managing a local league, corporate tournament, or a large-scale event, ClashBid provides the administrative tools to import data, manage teams, track wallets, and execute live bidding with sub-second latency.

Live Demo: **[clashbid.live](https://clashbid.live)**

---

## 🚀 Key Features

### 🛠️ Admin Control Center
* **Dynamic Setup**: Initialize an auction room by uploading CSV files for teams and players or by using the manual panels.
* **Invite & User Management**: Generate secure invite codes to control who can sign up as admins or captains.
* **Real-time Flow Control**: Start, pause, resume, or reset the auction timer. Admin controls when players go under the hammer.
* **Squad & Wallet Validation**: Enforces squad limits (e.g., maximum squad size) and budget constraints dynamically.
* **Test Auction Runner**: Execute automated simulated auctions to dry-run configuration and performance.
* **Comprehensive Export**: Download detailed CSV reports of sold, unsold, and team-wise rosters after the auction ends.

### 🧢 Captain & Player Experience
* **Room Code Access**: Join active auctions instantly using a unique 6-digit room code.
* **Interactive Bidding**: Bid in real-time with dynamic bid increments automatically calculated based on the current player value.
* **Bid Management**: Captains can request bid rollbacks (undo last bid) or pass/skip players.
* **Live Roster & Wallet Tracking**: Live dashboards showing remaining wallet budget, current squad count, and full roster.
* **Instant Dynamic Sync**: All data, timers, and bids sync across all connected clients in real-time.

---

## 🛠️ Tech Stack

### Frontend (SPA)
* **Framework**: React 18 with TypeScript (bundled via Vite)
* **Styling**: Tailwind CSS & Tailwind CSS Animate
* **Components**: Radix UI primitives & shadcn/ui components (Dialogs, Tabs, Toasts, Cards, Resizable Panels)
* **Real-time client**: Socket.io-client for bi-directional live communications
* **State & Query Management**: TanStack React Query & Custom React Hooks
* **Utility Libraries**: `zod` for frontend form validations, `lucide-react` for icons, `canvas-confetti` for auction wins

### Backend (API & Real-time Server)
* **Runtime & Framework**: Node.js, Express, and TypeScript (run via `tsx`)
* **Database & ORM**: PostgreSQL, schema defined and queried using Prisma ORM
* **Caching & Scaling**: Redis used as a high-speed store and Socket.IO Redis adapter for multi-instance horizontal scalability
* **WebSocket Server**: Socket.io configured with Redis adapter, heartbeats, and custom reconnection rules
* **Security & Auth**:
  * JWT-based double token strategy (Access + Refresh tokens)
  * CSRF Protection on authentication routes
  * Rate-limiting on critical routes (e.g. general API, login/signup, and contact submissions)
  * OTP Verification (using email templates / EmailJS integration)

---

## 📂 Project Structure

```
├── .env.example             # Frontend environment variables template
├── components.json          # shadcn/ui component configuration
├── docker-compose.yml       # Docker services configuration (Postgres, Redis, Backend)
├── eslint.config.js         # ESLint style guidelines configuration
├── index.html               # Main single page entry point
├── package.json             # Root dependencies & scripts
├── postcss.config.js        # PostCSS configurations for Tailwind
├── public/                  # Static assets and icons
├── scripts/                 # Test suites & simulation scripts
│   ├── production-smoke-test.ts
│   └── test-auction-isolation.ts
├── server/                  # Backend application folder
│   ├── Dockerfile           # Backend container build configuration
│   ├── package.json         # Backend dependencies & scripts
│   ├── prisma/              # Prisma schema & migration configuration
│   │   ├── migrations/
│   │   └── schema.prisma
│   ├── render.yaml          # Infrastructure blueprint for Render deployment
│   ├── src/                 # Server source code
│   │   ├── controllers/     # Request handlers & logic
│   │   ├── index.ts         # Main server entrypoint
│   │   ├── middleware/      # Error handler, auth & rate limit middlewares
│   │   ├── routes/          # Express route declarations
│   │   ├── sockets/         # Socket.io handlers for live bidding
│   │   ├── types/           # TypeScript custom types
│   │   └── utils/           # Database, Redis, logger & auth helper tools
│   └── tsconfig.json
├── src/                     # Frontend source code
│   ├── App.css              # Custom scrollbars & overrides
│   ├── App.tsx              # React router configuration
│   ├── assets/              # Static frontend assets (images, logos)
│   ├── components/          # Reusable UI components & layouts
│   │   ├── admin/           # Panels for auction controls, invite codes, and users
│   │   ├── auction/         # Interactive Live bidding interface
│   │   └── ui/              # Atom level shadcn/ui primitives
│   ├── hooks/               # Custom hooks (auth, socket, timer)
│   ├── index.css            # Base Tailwind setup & CSS variables
│   ├── lib/                 # Utility helpers (e.g. cn tailwind merge)
│   ├── main.tsx             # React DOM entry mount point
│   ├── pages/               # Main application pages
│   └── tsconfig.json
└── tsconfig.json            # Base TS configuration
```

---

## ⚙️ Installation & Setup

### 1. Prerequisites
Ensure you have the following installed on your local machine:
* **Node.js** (v20+ recommended)
* **npm** or **Bun** package manager
* **Docker & Docker Compose** (optional, recommended for easy setup of Postgres and Redis)

---

### 2. Environment Setup

#### Backend configuration (`server/.env`)
Create a `.env` file inside the `server/` directory based on the `server/.env.example` template:

| Environment Variable | Description | Default / Example |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string (pooled) | `postgresql://bidarena:bidarena@localhost:5432/bidarena` |
| `DIRECT_URL` | PostgreSQL direct connection string (unpooled) | `postgresql://bidarena:bidarena@localhost:5432/bidarena` |
| `REDIS_URL` | Redis server connection string | `redis://localhost:6379` |
| `PORT` | Local port backend server will run on | `5001` |
| `CLIENT_ORIGIN` | Allowed CORS client origin | `http://localhost:8080` |
| `JWT_ACCESS_SECRET` | Secret key used for signing JWT Access Tokens | *Choose a strong secret* |
| `JWT_REFRESH_SECRET` | Secret key used for signing JWT Refresh Tokens | *Choose a strong secret* |
| `EMAILJS_SERVICE_ID` | EmailJS Service ID for OTP emails | *Your EmailJS Service ID* |
| `EMAILJS_TEMPLATE_ID` | EmailJS Template ID for OTP emails | *Your EmailJS Template ID* |
| `EMAILJS_USER_ID` | EmailJS User Public Key | *Your EmailJS Public Key* |
| `EMAILJS_PRIVATE_KEY` | EmailJS Private API Key | *Your EmailJS Private Key* |
| `SIGNUP_BYPASS_CODE` | Code to bypass email/invite gates during local testing | `TESTBYPASS` |
| `SUPER_ADMIN_EMAILS` | Comma-separated admin emails allowed to generate invites | `admin@example.com` |

#### Frontend configuration (`.env`)
Create a `.env` file in the **root** folder based on the `.env.example` template:

```env
VITE_API_URL=http://localhost:5001/api/v1
VITE_SERVER_URL=http://localhost:5001
```

---

### 3. Run with Docker Compose (Recommended)
You can bring up all services (PostgreSQL, Redis, Backend Server) automatically using Docker:

```bash
# Start all services in the background
docker-compose up -d --build
```
This automatically applies migrations (`npx prisma db push`) and starts the server on port `5001`.

---

### 4. Manual Running for Local Development
If you prefer running services manually:

#### A. Run Databases
Ensure PostgreSQL and Redis are running locally on their default ports (`5432` and `6379`). You can use docker-compose to run only the databases:
```bash
docker-compose up postgres redis -d
```

#### B. Setup & Run Backend
1. Navigate to the server folder:
   ```bash
   cd server
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Generate Prisma client & apply database schema:
   ```bash
   npx prisma db push
   # OR for standard migrations:
   # npx prisma migrate dev
   ```
4. Start the backend development server (hot reload enabled):
   ```bash
   npm run dev
   ```

#### C. Setup & Run Frontend
1. In a new terminal window, navigate to the project root:
   ```bash
   npm install
   ```
2. Start the Vite frontend application:
   ```bash
   npm run dev
   ```
3. Open your browser and navigate to `http://localhost:8080` (or the port specified in console output).

---

## 🛠️ Handy Development Scripts

### Database Operations (inside `server/` directory)
* **Generate Client**: `npx prisma generate` (runs automatically during builds)
* **Sync Schema**: `npm run db:push` (applies `schema.prisma` definitions straight to DB)
* **Create Migrations**: `npm run db:migrate` (creates incremental SQL migration steps)
* **Database UI**: `npm run db:studio` (opens a local graphical web editor to view and edit database rows)

### Server Tests
* **Smoke Testing**: Validate key APIs, socket behaviors, and server stability:
  ```bash
  cd server
  npm run test:smoke
  ```

---

## 🔒 Security Auditing & Gating
To prevent abuse, ClashBid includes:
1. **Invite-Only Gating**: Only users possessing valid invite codes generated by a `SUPER_ADMIN` email can create rooms or participate.
2. **Signup Bypass**: During testing, signups can bypass invites if they supply the code matching the backend `SIGNUP_BYPASS_CODE` env variable.
3. **JWT Double Token auth**: Short-lived access tokens are verified against CSRF headers, with refresh tokens securely processed only on auth endpoints.

---

## 📄 License
This project is proprietary. All rights reserved. Refer to local project owners or contact organizers at [subscription.clashbid@gmail.com](mailto:subscription.clashbid@gmail.com) for inquiries.
