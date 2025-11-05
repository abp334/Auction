import { getIO } from "../sockets/io.js";
import { Auction } from "../models/Auction.js";
import { Player } from "../models/Player.js";
import { Team } from "../models/Team.js";

// Store active timers for auctions
const activeTimers = new Map<string, NodeJS.Timeout>();

export async function startAuctionTimer(auctionId: string, roomCode: string) {
  // Clear existing timer if any
  stopAuctionTimer(auctionId);

  const auction = await Auction.findById(auctionId);
  if (!auction || auction.state !== "active" || !auction.currentPlayerId) {
    return;
  }

  const duration = auction.timerDuration || 30;
  const startTime = new Date();

  // Update auction with timer start
  auction.timerStart = startTime;
  auction.skippedTeams = []; // Reset skipped teams for new player
  await auction.save();

  let timeLeft = duration;
  const io = getIO();

  // Broadcast initial timer
  io.to(roomCode).emit("auction:timer", {
    timeLeft,
    totalTime: duration,
  });

  const timer = setInterval(async () => {
    timeLeft--;

    // Broadcast timer update every second
    io.to(roomCode).emit("auction:timer", {
      timeLeft,
      totalTime: duration,
    });

    if (timeLeft <= 0) {
      // Timer expired - handle automatically
      clearInterval(timer);
      activeTimers.delete(auctionId);

      // Check if player should be sold or skipped
      const updatedAuction = await Auction.findById(auctionId);
      if (!updatedAuction || updatedAuction.state !== "active") return;

      // Get all teams in auction - only fetch captainId and _id
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
        await markPlayerUnsold(auctionId, roomCode);
      } else if (hasBid) {
        // Sell to highest bidder only if bidder hasn't skipped
        await sellCurrentPlayer(auctionId, roomCode);
      } else {
        // No bid - mark as unsold and move to next
        await markPlayerUnsold(auctionId, roomCode);
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
  await startAuctionTimer(auctionId, roomCode);
}

export async function sellCurrentPlayer(auctionId: string, roomCode: string) {
  // Optimize query - only fetch needed fields
  const auction = await Auction.findById(auctionId).select(
    "currentPlayerId currentBid sales roomCode"
  );
  if (!auction || !auction.currentPlayerId || !auction.currentBid) return;

  // Only fetch wallet and name for team
  const team = await Team.findById(auction.currentBid.teamId).select(
    "wallet name _id"
  );
  if (!team) return;

  // Only fetch name for player
  const player = await Player.findById(auction.currentPlayerId).select(
    "name _id"
  );
  if (!player) return;

  // Deduct and assign
  const salePrice = auction.currentBid.amount;
  team.wallet = team.wallet - salePrice;
  await team.save();

  player.teamId = (team as any)._id.toString();
  await player.save();

  // Update auction
  auction.sales.push({
    playerId: (player as any)._id.toString(),
    teamId: (team as any)._id.toString(),
    price: salePrice,
    at: new Date(),
  });
  auction.currentBid = undefined;
  auction.skippedTeams = [];
  await auction.save();

  const io = getIO();
  io.to(roomCode).emit("auction:sale", {
    playerId: (player as any)._id.toString(),
    playerName: player.name,
    teamId: (team as any)._id.toString(),
    teamName: team.name,
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
