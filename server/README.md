# ClashBid Backend Server 🏏

This directory contains the Express, Socket.io, Prisma, and Redis-enabled backend server for **ClashBid**.

## ⚙️ Quick Start

For full project setup instructions, including Docker configurations and frontend details, please refer to the main [README.md (Root)](../README.md).

### 1. Environment Configuration
Create a `.env` file in this directory (`server/`) based on the `.env.example` template:

```env
DATABASE_URL=postgresql://bidarena:bidarena@localhost:5432/bidarena
DIRECT_URL=postgresql://bidarena:bidarena@localhost:5432/bidarena
REDIS_URL=redis://localhost:6379
PORT=5001
CLIENT_ORIGIN=http://localhost:8080
JWT_ACCESS_SECRET=your-access-secret-here
JWT_REFRESH_SECRET=your-refresh-secret-here
```

### 2. Development Setup

```bash
# Install backend dependencies
npm install

# Apply database schema via Prisma
npx prisma db push

# Start the tsx watch development server
npm run dev
```

## 🛠️ Available Scripts

* `npm run dev`: Start backend server with active watch reload (`tsx watch src/index.ts`)
* `npm run build`: Generate Prisma client and compile TypeScript to `dist/`
* `npm run start`: Run the compiled production JavaScript build
* `npm run test:smoke`: Execute the production integration smoke tests
* `npm run db:push`: Push local prisma schema state straight to database
* `npm run db:migrate`: Manage database schema changes via Prisma migrations
* `npm run db:studio`: Launch Prisma GUI to explore/modify DB tables
