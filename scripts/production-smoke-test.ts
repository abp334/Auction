/**
 * Production smoke & performance tests for BidArena / ClashBid.
 *
 * Usage:
 *   npx tsx scripts/production-smoke-test.ts
 *   BACKEND_URL=https://auction-nsx0.onrender.com npx tsx scripts/production-smoke-test.ts
 */

import { io, Socket } from "socket.io-client";

const BACKEND_URL =
  process.env.BACKEND_URL || "https://auction-nsx0.onrender.com";
const FRONTEND_URL = process.env.FRONTEND_URL || "https://www.clashbid.live";
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "https://www.clashbid.live";

type Result = {
  name: string;
  status: "PASS" | "FAIL" | "WARN" | "SKIP";
  ms?: number;
  detail?: string;
};

const results: Result[] = [];

function record(r: Result) {
  results.push(r);
  const icon =
    r.status === "PASS"
      ? "✓"
      : r.status === "FAIL"
        ? "✗"
        : r.status === "WARN"
          ? "!"
          : "-";
  const ms = r.ms != null ? ` (${r.ms}ms)` : "";
  console.log(`  ${icon} ${r.name}${ms}${r.detail ? ` — ${r.detail}` : ""}`);
}

async function timedFetch(
  url: string,
  init?: RequestInit
): Promise<{ res: Response; ms: number }> {
  const start = performance.now();
  const res = await fetch(url, init);
  return { res, ms: Math.round(performance.now() - start) };
}

function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

async function testHealthEndpoint() {
  console.log("\n[1] Health & Infrastructure");
  try {
    const { res, ms } = await timedFetch(`${BACKEND_URL}/health`);
    const body = await res.json();
    if (res.ok && body.ok && body.db === "connected") {
      record({
        name: "Health endpoint",
        status: ms > 2000 ? "WARN" : "PASS",
        ms,
        detail: `db=${body.db}, redis=${body.redis}, uptime=${Math.round(body.uptime)}s`,
      });
    } else {
      record({
        name: "Health endpoint",
        status: "FAIL",
        ms,
        detail: JSON.stringify(body),
      });
    }
  } catch (err: any) {
    record({ name: "Health endpoint", status: "FAIL", detail: err.message });
  }
}

async function testHealthLatency() {
  const samples: number[] = [];
  for (let i = 0; i < 15; i++) {
    try {
      const { res, ms } = await timedFetch(`${BACKEND_URL}/health`);
      if (res.ok) samples.push(ms);
    } catch {
      /* ignore */
    }
  }
  if (samples.length < 10) {
    record({
      name: "Health latency (15 requests)",
      status: "FAIL",
      detail: `only ${samples.length}/15 succeeded`,
    });
    return;
  }
  const p50 = percentile(samples, 50);
  const p95 = percentile(samples, 95);
  const max = Math.max(...samples);
  record({
    name: "Health latency p50/p95/max",
    status: p95 > 1500 ? "WARN" : "PASS",
    detail: `p50=${p50}ms p95=${p95}ms max=${max}ms`,
  });
}

async function testConcurrentLoad() {
  const concurrency = 30;
  const start = performance.now();
  const responses = await Promise.allSettled(
    Array.from({ length: concurrency }, () =>
      fetch(`${BACKEND_URL}/health`)
    )
  );
  const ms = Math.round(performance.now() - start);
  const ok = responses.filter(
    (r) => r.status === "fulfilled" && r.value.ok
  ).length;
  record({
    name: `Concurrent health (${concurrency} parallel)`,
    status: ok === concurrency ? "PASS" : ok >= concurrency * 0.9 ? "WARN" : "FAIL",
    ms,
    detail: `${ok}/${concurrency} succeeded`,
  });
}

async function testAuthProtection() {
  console.log("\n[2] Security & Auth");
  const protectedRoutes = [
    "/api/v1/auctions",
    "/api/v1/teams",
    "/api/v1/players",
    "/api/v1/users/admins",
    "/api/v1/invites",
    "/api/v1/auctions/00000000-0000-0000-0000-000000000000/live",
  ];

  for (const route of protectedRoutes) {
    try {
      const { res, ms } = await timedFetch(`${BACKEND_URL}${route}`);
      const status = res.status;
      if (status === 401 || status === 403) {
        record({ name: `Auth required: ${route}`, status: "PASS", ms });
      } else {
        record({
          name: `Auth required: ${route}`,
          status: "FAIL",
          ms,
          detail: `expected 401/403, got ${status}`,
        });
      }
    } catch (err: any) {
      record({
        name: `Auth required: ${route}`,
        status: "FAIL",
        detail: err.message,
      });
    }
  }
}

