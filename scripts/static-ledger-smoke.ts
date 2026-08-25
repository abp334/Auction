/**
 * Static ledger integration smoke test (Prisma-level, no HTTP).
 * Creates a static auction, sells, rejects overspend, undoes, marks unsold,
 * completes, reopens, deletes. Cleans up after itself.
 */
import prisma from "../server/src/utils/db.js";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
}

async function wipeAuction(auctionId: string) {
  const auction = await prisma.auction.findUnique({
    where: { id: auctionId },
    include: {
      teams: { select: { teamId: true } },
      players: { select: { playerId: true } },
    },
  });
  if (!auction) return;
  const teamIds = auction.teams.map((t) => t.teamId);
  const playerIds = auction.players.map((p) => p.playerId);
  await prisma.auction.delete({ where: { id: auctionId } });
  if (playerIds.length) await prisma.player.deleteMany({ where: { id: { in: playerIds } } });
  if (teamIds.length) await prisma.team.deleteMany({ where: { id: { in: teamIds } } });
}

async function main() {
  const stamp = Date.now();
  let auctionId = "";

  try {
    const t1 = await prisma.team.create({
      data: { name: `Smoke T1 ${stamp}`, wallet: 5000 },
    });
    const t2 = await prisma.team.create({
      data: { name: `Smoke T2 ${stamp}`, wallet: 3000 },
    });
    const p1 = await prisma.player.create({
      data: { name: `P1 ${stamp}`, role: "Batsman", basePrice: 1000 },
    });
    const p2 = await prisma.player.create({
      data: { name: `P2 ${stamp}`, role: "Bowler", basePrice: 1500 },
    });
    const p3 = await prisma.player.create({
      data: { name: `P3 ${stamp}`, role: "All-Rounder", basePrice: 2000 },
    });

    const auction = await prisma.auction.create({
      data: {
        name: `Static Smoke ${stamp}`,
        roomCode: `S${String(stamp).slice(-5)}`,
        state: "active",
        mode: "static",
        maxSquadSize: 2,
        currentPlayerId: p1.id,
      },
    });
    auctionId = auction.id;

    await prisma.auctionTeam.createMany({
      data: [
        { auctionId, teamId: t1.id },
        { auctionId, teamId: t2.id },
      ],
    });
    await prisma.auctionPlayer.createMany({
      data: [
        { auctionId, playerId: p1.id, sortOrder: 0 },
        { auctionId, playerId: p2.id, sortOrder: 1 },
        { auctionId, playerId: p3.id, sortOrder: 2 },
      ],
    });

    // 1) Sell P1 to T1 for 2000
    await prisma.$transaction([
      prisma.team.update({ where: { id: t1.id }, data: { wallet: { decrement: 2000 } } }),
      prisma.player.update({ where: { id: p1.id }, data: { teamId: t1.id } }),
      prisma.sale.create({
        data: { auctionId, playerId: p1.id, teamId: t1.id, price: 2000 },
      }),
    ]);
    let team1 = await prisma.team.findUniqueOrThrow({ where: { id: t1.id } });
    assert(team1.wallet === 3000, `wallet after sale expected 3000 got ${team1.wallet}`);

    // 2) Unique sale constraint — second sale for same player must fail
    let dupFailed = false;
    try {
      await prisma.sale.create({
        data: { auctionId, playerId: p1.id, teamId: t2.id, price: 1000 },
      });
    } catch {
      dupFailed = true;
    }
    assert(dupFailed, "duplicate sale should fail unique constraint");

    // 3) Budget check simulation: T2 cannot afford 4000
    team1 = await prisma.team.findUniqueOrThrow({ where: { id: t2.id } });
    assert(team1.wallet < 4000, "T2 should not afford 4000");

    // 4) Sell P2 to T1 — squad size becomes 2 (max)
    await prisma.$transaction([
      prisma.team.update({ where: { id: t1.id }, data: { wallet: { decrement: 1500 } } }),
      prisma.player.update({ where: { id: p2.id }, data: { teamId: t1.id } }),
      prisma.sale.create({
        data: { auctionId, playerId: p2.id, teamId: t1.id, price: 1500 },
      }),
    ]);
    const squad = await prisma.player.count({ where: { teamId: t1.id } });
    assert(squad === 2, `squad size expected 2 got ${squad}`);
    assert(squad >= 2, "squad should be full for maxSquadSize=2");

    // 5) Mark P3 unsold
    await prisma.$transaction([
      prisma.unsoldPlayer.create({ data: { auctionId, playerId: p3.id } }),
      prisma.player.update({ where: { id: p3.id }, data: { isUnsold: true } }),
    ]);

    // 6) Undo P2 sale — wallet restore
    const sale2 = await prisma.sale.findUniqueOrThrow({
      where: { auctionId_playerId: { auctionId, playerId: p2.id } },
    });
    await prisma.$transaction([
      prisma.team.update({
        where: { id: sale2.teamId },
        data: { wallet: { increment: sale2.price } },
      }),
      prisma.player.update({ where: { id: p2.id }, data: { teamId: null } }),
      prisma.sale.delete({
        where: { auctionId_playerId: { auctionId, playerId: p2.id } },
      }),
    ]);
    team1 = await prisma.team.findUniqueOrThrow({ where: { id: t1.id } });
    // After undoing P2 (1500), wallet returns to post-P1 state: 3000
    assert(team1.wallet === 3000, `wallet after undo expected 3000 got ${team1.wallet}`);
    const squadAfterUndo = await prisma.player.count({ where: { teamId: t1.id } });
    assert(squadAfterUndo === 1, `squad after undo expected 1 got ${squadAfterUndo}`);

    // 7) CSV order preserved
    const ordered = await prisma.auctionPlayer.findMany({
      where: { auctionId },
      orderBy: { sortOrder: "asc" },
      select: { playerId: true, sortOrder: true },
    });
    assert(ordered[0].playerId === p1.id && ordered[0].sortOrder === 0, "order 0");
    assert(ordered[1].playerId === p2.id && ordered[1].sortOrder === 1, "order 1");
    assert(ordered[2].playerId === p3.id && ordered[2].sortOrder === 2, "order 2");

    // 8) Complete / reopen
    await prisma.auction.update({
      where: { id: auctionId },
      data: { state: "completed", currentPlayerId: null },
    });
    let a = await prisma.auction.findUniqueOrThrow({ where: { id: auctionId } });
    assert(a.state === "completed", "should be completed");
    await prisma.auction.update({
      where: { id: auctionId },
      data: { state: "active", currentPlayerId: p2.id },
    });
    a = await prisma.auction.findUniqueOrThrow({ where: { id: auctionId } });
    assert(a.state === "active", "should reopen to active");

    // 9) Invite mode field
    const invite = await prisma.inviteCode.create({
      data: { code: `SMK${stamp}`.slice(0, 8).toUpperCase(), auctionMode: "static" },
    });
    assert(invite.auctionMode === "static", "invite mode static");
    await prisma.inviteCode.delete({ where: { id: invite.id } });

    console.log("PASS: static ledger smoke checks");
  } finally {
    if (auctionId) await wipeAuction(auctionId);
    await prisma.$disconnect();
  }
}

main().catch(async (e) => {
  console.error("FAIL:", e);
  await prisma.$disconnect();
  process.exit(1);
});
