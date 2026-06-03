import { getIO } from "../sockets/io.js";
import prisma from "./db.js";
import { logger } from "./logger.js";
import { acquireLock, releaseLock } from "./redis.js";

const activeTimers = new Map<string, NodeJS.Timeout>();
const pendingTimerResets = new Map<string, NodeJS.Timeout>();
export const auctionPlayerQueues = new Map<string, string[]>();

export async function initAuctionQueue(auctionId: string) {
  try {
    const auctionPlayers = await prisma.auctionPlayer.findMany({
      where: { auctionId },
      orderBy: { sortOrder: "asc" },
      select: { playerId: true },
    });

    const sales = await prisma.sale.findMany({
      where: { auctionId },
      select: { playerId: true },
    });

    const unsold = await prisma.unsoldPlayer.findMany({
      where: { auctionId },
      select: { playerId: true },
    });

    const soldIds = new Set(sales.map((s) => s.playerId));
    const unsoldIds = new Set(unsold.map((u) => u.playerId));

    const soldPlayerInfo = await prisma.player.findMany({
      where: { id: { in: auctionPlayers.map((ap) => ap.playerId) } },
      select: { id: true, teamId: true },
    });
    const assignedIds = new Set(
      soldPlayerInfo.filter((p) => p.teamId !== null).map((p) => p.id)
    );

    const queue = auctionPlayers
      .map((ap) => ap.playerId)
      .filter(
        (pid) => !soldIds.has(pid) && !unsoldIds.has(pid) && !assignedIds.has(pid)
      );

    auctionPlayerQueues.set(auctionId, queue);
  } catch (err) {
    logger.error({ err, auctionId }, "Failed to init auction queue");
  }
}

export async function restoreActiveTimers() {
  try {
    const activeAuctions = await prisma.auction.findMany({
      where: {
        state: "active",
        timerEndsAt: { not: null },
        currentPlayerId: { not: null },
      },
    });

    logger.info(
      { count: activeAuctions.length },
      "Checking active auctions for timer restoration"
    );

    for (const auction of activeAuctions) {
      if (!auction.currentPlayerId || !auction.timerEndsAt) continue;

      const endTime = new Date(auction.timerEndsAt).getTime();
      const duration = auction.timerDuration || 30;

      if (endTime > 0) {
        logger.info({ name: auction.name }, "Restoring timer for auction");
        await initAuctionQueue(auction.id);
        runTimerLoop(auction.id, auction.roomCode, endTime, duration);
      }
    }
  } catch (err) {
    logger.error({ err }, "Failed to restore timers");
  }
}

export async function startAuctionTimer(auctionId: string, roomCode: string) {
  stopAuctionTimer(auctionId);

  const auction = await prisma.auction.findUnique({
    where: { id: auctionId },
    select: { state: true, currentPlayerId: true, timerDuration: true },
  });

  if (!auction || auction.state !== "active" || !auction.currentPlayerId)
    return;

  const duration = auction.timerDuration || 30;
  const startTime = new Date();
  const endTimeMs = Date.now() + duration * 1000;

  await prisma.auction.update({
    where: { id: auctionId },
    data: {
      timerStart: startTime,
      timerEndsAt: new Date(endTimeMs),
    },
  });

  await prisma.skippedTeam.deleteMany({ where: { auctionId } });

  const io = getIO();
  io.to(roomCode).emit("auction:timer", {
    timeLeft: duration,
    totalTime: duration,
    endTime: endTimeMs,
  });

  runTimerLoop(auctionId, roomCode, endTimeMs, duration);
}

function runTimerLoop(
  auctionId: string,
  roomCode: string,
  endTimeMs: number,
  totalDuration: number
) {
  if (activeTimers.has(auctionId)) {
    clearInterval(activeTimers.get(auctionId));
  }

  const io = getIO();

  const timer = setInterval(async () => {
    const now = Date.now();

    if (now >= endTimeMs) {
      clearInterval(timer);
      activeTimers.delete(auctionId);
      handleTimerExpiry(auctionId, roomCode).catch((err) =>
        logger.error({ err, auctionId }, "Timer expiry handler failed")
      );
    } else if (Math.floor((endTimeMs - now) / 1000) % 5 === 0) {
      io.to(roomCode).emit("auction:timer", {
        timeLeft: Math.floor((endTimeMs - now) / 1000),
        totalTime: totalDuration,
        endTime: endTimeMs,
      });
    }
  }, 1000);

  activeTimers.set(auctionId, timer);
}