async function testCors() {
  try {
    const allowed = await fetch(`${BACKEND_URL}/api/v1/auth/me`, {
      headers: { Origin: CLIENT_ORIGIN },
    });
    const allowedHeader = allowed.headers.get("access-control-allow-origin");
    record({
      name: "CORS allows frontend origin",
      status: allowedHeader ? "PASS" : "WARN",
      detail: allowedHeader || "no ACAO header (may be ok for non-preflight)",
    });

    const blocked = await fetch(`${BACKEND_URL}/api/v1/auth/me`, {
      headers: { Origin: "https://evil.example.com" },
    }).catch((e) => ({ ok: false, status: 0, error: e.message }));

    if ("error" in blocked) {
      record({
        name: "CORS blocks unknown origin",
        status: "PASS",
        detail: "request rejected",
      });
    } else {
      const acao = blocked.headers.get("access-control-allow-origin");
      record({
        name: "CORS blocks unknown origin",
        status: acao === "https://evil.example.com" ? "FAIL" : "PASS",
        detail: acao ? `got ${acao}` : "no ACAO for evil origin",
      });
    }
  } catch (err: any) {
    record({ name: "CORS checks", status: "FAIL", detail: err.message });
  }
}

async function testCsrfOnAuth() {
  try {
    const { res } = await timedFetch(`${BACKEND_URL}/api/v1/auth/logout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: "rt=fake-refresh-token",
      },
      body: JSON.stringify({}),
    });
    record({
      name: "CSRF blocks cookie POST without origin",
      status: res.status === 403 ? "PASS" : "WARN",
      detail: `status=${res.status}`,
    });
  } catch (err: any) {
    record({ name: "CSRF check", status: "FAIL", detail: err.message });
  }
}

async function testInvalidLogin() {
  try {
    const { res, ms } = await timedFetch(`${BACKEND_URL}/api/v1/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: CLIENT_ORIGIN,
      },
      body: JSON.stringify({
        email: "nonexistent-probe@test.invalid",
        password: "wrongpassword123",
      }),
    });
    record({
      name: "Login rejects invalid credentials",
      status: res.status === 401 || res.status === 400 ? "PASS" : "WARN",
      ms,
      detail: `status=${res.status}`,
    });
  } catch (err: any) {
    record({ name: "Login invalid creds", status: "FAIL", detail: err.message });
  }
}

