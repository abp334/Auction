import { getIO } from "../sockets/io.js";
import { Auction } from "../models/Auction.js";
import { Player } from "../models/Player.js";
import { Team } from "../models/Team.js";

// Store active timers for auctions
const activeTimers = new Map<string, NodeJS.Timeout>();
// In-memory per-auction player queues
export const auctionPlayerQueues = new Map<string, string[]>();

export async function initAuctionQueue(auctionId: string) {
  try {
    const auction = await Auction.findById(auctionId).select(
      "players sales unsoldPlayers"
    );
    if (!auction) return;
    const soldPlayerIds = (auction.sales || []).map((s: any) => s.playerId);
    const excludeIds = [...soldPlayerIds, ...(auction.unsoldPlayers || [])];

    const players = await Player.find({
      $or: [
        { teamId: { $exists: false } },
        { teamId: null },
        { teamId: "" },
        { teamId: "UNSOLD" },
      ],
      _id: { $nin: excludeIds },
    })
      .select("_id")
      .sort({ _id: 1 })
      .lean();

    auctionPlayerQueues.set(
      auctionId,
      players.map((p: any) => (p._id || p.id).toString())
    );
  } catch (err) {
    console.error("Failed to init auction queue:", err);
  }
}

/**
 * RESTORE TIMERS ON SERVER RESTART
 * This finds any "active" auctions with a future "timerEndsAt"
 * and spins up the loop again without resetting the clock.
 */
export async function restoreActiveTimers() {
  try {
    const activeAuctions = await Auction.find({
      state: "active",
      timerEndsAt: { $exists: true, $ne: null },
      currentPlayerId: { $exists: true, $ne: null },
    });

    console.log(
      `Checking ${activeAuctions.length} active auctions for timer restoration...`
    );

    for (const auction of activeAuctions) {
      // TS FIX: Ensure timerEndsAt exists before using it
      if (!auction.currentPlayerId || !auction.timerEndsAt) continue;

      const endTime = new Date(auction.timerEndsAt).getTime();
      const duration = auction.timerDuration || 30;

      // If timer has valid data, restart the internal loop
      if (endTime > 0) {
        console.log(`Restoring timer for auction: ${auction.name}`);
        // We pass the EXISTING endTime so we don't reset the clock
        runTimerLoop(
          (auction._id as any).toString(),
          auction.roomCode,
          endTime,
          duration
        );
      }
    }
  } catch (err) {
    console.error("Failed to restore timers:", err);
  }
}

export async function startAuctionTimer(auctionId: string, roomCode: string) {
  // Clear existing timer if any
  stopAuctionTimer(auctionId);

  const auction = await Auction.findById(auctionId).select(
    "state currentPlayerId timerDuration"
  );
  if (!auction || auction.state !== "active" || !auction.currentPlayerId) {
    return;
  }

  // Use configured duration or default to 30s
  const duration = auction.timerDuration || 30;

  // Calculate Absolute End Time
  const startTime = new Date();
  const endTimeMilliseconds = Date.now() + duration * 1000;

  // Update auction in DB
  await Auction.findByIdAndUpdate(auctionId, {
    timerStart: startTime,
    timerEndsAt: new Date(endTimeMilliseconds),
    $set: { skippedTeams: [] },
  });

  const io = getIO();
  io.to(roomCode).emit("auction:timer", {
    timeLeft: duration,
    totalTime: duration,
    endTime: endTimeMilliseconds,
  });

  // Start the actual interval loop
  runTimerLoop(auctionId, roomCode, endTimeMilliseconds, duration);
}

/**
 * Shared Internal Loop Logic
 * Used by both startAuctionTimer (new timer) and restoreActiveTimers (server restart)
 */