async function handleTimerExpiry(auctionId: string, roomCode: string) {
  const lockKey = `lock:timer:${auctionId}`;
  const acquired = await acquireLock(lockKey, 10000);
  if (!acquired) {
    logger.warn({ auctionId }, "Timer expiry lock not acquired, skipping");
    return;
  }

  try {
    const auction = await prisma.auction.findUnique({
      where: { id: auctionId },
      include: {
        skippedTeams: true,
        teams: { include: { team: { select: { id: true, captainId: true } } } },
      },
    });

    if (!auction || auction.state !== "active") return;

    const captainTeamIds = auction.teams
      .filter((at) => at.team.captainId)
      .map((at) => at.teamId);

    const allSkipped =
      captainTeamIds.length > 0 &&
      captainTeamIds.every((tid) =>
        auction.skippedTeams.some((st) => st.teamId === tid)
      );

    const currentBidderSkipped =
      auction.currentBidTeamId &&
      auction.skippedTeams.some(
        (st) => st.teamId === auction.currentBidTeamId
      );

    const hasBid = auction.currentBidAmount && auction.currentBidAmount >= 1000;

    if (allSkipped || currentBidderSkipped) {
      await markPlayerUnsold(auctionId, roomCode);
    } else if (hasBid) {
      await sellCurrentPlayer(auctionId, roomCode);
    } else {
      await markPlayerUnsold(auctionId, roomCode);
    }
  } finally {
    await releaseLock(lockKey);
  }
}

export async function sellCurrentPlayer(auctionId: string, roomCode: string) {
  const result = await prisma.$transaction(async (tx) => {
    const auction = await tx.$queryRawUnsafe<any[]>(
      `SELECT * FROM auctions WHERE id = $1 FOR UPDATE`,
      auctionId
    );
    const current = auction[0];
    if (
      !current ||
      !current.currentPlayerId ||
      !current.currentBidAmount ||
      !current.currentBidTeamId
    )
      return null;

    const existingSale = await tx.sale.findUnique({
      where: {
        auctionId_playerId: {
          auctionId,
          playerId: current.currentPlayerId,
        },
      },
    });
    if (existingSale) return null;

    const team = await tx.team.findUnique({
      where: { id: current.currentBidTeamId },
    });
    if (!team || team.wallet < current.currentBidAmount) return null;

    const player = await tx.player.findUnique({
      where: { id: current.currentPlayerId },
    });
    if (!player || (player.teamId && player.teamId !== null)) return null;

    await tx.team.update({
      where: { id: team.id },
      data: { wallet: { decrement: current.currentBidAmount } },
    });

    await tx.player.update({
      where: { id: player.id },
      data: { teamId: team.id },
    });

    await tx.sale.create({
      data: {
        auctionId,
        playerId: player.id,
        teamId: team.id,
        price: current.currentBidAmount,
      },
    });

    await tx.auction.update({
      where: { id: auctionId },
      data: {
        currentBidAmount: null,
        currentBidTeamId: null,
        currentBidAt: null,
      },
    });

    await tx.skippedTeam.deleteMany({ where: { auctionId } });

    return { player, team, price: current.currentBidAmount as number };
  });

  if (!result) return;

  const io = getIO();
  io.to(roomCode).emit("auction:sale", {
    playerId: result.player.id,
    playerName: result.player.name,
    teamId: result.team.id,
    teamName: result.team.name,
    price: result.price,
    saleType: "sold",
  });

  await moveToNextPlayer(auctionId, roomCode);
}

export async function markPlayerUnsold(auctionId: string, roomCode: string) {
  const auction = await prisma.auction.findUnique({
    where: { id: auctionId },
    select: { currentPlayerId: true },
  });
  if (!auction?.currentPlayerId) return;

  const player = await prisma.player.findUnique({
    where: { id: auction.currentPlayerId },
  });
  if (!player) return;

  await prisma.unsoldPlayer.upsert({
    where: {
      auctionId_playerId: { auctionId, playerId: player.id },
    },
    create: { auctionId, playerId: player.id },
    update: {},
  });

  await prisma.player.update({
    where: { id: player.id },
    data: { isUnsold: true },
  });

  await prisma.auction.update({
    where: { id: auctionId },
    data: {
      currentBidAmount: null,
      currentBidTeamId: null,
      currentBidAt: null,
    },
  });

  await prisma.skippedTeam.deleteMany({ where: { auctionId } });

  const io = getIO();
  io.to(roomCode).emit("auction:unsold", {
    playerId: player.id,
    playerName: player.name,
  });

  await moveToNextPlayer(auctionId, roomCode);
}