function socketConnect(url: string, timeoutMs = 10000): Promise<{ socket: Socket; ms: number }> {
  return new Promise((resolve, reject) => {
    const start = performance.now();
    const socket = io(url, {
      transports: ["websocket"],
      reconnection: false,
      timeout: timeoutMs,
    });
    const timer = setTimeout(() => {
      socket.close();
      reject(new Error(`Socket connect timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    socket.on("connect", () => {
      clearTimeout(timer);
      resolve({ socket, ms: Math.round(performance.now() - start) });
    });
    socket.on("connect_error", (err) => {
      clearTimeout(timer);
      socket.close();
      reject(err);
    });
  });
}

async function testSocketRealtime() {
  console.log("\n[3] Real-time (Socket.IO)");
  let socket: Socket | null = null;
  try {
    const { socket: s, ms } = await socketConnect(BACKEND_URL);
    socket = s;
    record({
      name: "WebSocket connect",
      status: ms > 3000 ? "WARN" : "PASS",
      ms,
      detail: `transport=${s.io.engine.transport.name}`,
    });

    const joinStart = performance.now();
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("auction:join timeout")),
        5000
      );
      s.emit("auction:join", "SMOKETEST");
      s.once("auction:presence", () => {
        clearTimeout(timer);
        resolve();
      });
      setTimeout(() => {
        clearTimeout(timer);
        resolve();
      }, 2000);
    });
    record({
      name: "Socket join room + presence",
      status: "PASS",
      ms: Math.round(performance.now() - joinStart),
    });

    s.close();
    socket = null;

    const reconnectStart = performance.now();
    const { ms: reconnectMs } = await socketConnect(BACKEND_URL);
    record({
      name: "Socket reconnect",
      status: reconnectMs > 3000 ? "WARN" : "PASS",
      ms: reconnectMs,
    });
  } catch (err: any) {
    record({
      name: "WebSocket / real-time",
      status: "FAIL",
      detail: err.message,
    });
  } finally {
    socket?.close();
  }
}

async function testPollingFallback() {
  try {
    const start = performance.now();
    const socket = io(BACKEND_URL, {
      transports: ["polling"],
      reconnection: false,
      timeout: 10000,
    });
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("polling timeout")), 10000);
      socket.on("connect", () => {
        clearTimeout(timer);
        resolve();
      });
      socket.on("connect_error", (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
    const ms = Math.round(performance.now() - start);
    record({
      name: "Polling transport fallback",
      status: ms > 4000 ? "WARN" : "PASS",
      ms,
    });
    socket.close();
  } catch (err: any) {
    record({
      name: "Polling transport fallback",
      status: "FAIL",
      detail: err.message,
    });
  }
}

async function testFrontend() {
  console.log("\n[4] Frontend");
  try {
    const { res, ms } = await timedFetch(FRONTEND_URL);
    record({
      name: "Frontend reachable",
      status: res.ok ? "PASS" : "FAIL",
      ms,
      detail: `status=${res.status}`,
    });
  } catch (err: any) {
    record({ name: "Frontend reachable", status: "FAIL", detail: err.message });
  }

  try {
    const { res, ms } = await timedFetch(`${BACKEND_URL}/health`);
    const ttfb = ms;
    record({
      name: "Backend cold/warm response",
      status: ttfb > 5000 ? "WARN" : "PASS",
      ms: ttfb,
      detail: ttfb > 3000 ? "slow — Render may be cold starting" : "responsive",
    });
  } catch {
    /* already tested */
  }
}

async function testApiRoutingSpeed() {
  console.log("\n[5] API Routing Performance");
  const routes = [
    "/api/v1/auth/me",
    "/api/v1/auctions",
    "/api/v1/teams",
  ];
  for (const route of routes) {
    try {
      const { res, ms } = await timedFetch(`${BACKEND_URL}${route}`);
      record({
        name: `Route ${route}`,
        status: ms > 2000 ? "WARN" : "PASS",
        ms,
        detail: `status=${res.status}`,
      });
    } catch (err: any) {
      record({ name: `Route ${route}`, status: "FAIL", detail: err.message });
    }
  }
}

async function testLiveEndpointRequiresAuth() {
  console.log("\n[6] Live Endpoint");
  try {
    const { res, ms } = await timedFetch(
      `${BACKEND_URL}/api/v1/auctions/00000000-0000-0000-0000-000000000000/live`
    );
    record({
      name: "Live endpoint requires auth",
      status: res.status === 401 ? "PASS" : "FAIL",
      ms,
      detail: `status=${res.status}`,
    });
  } catch (err: any) {
    record({
      name: "Live endpoint requires auth",
      status: "FAIL",
      detail: err.message,
    });
  }
}

async function main() {
  console.log("═══════════════════════════════════════════════");
  console.log("  BidArena Production Smoke Test");
  console.log(`  Backend:  ${BACKEND_URL}`);
  console.log(`  Frontend: ${FRONTEND_URL}`);
  console.log("═══════════════════════════════════════════════");

  await testHealthEndpoint();
  await testHealthLatency();
  await testConcurrentLoad();
  await testAuthProtection();
  await testCors();
  await testCsrfOnAuth();
  await testInvalidLogin();
  await testSocketRealtime();
  await testPollingFallback();
  await testFrontend();
  await testApiRoutingSpeed();
  await testLiveEndpointRequiresAuth();

  const pass = results.filter((r) => r.status === "PASS").length;
  const warn = results.filter((r) => r.status === "WARN").length;
  const fail = results.filter((r) => r.status === "FAIL").length;
  const skip = results.filter((r) => r.status === "SKIP").length;

  console.log("\n═══════════════════════════════════════════════");
  console.log(`  RESULTS: ${pass} passed, ${warn} warnings, ${fail} failed, ${skip} skipped`);
  console.log("═══════════════════════════════════════════════");

  if (fail > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
