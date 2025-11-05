import { getIO } from "../sockets/io.js";
import { Auction } from "../models/Auction.js";
import { Player } from "../models/Player.js";
import { Team } from "../models/Team.js";

// Store active timers for auctions
const activeTimers = new Map<string, NodeJS.Timeout>();

export async function startAuctionTimer(auctionId: string, roomCode: string) {
  // Clear existing timer if any
  stopAuctionTimer(auctionId);

  const auction = await Auction.findById(auctionId).select(
    "state currentPlayerId timerDuration"
  );
  if (!auction || auction.state !== "active" || !auction.currentPlayerId) {
    return;
  }

  const duration = auction.timerDuration || 30;
  const startTime = new Date();

  // Update auction with timer start (optimized - only update timer fields)
  await Auction.findByIdAndUpdate(auctionId, {
    timerStart: startTime,
    $set: { skippedTeams: [] }, // Reset skipped teams for new player
  });

  let timeLeft = duration;
  const io = getIO();

  // Broadcast initial timer
  io.to(roomCode).emit("auction:timer", {
    timeLeft,
    totalTime: duration,
  });

  // Use a more efficient timer that batches updates
  let lastBroadcast = Date.now();
  const timer = setInterval(async () => {
    timeLeft--;

    // Only broadcast every 500ms to reduce network overhead (or every second if less than 10)
    const now = Date.now();
    if (timeLeft <= 10 || now - lastBroadcast >= 500) {
      io.to(roomCode).emit("auction:timer", {
        timeLeft,
        totalTime: duration,
      });
      lastBroadcast = now;
    }

    if (timeLeft <= 0) {
      // Timer expired - handle automatically
      clearInterval(timer);
      activeTimers.delete(auctionId);

      // Check if player should be sold or skipped (optimized query)
      const updatedAuction = await Auction.findById(auctionId).select(
        "state currentBid currentPlayerId skippedTeams teams"
      );
      if (!updatedAuction || updatedAuction.state !== "active") return;

      // Get all teams in auction - only fetch captainId and _id (cached if possible)
      const teams = await Team.find({ _id: { $in: updatedAuction.teams } })
        .select("captainId _id")
        .lean();
      const captainTeams = teams
        .filter((t: any) => t.captainId)
        .map((t: any) => (t._id || t.id).toString());

      // Check if all captain teams skipped or no bid
      const allSkipped =
        captainTeams.length > 0 &&
        captainTeams.every((tid) => updatedAuction.skippedTeams?.includes(tid));

      // Check if current bidder has skipped
      const currentBidderSkipped =
        updatedAuction.currentBid &&
        updatedAuction.skippedTeams?.includes(updatedAuction.currentBid.teamId);

      const hasBid =
        updatedAuction.currentBid && updatedAuction.currentBid.amount >= 1000;

      // If all skipped OR bidder skipped, mark as unsold (even if there was a bid)
      if (allSkipped || currentBidderSkipped) {
        markPlayerUnsold(auctionId, roomCode).catch(console.error);
      } else if (hasBid) {
        // Sell to highest bidder only if bidder hasn't skipped
        sellCurrentPlayer(auctionId, roomCode).catch(console.error);
      } else {
        // No bid - mark as unsold and move to next
        markPlayerUnsold(auctionId, roomCode).catch(console.error);
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
  // Use setTimeout to debounce rapid resets (prevents race conditions)
  const existingReset = (resetAuctionTimer as any).pendingResets;
  if (existingReset) {
    clearTimeout(existingReset);
  }
  (resetAuctionTimer as any).pendingResets = setTimeout(() => {
    startAuctionTimer(auctionId, roomCode).catch(console.error);
    (resetAuctionTimer as any).pendingResets = null;
  }, 100); // 100ms debounce
}

export async function sellCurrentPlayer(auctionId: string, roomCode: string) {
  // Optimize query - only fetch needed fields
  const auction = await Auction.findById(auctionId).select(
    "currentPlayerId currentBid sales roomCode"
  );
  if (!auction || !auction.currentPlayerId || !auction.currentBid) return;

  // Check if this player is already sold (prevent double-selling)
  const alreadySold = auction.sales.some(
    (sale: any) => sale.playerId === auction.currentPlayerId
  );
  if (alreadySold) {
    console.log("Player already sold, skipping duplicate sale");
    return;
  }

  // Only fetch wallet and name for team
  const team = await Team.findById(auction.currentBid.teamId).select(
    "wallet name _id"
  );
  if (!team) return;

  // Only fetch name and teamId for player (to check if already assigned)
  const player = await Player.findById(auction.currentPlayerId).select(
    "name _id teamId"
  );
  if (!player) return;

  // Check if player is already assigned to a team (prevent double-selling)
  if (player.teamId && player.teamId !== "UNSOLD") {
    console.log("Player already assigned to team, skipping duplicate sale");
    return;
  }

  // Verify team has enough budget (double-check before deducting)
  const salePrice = auction.currentBid.amount;
  if (team.wallet < salePrice) {
    console.error("Insufficient wallet when trying to sell", {
      teamId: team.id,
      wallet: team.wallet,
      salePrice,
    });
    return;
  }

  // Use atomic operation to deduct wallet (prevents race conditions)
  const updatedTeam = await Team.findByIdAndUpdate(
    auction.currentBid.teamId,
    { $inc: { wallet: -salePrice } },
    { new: true }
  );
  if (!updatedTeam) {
    console.error("Failed to update team wallet");
    return;
  }

  // Assign player to team
  player.teamId = (team as any)._id.toString();
  await player.save();

  // Update auction - check again if already sold (race condition protection)
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
    console.log("Player already sold in auction sales, skipping duplicate");
    return;
  }

  const io = getIO();
  io.to(roomCode).emit("auction:sale", {
    playerId: (player as any)._id.toString(),
    playerName: player.name,
    teamId: (updatedTeam as any)._id.toString(),
    teamName: updatedTeam.name,
    price: salePrice,
  });

  // Move to next player
  await moveToNextPlayer(auctionId, roomCode);
}

export async function markPlayerUnsold(auctionId: string, roomCode: string) {
  // Optimize query - only fetch needed fields
  const auction = await Auction.findById(auctionId).select(
    "currentPlayerId skippedTeams currentBid unsoldPlayers"
  );
  if (!auction || !auction.currentPlayerId) return;

  // Only fetch name for player
  const player = await Player.findById(auction.currentPlayerId).select(
    "name _id"
  );
  if (!player) return;

  // Mark player as unsold in THIS auction (don't set teamId to "UNSOLD" yet)
  // We'll track it in the auction's unsoldPlayers array
  const playerId = player.id || (player as any)._id.toString();
  if (!auction.unsoldPlayers) {
    auction.unsoldPlayers = [];
  }
  if (!auction.unsoldPlayers.includes(playerId)) {
    auction.unsoldPlayers.push(playerId);
  }
  // Don't set teamId to "UNSOLD" - keep it null/empty so it's available for next auction
  // Only mark as "UNSOLD" if we want to track it globally, but for now we track per-auction

  // Update auction
  auction.skippedTeams = [];
  auction.currentBid = undefined;
  await auction.save();

  const io = getIO();
  io.to(roomCode).emit("auction:unsold", {
    playerId: (player as any)._id.toString(),
    playerName: player.name,
  });

  // Move to next player
  await moveToNextPlayer(auctionId, roomCode);
}

export async function moveToNextPlayer(auctionId: string, roomCode: string) {
  const auction = await Auction.findById(auctionId);
  if (!auction) return;

  // Optimize query - only fetch needed fields for player display
  // During an active auction, exclude players that went unsold in THIS auction
  // But include players unsold from previous auctions
  const soldPlayerIds = (auction.sales || []).map((s: any) => s.playerId);
  const nextUnsoldPlayer = await Player.findOne({
    $or: [
      { teamId: { $exists: false } },
      { teamId: null },
      { teamId: "" },
      { teamId: "UNSOLD" }, // Include players unsold in previous auctions
    ],
    _id: {
      $ne: auction.currentPlayerId,
      $nin: [...soldPlayerIds, ...(auction.unsoldPlayers || [])], // Exclude players sold or unsold in THIS auction
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

      // Start timer for new player
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
      });
    }
  } else {
    // No more unsold players - end auction
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