function runTimerLoop(
  auctionId: string,
  roomCode: string,
  endTimeMilliseconds: number,
  totalDuration: number
) {
  // Clear just in case
  if (activeTimers.has(auctionId)) {
    clearInterval(activeTimers.get(auctionId));
  }

  const io = getIO();

  const timer = setInterval(async () => {
    const now = Date.now();

    // Check if we have passed the end time
    if (now >= endTimeMilliseconds) {
      clearInterval(timer);
      activeTimers.delete(auctionId);

      // --- EXPIRY LOGIC ---
      const updatedAuction = await Auction.findById(auctionId).select(
        "state currentBid currentPlayerId skippedTeams teams"
      );
      if (!updatedAuction || updatedAuction.state !== "active") return;

      const teams = await Team.find({ _id: { $in: updatedAuction.teams } })
        .select("captainId _id")
        .lean();
      const captainTeams = teams
        .filter((t: any) => t.captainId)
        .map((t: any) => (t._id || t.id).toString());

      const allSkipped =
        captainTeams.length > 0 &&
        captainTeams.every((tid) => updatedAuction.skippedTeams?.includes(tid));

      const currentBidderSkipped =
        updatedAuction.currentBid &&
        updatedAuction.skippedTeams?.includes(updatedAuction.currentBid.teamId);

      const hasBid =
        updatedAuction.currentBid && updatedAuction.currentBid.amount >= 1000;

      if (allSkipped || currentBidderSkipped) {
        markPlayerUnsold(auctionId, roomCode).catch(console.error);
      } else if (hasBid) {
        sellCurrentPlayer(auctionId, roomCode).catch(console.error);
      } else {
        markPlayerUnsold(auctionId, roomCode).catch(console.error);
      }
    } else {
      // Periodic Sync (Every 5 seconds) to keep drifters in check
      if (Math.floor((endTimeMilliseconds - now) / 1000) % 5 === 0) {
        io.to(roomCode).emit("auction:timer", {
          timeLeft: Math.floor((endTimeMilliseconds - now) / 1000),
          totalTime: totalDuration,
          endTime: endTimeMilliseconds,
        });
      }
    }
  }, 1000);

  activeTimers.set(auctionId, timer);
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
  const existingReset = (resetAuctionTimer as any).pendingResets;
  if (existingReset) {
    clearTimeout(existingReset);
  }
  (resetAuctionTimer as any).pendingResets = setTimeout(() => {
    startAuctionTimer(auctionId, roomCode).catch(console.error);
    (resetAuctionTimer as any).pendingResets = null;
  }, 100);
}

export async function sellCurrentPlayer(auctionId: string, roomCode: string) {
  const auction = await Auction.findById(auctionId).select(
    "currentPlayerId currentBid sales roomCode"
  );
  if (!auction || !auction.currentPlayerId || !auction.currentBid) return;

  const alreadySold = auction.sales.some(
    (sale: any) => sale.playerId === auction.currentPlayerId
  );
  if (alreadySold) return;

  const team = await Team.findById(auction.currentBid.teamId).select(
    "wallet name _id"
  );
  if (!team) return;

  const player = await Player.findById(auction.currentPlayerId).select(
    "name _id teamId"
  );
  if (!player) return;

  if (player.teamId && player.teamId !== "UNSOLD") return;

  const salePrice = auction.currentBid.amount;
  if (team.wallet < salePrice) return;

  const updatedTeam = await Team.findByIdAndUpdate(
    auction.currentBid.teamId,
    { $inc: { wallet: -salePrice } },
    { new: true }
  );
  if (!updatedTeam) return;

  player.teamId = (team as any)._id.toString();
  await player.save();

  const updatedAuction = await Auction.findById(auctionId);
  if (!updatedAuction) return;

  const stillUnsold = !updatedAuction.sales.some(
    (sale: any) => sale.playerId === auction.currentPlayerId
  );

  if (stillUnsold) {
    updatedAuction.sales.push({
      playerId: (player as any)._id.toString(),
      teamId: (team as any)._id.toString(),
      price: salePrice,
      at: new Date(),
    });
    updatedAuction.currentBid = undefined;
    updatedAuction.skippedTeams = [];
    await updatedAuction.save();
  } else {
    return;
  }

  const io = getIO();
  io.to(roomCode).emit("auction:sale", {
    playerId: (player as any)._id.toString(),
    playerName: player.name,
    teamId: (updatedTeam as any)._id.toString(),
    teamName: updatedTeam.name,
    price: salePrice,
    saleType: "sold",
  });

  await moveToNextPlayer(auctionId, roomCode);
}

export async function markPlayerUnsold(auctionId: string, roomCode: string) {
  const auction = await Auction.findById(auctionId).select(
    "currentPlayerId skippedTeams currentBid unsoldPlayers"
  );
  if (!auction || !auction.currentPlayerId) return;

  const player = await Player.findById(auction.currentPlayerId).select(
    "name _id"
  );
  if (!player) return;

  const playerId = player.id || (player as any)._id.toString();
  if (!auction.unsoldPlayers) {
    auction.unsoldPlayers = [];
  }
  if (!auction.unsoldPlayers.includes(playerId)) {
    auction.unsoldPlayers.push(playerId);
  }

  auction.skippedTeams = [];
  auction.currentBid = undefined;
  await auction.save();

  const io = getIO();
  io.to(roomCode).emit("auction:unsold", {
    playerId: (player as any)._id.toString(),
    playerName: player.name,
  });

  await moveToNextPlayer(auctionId, roomCode);
}

