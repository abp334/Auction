import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is required");
}

const pool = new pg.Pool({
  connectionString,
  max: 10,
});

const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
  transactionOptions: {
    maxWait: 10000,
    timeout: 30000,
  },
  log:
    process.env.NODE_ENV === "development"
      ? ["warn", "error"]
      : ["error"],
});

export default prisma;

export async function connectDatabase() {
  await prisma.$connect();
}

export async function disconnectDatabase() {
  await prisma.$disconnect();
}
