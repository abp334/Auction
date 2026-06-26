/**
 * End-to-end verification for test auction seed (timing + isolation).
 * Run: cd server && npx tsx scripts/verify-test-seed.ts
 */
import "dotenv/config";
import prisma from "../src/utils/db.js";
import { hashPassword } from "../src/utils/auth.js";
import {
  buildTestAuctionPayload,
  buildTestCredentials,
  isTestParticipantEmail,
} from "../src/utils/testAuctionSeed.js";
import { wipeAllTestAuctions } from "../src/utils/testAuctionCleanup.js";
import { getSuperAdminEmails } from "../src/utils/superAdmin.js";
import { seedTestAuction } from "../src/controllers/auction.controller.js";
import type { Response } from "express";

const BACKEND =
  process.env.BACKEND_URL || "https://auction-nsx0.onrender.com";

function buildCaptainPassword(teamName: string) {
  return teamName.replace(/\s+/g, "");
}

function buildPlayerPassword(playerName: string) {
  return playerName.replace(/\s+/g, "");
}

type Result = { name: string; ok: boolean; ms?: number; detail?: string };
const results: Result[] = [];

function record(r: Result) {
  results.push(r);
  const icon = r.ok ? "✓" : "✗";
  const ms = r.ms != null ? ` (${r.ms}ms)` : "";
  console.log(`  ${icon} ${r.name}${ms}${r.detail ? ` — ${r.detail}` : ""}`);
}