export async function moveToNextPlayer(auctionId: string, roomCode: string) {
  const auction = await Auction.findById(auctionId);
  if (!auction) return;

  const queue = auctionPlayerQueues.get(auctionId) || [];
  let nextPlayerId: string | null = null;

  while (queue.length > 0) {
    const candidateId = queue.shift() as string;
    const soldPlayerIds = (auction.sales || []).map((s: any) => s.playerId);
    if (
      soldPlayerIds.includes(candidateId) ||
      (auction.unsoldPlayers || []).includes(candidateId)
    ) {
      continue;
    }
    nextPlayerId = candidateId;
    break;
  }

  auctionPlayerQueues.set(auctionId, queue);

  // Calculate End Time for the new player
  const duration = auction.timerDuration || 30;
  const endTimeMilliseconds = Date.now() + duration * 1000;

  if (nextPlayerId) {
    const nextUnsoldPlayer = await Player.findById(nextPlayerId).select(
      "_id name photo age role bowlerType basePrice teamId"
    );
    if (nextUnsoldPlayer) {
      auction.currentPlayerId = nextPlayerId;
      auction.currentBid = undefined;
      auction.skippedTeams = [];
      auction.timerStart = new Date();
      await auction.save();

      await startAuctionTimer(auctionId, roomCode);

      const io = getIO();
      io.to(roomCode).emit("auction:player_changed", {
        playerId: nextPlayerId,
        player: {
          id: nextPlayerId,
          name: nextUnsoldPlayer.name,
          photo: nextUnsoldPlayer.photo || "",
          age: nextUnsoldPlayer.age || 25,
          role: nextUnsoldPlayer.role || "",
          bowlerType: nextUnsoldPlayer.bowlerType || "",
          basePrice: nextUnsoldPlayer.basePrice || 1000,
        },
        // Broadcast absolute end time so client starts immediately
        timerEndTime: endTimeMilliseconds,
        remainingTime: duration,
      });
      return;
    }
  }

  // Fallback DB Scan
  const soldPlayerIds = (auction.sales || []).map((s: any) => s.playerId);
  const nextUnsoldPlayer = await Player.findOne({
    $or: [
      { teamId: { $exists: false } },
      { teamId: null },
      { teamId: "" },
      { teamId: "UNSOLD" },
    ],
    _id: {
      $ne: auction.currentPlayerId,
      $nin: [...soldPlayerIds, ...(auction.unsoldPlayers || [])],
    },
  })
    .select("_id name photo age role bowlerType basePrice teamId")
    .sort({ _id: 1 });

  if (nextUnsoldPlayer) {
    const playerId =
      nextUnsoldPlayer.id || (nextUnsoldPlayer as any)._id.toString();
    if (
      !soldPlayerIds.includes(playerId) &&
      !auction.unsoldPlayers?.includes(playerId)
    ) {
      auction.currentPlayerId = playerId;
      auction.currentBid = undefined;
      auction.skippedTeams = [];
      auction.timerStart = new Date();
      await auction.save();

      await startAuctionTimer(auctionId, roomCode);

      const io = getIO();
      io.to(roomCode).emit("auction:player_changed", {
        playerId: playerId,
        player: {
          id: playerId,
          name: nextUnsoldPlayer.name,
          photo: nextUnsoldPlayer.photo || "",
          age: nextUnsoldPlayer.age || 25,
          role: nextUnsoldPlayer.role || "",
          bowlerType: nextUnsoldPlayer.bowlerType || "",
          basePrice: nextUnsoldPlayer.basePrice || 1000,
        },
        timerEndTime: endTimeMilliseconds,
        remainingTime: duration,
      });
    }
  } else {
    auction.state = "completed";
    auction.currentPlayerId = undefined;
    auction.skippedTeams = [];
    auction.currentBid = undefined;
    await auction.save();

    stopAuctionTimer(auctionId);

    const io = getIO();
    io.to(roomCode).emit("auction:completed", {
      message: "All players have been sold or skipped!",
    });
  }
}
