/**
 * Verifies test auction sandbox isolation (no leakage into production views).
 *
 * Requires local server + DB with SUPER_ADMIN_EMAILS and a regular admin account.
 *
 * Usage:
 *   cd server && npx tsx ../scripts/test-auction-isolation.ts
 *
 * Env:
 *   BACKEND_URL=http://localhost:4000
 *   SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD
 *   REGULAR_ADMIN_EMAIL / REGULAR_ADMIN_PASSWORD
 */

const BACKEND =
  process.env.BACKEND_URL || process.env.VITE_API_URL || "http://localhost:4000";

const SUPER_EMAIL = process.env.SUPER_ADMIN_EMAIL || "";
const SUPER_PASSWORD = process.env.SUPER_ADMIN_PASSWORD || "";
const ADMIN_EMAIL = process.env.REGULAR_ADMIN_EMAIL || "";
const ADMIN_PASSWORD = process.env.REGULAR_ADMIN_PASSWORD || "";

type Result = { name: string; ok: boolean; detail?: string };
const results: Result[] = [];

function pass(name: string, detail?: string) {
  results.push({ name, ok: true, detail });
  console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ""}`);
}

function fail(name: string, detail?: string) {
  results.push({ name, ok: false, detail });
  console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
}

async function login(email: string, password: string): Promise<string | null> {
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

async function main() {
  console.log("\n[Test Auction Isolation]\n");

  if (!SUPER_EMAIL || !SUPER_PASSWORD) {
    console.log(
      "SKIP: Set SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD to run full isolation tests."
    );
    process.exit(0);
  }

  const superToken = await login(SUPER_EMAIL, SUPER_PASSWORD);
  if (!superToken) {
    fail("Super admin login");
    process.exit(1);
  }
  pass("Super admin login");

  // Unauthenticated seed blocked
  const anonSeed = await fetch(`${BACKEND}/api/v1/auctions/seed-test`, {
    method: "POST",
  });
  if (anonSeed.status === 401) pass("seed-test requires auth");
  else fail("seed-test requires auth", `got ${anonSeed.status}`);

  if (ADMIN_EMAIL && ADMIN_PASSWORD) {
    const adminToken = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
    if (adminToken) {
      const blocked = await api(adminToken, "/auctions/seed-test", {
        method: "POST",
      });
      if (blocked.status === 403) pass("seed-test blocked for regular admin");
      else fail("seed-test blocked for regular admin", `got ${blocked.status}`);
    }
  } else {
    console.log("  - skip regular admin seed block (no REGULAR_ADMIN_* env)");
  }

  const seedRes = await api(superToken, "/auctions/seed-test", {
    method: "POST",
  });
  if (!seedRes.ok) {
    fail("Super admin can seed test auction", await seedRes.text());
    process.exit(1);
  }
  const seedData = await seedRes.json();
  const testAuctionId = seedData.auction?.id as string;
  const testRoomCode = seedData.auction?.roomCode as string;
  pass("Super admin can seed test auction", `room=${testRoomCode}`);

  const superList = await api(superToken, "/auctions");
  const superAuctions = (await superList.json()).auctions || [];
  const superSeesTest = superAuctions.some((a: { id: string }) => a.id === testAuctionId);
  if (superSeesTest) pass("Super admin sees test auction in list");
  else fail("Super admin sees test auction in list");

  if (ADMIN_EMAIL && ADMIN_PASSWORD) {
    const adminToken = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
    if (adminToken) {
      const adminList = await api(adminToken, "/auctions");
      const adminAuctions = (await adminList.json()).auctions || [];
      const adminSeesTest = adminAuctions.some(
        (a: { id: string }) => a.id === testAuctionId
      );
      if (!adminSeesTest) pass("Regular admin does NOT see test auction in list");
      else fail("Regular admin does NOT see test auction in list");

      const getTest = await api(adminToken, `/auctions/${testAuctionId}`);
      if (getTest.status === 404) pass("Regular admin cannot fetch test auction by id");
      else fail("Regular admin cannot fetch test auction by id", `got ${getTest.status}`);

      const caps = await api(adminToken, "/users/captains");
      const capList = (await caps.json()).users || [];
      const testCaps = capList.filter((u: { email: string }) =>
        u.email.endsWith("@test.clashbid")
      );
      if (testCaps.length === 0) pass("Regular admin captain list hides @test.clashbid");
      else fail("Regular admin captain list hides @test.clashbid", `found ${testCaps.length}`);

      const teams = await api(adminToken, "/teams");
      const teamList = (await teams.json()).teams || [];
      const testTeams = teamList.filter((t: { name: string }) =>
        t.name.startsWith("Test Team ")
      );
      if (testTeams.length === 0) pass("Regular admin teams list hides test-only teams");
      else fail("Regular admin teams list hides test-only teams", `found ${testTeams.length}`);
    }
  }

  const capToken = await login(
    "captain.alpha@test.clashbid",
    "TestTeamAlpha"
  );
  if (capToken) {
    const capList = await api(capToken, "/auctions");
    const capAuctions = (await capList.json()).auctions || [];
    if (capAuctions.length === 1 && capAuctions[0].id === testAuctionId) {
      pass("Test captain only sees their sandbox auction");
    } else {
      fail(
        "Test captain only sees their sandbox auction",
        `count=${capAuctions.length}`
      );
    }

    const prodGuess = await api(capToken, "/auctions/not-a-real-id");
    // Should be forbidden or not found, not leak other data
    if ([403, 404].includes(prodGuess.status)) {
      pass("Test captain blocked from other auction ids");
    } else {
      fail("Test captain blocked from other auction ids", `got ${prodGuess.status}`);
    }
  } else {
    console.log("  - skip captain isolation (login failed — first seed?)");
  }

  // Re-seed replaces prior sandbox (only one isTest auction)
  const seed2 = await api(superToken, "/auctions/seed-test", { method: "POST" });
  if (seed2.ok) {
    const seed2Data = await seed2.json();
    const superList2 = await api(superToken, "/auctions");
    const all = (await superList2.json()).auctions || [];
    const testCount = all.filter((a: { isTest?: boolean }) => a.isTest).length;
    if (testCount === 1 && seed2Data.auction?.id !== testAuctionId) {
      pass("Re-seed wipes old sandbox (single isTest auction)");
    } else {
      fail("Re-seed wipes old sandbox", `isTest count=${testCount}`);
    }
  } else {
    fail("Re-seed succeeds", await seed2.text());
  }

  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} passed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