async function login(email: string, password: string) {
  const res = await fetch(`${BACKEND}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.accessToken as string;
}

async function api(token: string, path: string, init?: RequestInit) {
  return fetch(`${BACKEND}/api/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
}

async function benchmarkPasswordHashing() {
  console.log("\n[1] Password hashing benchmark (16 users, parallel)");
  const payload = buildTestAuctionPayload();
  const start = performance.now();
  await Promise.all([
    ...payload.teams.map((t) =>
      hashPassword(buildCaptainPassword(t.name))
    ),
    ...payload.players.map((p) =>
      hashPassword(buildPlayerPassword(p.name))
    ),
  ]);
  const ms = Math.round(performance.now() - start);
  const ok = ms < 25_000;
  record({
    name: "Parallel bcrypt for 16 users completes under 25s",
    ok,
    ms,
    detail: ok ? "safe outside 30s tx window" : "still risky on cold Render",
  });
}

async function verifyTestEmails() {
  console.log("\n[2] Test data email domain");
  const payload = buildTestAuctionPayload();
  const allEmails = [
    ...payload.teams.map((t) => t.captainEmail),
    ...payload.players.map((p) => p.email),
  ];
  const bad = allEmails.filter((e) => !isTestParticipantEmail(e || ""));
  record({
    name: "All seed emails use @test.clashbid",
    ok: bad.length === 0,
    detail: bad.length ? `bad: ${bad.join(", ")}` : `${allEmails.length} emails`,
  });
}

async function verifyDbColumn() {
  console.log("\n[3] Database schema");
  try {
    const rows = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'auctions' AND column_name = 'isTest'
    `;
    record({
      name: "auctions.isTest column exists",
      ok: rows.length === 1,
    });
  } catch (err: any) {
    record({ name: "auctions.isTest column exists", ok: false, detail: err.message });
  }
}

async function verifyProductionSeed() {
  console.log("\n[4] Production seed-test API");
  const superEmails = getSuperAdminEmails();
  if (!superEmails.length) {
    record({
      name: "SUPER_ADMIN_EMAILS configured",
      ok: false,
      detail: "set in server/.env to run live seed test",
    });
    return;
  }
  record({
    name: "SUPER_ADMIN_EMAILS configured",
    ok: true,
    detail: superEmails.length + " email(s)",
  });

  const email = process.env.SUPER_ADMIN_TEST_EMAIL || superEmails[0];
  const password = process.env.SUPER_ADMIN_TEST_PASSWORD;
  if (!password) {
    record({
      name: "Live seed-test call",
      ok: false,
      detail: "set SUPER_ADMIN_TEST_PASSWORD in server/.env to run (not committed)",
    });
    return;
  }

  const anon = await fetch(`${BACKEND}/api/v1/auctions/seed-test`, {
    method: "POST",
  });
  record({
    name: "seed-test rejects unauthenticated",
    ok: anon.status === 401,
    detail: `HTTP ${anon.status}`,
  });

  const token = await login(email, password);
  if (!token) {
    record({ name: "Super admin login", ok: false, detail: email });
    return;
  }
  record({ name: "Super admin login", ok: true });

  const start = performance.now();
  const seedRes = await api(token, "/auctions/seed-test", { method: "POST" });
  const ms = Math.round(performance.now() - start);

  if (!seedRes.ok) {
    const err = await seedRes.text();
    record({
      name: "seed-test succeeds within 60s",
      ok: false,
      ms,
      detail: err.slice(0, 200),
    });
    return;
  }

  const data = await seedRes.json();
  record({
    name: "seed-test succeeds within 60s",
    ok: ms < 60_000,
    ms,
    detail: `room=${data.auction?.roomCode}`,
  });

  record({
    name: "Response includes credentials",
    ok:
      data.credentials?.captains?.length === 4 &&
      data.credentials?.players?.length === 12,
    detail: `${data.credentials?.captains?.length}c / ${data.credentials?.players?.length}p`,
  });

  const auctionId = data.auction?.id as string;

  const superList = await api(token, "/auctions");
  const auctions = (await superList.json()).auctions || [];
  const testAuctions = auctions.filter(
    (a: { isTest?: boolean; name?: string }) =>
      a.isTest || a.name === "ClashBid Test Auction"
  );
  record({
    name: "Only one sandbox auction after seed",
    ok: testAuctions.length === 1,
    detail: `count=${testAuctions.length}`,
  });

  const capToken = await login(
    "captain.alpha@test.clashbid",
    "TestTeamAlpha"
  );
  if (capToken) {
    const capList = await api(capToken, "/auctions");
    const capAuctions = (await capList.json()).auctions || [];
    record({
      name: "Test captain sees only sandbox auction",
      ok:
        capAuctions.length === 1 && capAuctions[0]?.id === auctionId,
      detail: `count=${capAuctions.length}`,
    });
  } else {
    record({
      name: "Test captain login",
      ok: false,
      detail: "captain.alpha@test.clashbid",
    });
  }

  // Re-seed to verify cleanup + no timeout on second run
  const start2 = performance.now();
  const seed2 = await api(token, "/auctions/seed-test", { method: "POST" });
  const ms2 = Math.round(performance.now() - start2);
  record({
    name: "Re-seed succeeds (wipe + create)",
    ok: seed2.ok && ms2 < 60_000,
    ms: ms2,
    detail: seed2.ok ? "ok" : await seed2.text().then((t) => t.slice(0, 120)),
  });
}

function mockRes() {
  let statusCode = 200;
  let body: unknown;
  const res = {
    status(code: number) {
      statusCode = code;
      return res;
    },
    json(data: unknown) {
      body = data;
      return res;
    },
    getStatusCode: () => statusCode,
    getBody: () => body,
  };
  return res;
}

async function verifyDirectDbSeed() {
  console.log("\n[5] Direct DB seed (full import path, same as production)");

  const superEmails = getSuperAdminEmails();
  if (!superEmails.length) {
    record({
      name: "Direct DB seed",
      ok: false,
      detail: "no SUPER_ADMIN_EMAILS",
    });
    return;
  }

  const superUser = await prisma.user.findFirst({
    where: { email: { in: superEmails, mode: "insensitive" } },
    select: { id: true, email: true },
  });
  const fallbackAdmin = !superUser
    ? await prisma.user.findFirst({
        where: { role: "admin" },
        select: { id: true, email: true },
      })
    : null;
  const actor = superUser || fallbackAdmin;

  if (!actor) {
    record({
      name: "Super admin user exists in DB",
      ok: false,
      detail: superEmails[0],
    });
    return;
  }
  record({
    name: "Seed actor user in DB",
    ok: true,
    detail: actor.email + (superUser ? "" : " (fallback admin)"),
  });

  const start = performance.now();
  const res = mockRes();
  await seedTestAuction(
    { user: { id: actor.id } } as Parameters<typeof seedTestAuction>[0],
    res as unknown as Response
  );
  const ms = Math.round(performance.now() - start);
  const status = res.getStatusCode();
  const body = res.getBody() as {
    auction?: { id: string; roomCode: string; isTest?: boolean };
    credentials?: { captains: unknown[]; players: unknown[] };
    error?: string;
  };

  record({
    name: "Direct seed completes within 60s",
    ok: status === 201 && ms < 60_000,
    ms,
    detail:
      status === 201
        ? `room=${body.auction?.roomCode}`
        : body.error?.slice(0, 160) || `HTTP ${status}`,
  });

  if (status !== 201 || !body.auction?.id) return;

  const auction = await prisma.auction.findUnique({
    where: { id: body.auction.id },
    select: {
      isTest: true,
      name: true,
      teams: { select: { teamId: true } },
      players: { select: { playerId: true } },
    },
  });

  record({
    name: "Auction marked isTest in DB",
    ok: auction?.isTest === true,
    detail: `isTest=${auction?.isTest}`,
  });

  record({
    name: "4 teams + 12 players linked",
    ok: auction?.teams.length === 4 && auction?.players.length === 12,
    detail: `${auction?.teams.length}t / ${auction?.players.length}p`,
  });

  const testAuctionCount = await prisma.auction.count({
    where: {
      OR: [{ isTest: true }, { name: "ClashBid Test Auction" }],
    },
  });
  record({
    name: "Single sandbox auction in DB",
    ok: testAuctionCount === 1,
    detail: `count=${testAuctionCount}`,
  });

  // Re-seed: wipe + create again (catches timeout on second run)
  const start2 = performance.now();
  const res2 = mockRes();
  await seedTestAuction(
    { user: { id: actor.id } } as Parameters<typeof seedTestAuction>[0],
    res2 as unknown as Response
  );
  const ms2 = Math.round(performance.now() - start2);
  record({
    name: "Re-seed direct (wipe + create)",
    ok: res2.getStatusCode() === 201 && ms2 < 60_000,
    ms: ms2,
  });

  const capUser = await prisma.user.findUnique({
    where: { email: "captain.alpha@test.clashbid" },
    select: { auctionId: true },
  });
  const body2 = res2.getBody() as { auction?: { id: string } };
  record({
    name: "Test captain reassigned to new auction",
    ok: capUser?.auctionId === body2.auction?.id,
  });
}

async function main() {
  console.log("════════════════════════════════════════");
  console.log("  Test Auction Seed — Verification");
  console.log("  Backend:", BACKEND);
  console.log("════════════════════════════════════════");

  await benchmarkPasswordHashing();
  await verifyTestEmails();
  await verifyDbColumn();
  await verifyDirectDbSeed();
  await verifyProductionSeed();

  const failed = results.filter((r) => !r.ok).length;
  console.log("\n════════════════════════════════════════");
  console.log(
    `  ${results.length - failed}/${results.length} passed` +
      (failed ? ` (${failed} failed)` : "")
  );
  console.log("════════════════════════════════════════\n");

  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