export async function moveToNextPlayer(auctionId: string, roomCode: string) {
  const auction = await prisma.auction.findUnique({
    where: { id: auctionId },
    select: { timerDuration: true, state: true },
  });
  if (!auction || auction.state !== "active") return;

  let queue = auctionPlayerQueues.get(auctionId) || [];

  const sales = await prisma.sale.findMany({
    where: { auctionId },
    select: { playerId: true },
  });
  const unsold = await prisma.unsoldPlayer.findMany({
    where: { auctionId },
    select: { playerId: true },
  });

  const soldIds = new Set(sales.map((s) => s.playerId));
  const unsoldIds = new Set(unsold.map((u) => u.playerId));

  let nextPlayerId: string | null = null;
  while (queue.length > 0) {
    const candidateId = queue.shift()!;
    if (soldIds.has(candidateId) || unsoldIds.has(candidateId)) continue;

    const p = await prisma.player.findUnique({
      where: { id: candidateId },
      select: { teamId: true },
    });
    if (p && p.teamId) continue;

    nextPlayerId = candidateId;
    break;
  }

  auctionPlayerQueues.set(auctionId, queue);

  const duration = auction.timerDuration || 30;
  const endTimeMs = Date.now() + duration * 1000;

  if (nextPlayerId) {
    const player = await prisma.player.findUnique({
      where: { id: nextPlayerId },
    });

    await prisma.auction.update({
      where: { id: auctionId },
      data: {
        currentPlayerId: nextPlayerId,
        currentBidAmount: null,
        currentBidTeamId: null,
        currentBidAt: null,
        timerStart: new Date(),
      },
    });

    await prisma.skippedTeam.deleteMany({ where: { auctionId } });
    await startAuctionTimer(auctionId, roomCode);

    const io = getIO();
    io.to(roomCode).emit("auction:player_changed", {
      playerId: nextPlayerId,
      player: player
        ? {
            id: player.id,
            name: player.name,
            photo: player.photo || "",
            age: player.age || 25,
            role: player.role || "",
            batsmanType: player.batsmanType || "",
            bowlerType: player.bowlerType || "",
            basePrice: player.basePrice || 1000,
          }
        : null,
      timerEndTime: endTimeMs,
      remainingTime: duration,
    });
    return;
  }

  // Fallback: scan DB for any remaining unassigned players
  const auctionPlayers = await prisma.auctionPlayer.findMany({
    where: { auctionId },
    select: { playerId: true },
  });

  const remaining = await prisma.player.findFirst({
    where: {
      id: { in: auctionPlayers.map((ap) => ap.playerId) },
      teamId: null,
      isUnsold: false,
      NOT: {
        id: { in: [...soldIds, ...unsoldIds] },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  if (remaining) {
    await prisma.auction.update({
      where: { id: auctionId },
      data: {
        currentPlayerId: remaining.id,
        currentBidAmount: null,
        currentBidTeamId: null,
        currentBidAt: null,
        timerStart: new Date(),
      },
    });

    await prisma.skippedTeam.deleteMany({ where: { auctionId } });
    await startAuctionTimer(auctionId, roomCode);

    const io = getIO();
    io.to(roomCode).emit("auction:player_changed", {
      playerId: remaining.id,
      player: {
        id: remaining.id,
        name: remaining.name,
        photo: remaining.photo || "",
        age: remaining.age || 25,
        role: remaining.role || "",
        batsmanType: remaining.batsmanType || "",
        bowlerType: remaining.bowlerType || "",
        basePrice: remaining.basePrice || 1000,
      },
      timerEndTime: endTimeMs,
      remainingTime: duration,
    });
  } else {
    await prisma.auction.update({
      where: { id: auctionId },
      data: {
        state: "completed",
        currentPlayerId: null,
        currentBidAmount: null,
        currentBidTeamId: null,
      },
    });

    stopAuctionTimer(auctionId);

    const io = getIO();
    io.to(roomCode).emit("auction:completed", {
      message: "All players have been sold or skipped!",
    });
  }
}

export function stopAuctionTimer(auctionId: string) {
  const timer = activeTimers.get(auctionId);
  if (timer) {
    clearInterval(timer);
    activeTimers.delete(auctionId);
  }
}

export async function resetAuctionTimer(auctionId: string, roomCode: string) {
  stopAuctionTimer(auctionId);
  const existingReset = pendingTimerResets.get(auctionId);
  if (existingReset) clearTimeout(existingReset);

  const reset = setTimeout(() => {
    startAuctionTimer(auctionId, roomCode).catch((err) =>
      logger.error({ err, auctionId }, "Reset timer failed")
    );
    pendingTimerResets.delete(auctionId);
  }, 100);

  pendingTimerResets.set(auctionId, reset);
}
