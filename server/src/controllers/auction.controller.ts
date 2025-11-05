import { StatusCodes } from "http-status-codes";
import type { Request, Response } from "express";
import Joi from "joi";
import { nanoid } from "nanoid";
import { Auction } from "../models/Auction.js";
import { Player } from "../models/Player.js";
import { Team } from "../models/Team.js";
import { getIO } from "../sockets/io.js";
import { User } from "../models/User.js";
import {
  startAuctionTimer,
  stopAuctionTimer,
  resetAuctionTimer,
} from "../utils/timer.js";

const createSchema = Joi.object({
  name: Joi.string().min(2).required(),
  players: Joi.array().items(Joi.string()).default([]),
  teams: Joi.array().items(Joi.string()).default([]),
});

export async function listAuctions(req: Request, res: Response) {
  const { roomCode } = req.query as { roomCode?: string };
  const filter = roomCode ? { roomCode } : {};
  // Optimize query - only fetch essential fields
  const auctions = await Auction.find(filter)
    .select("name roomCode state currentPlayerId currentBid createdAt")
    .sort({ createdAt: -1 })
    .lean(); // Use lean() for faster queries when not modifying documents
  return res.status(StatusCodes.OK).json({ auctions });
}

export async function createAuction(
  req: Request & { user?: { id: string } },
  res: Response
) {
  const { error, value } = createSchema.validate(req.body);
  if (error)
    return res.status(StatusCodes.BAD_REQUEST).json({ error: error.message });

  // Generate 6-character uppercase alphanumeric room code (A-Z, 0-9 only)
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let roomCode = "";
  for (let i = 0; i < 6; i++) {
    roomCode += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
  }
  const auction = await Auction.create({
    name: value.name,
    players: value.players,
    teams: value.teams,
    roomCode,
    createdBy: req.user?.id || "system",
  });
  return res.status(StatusCodes.CREATED).json({ auction });
}

export async function getAuction(req: Request, res: Response) {
  const { id } = req.params;
  const auction = await Auction.findById(id);
  if (!auction)
    return res
      .status(StatusCodes.NOT_FOUND)
      .json({ error: "Auction not found" });
  return res.status(StatusCodes.OK).json({ auction });
}

export async function startAuction(req: Request, res: Response) {
  const { id } = req.params;
  const auction = await Auction.findByIdAndUpdate(
    id,
    { state: "active", unsoldPlayers: [] }, // Reset unsold players for new auction
    { new: true }
  );
  if (!auction)
    return res
      .status(StatusCodes.NOT_FOUND)
      .json({ error: "Auction not found" });

  // Automatically select first unsold player - optimize query
  // For a NEW auction, include:
  // - Players never sold (teamId is null/undefined/empty)
  // - Players unsold in PREVIOUS auctions (teamId = "UNSOLD")
  // Exclude players that are sold in THIS auction (tracked in sales array)
  // Exclude players that went unsold in THIS auction (tracked in unsoldPlayers array)
  const soldPlayerIds = (auction.sales || []).map((s: any) => s.playerId);
  const firstUnsoldPlayer = await Player.findOne({
    $or: [
      { teamId: { $exists: false } },
      { teamId: null },
      { teamId: "" },
      { teamId: "UNSOLD" }, // Include players unsold in previous auctions
    ],
    // Exclude players sold in THIS auction
    _id: { $nin: [...soldPlayerIds, ...(auction.unsoldPlayers || [])] },
  })
    .select("_id name photo age role bowlerType basePrice teamId")
    .sort({ _id: 1 });

  // Double-check that player is available (not sold and not unsold in this auction)
  if (firstUnsoldPlayer) {
    const playerId =
      firstUnsoldPlayer.id || (firstUnsoldPlayer as any)._id.toString();
    if (
      !soldPlayerIds.includes(playerId) &&
      !auction.unsoldPlayers?.includes(playerId)
    ) {
      auction.currentPlayerId = playerId;
      auction.currentBid = undefined;
      auction.skippedTeams = [];
      await auction.save();

      // Start timer for first player
      await startAuctionTimer(id, auction.roomCode);

      // Broadcast to all clients
      try {
        const io = getIO();
        io.to(auction.roomCode).emit("auction:player_changed", {
          playerId: playerId,
          player: {
            id: playerId,
            name: firstUnsoldPlayer.name,
            photo: firstUnsoldPlayer.photo || "",
            age: firstUnsoldPlayer.age || 25,
            role: firstUnsoldPlayer.role || "",
            bowlerType: firstUnsoldPlayer.bowlerType || "",
            basePrice: firstUnsoldPlayer.basePrice || 1000,
          },
        });
      } catch (err) {
        console.error("Error broadcasting player_changed:", err);
      }
    } else {
      console.log("Player found but already sold or unsold in this auction");
    }
  } else {
    console.log("No unsold players found when starting auction");
  }

  return res.status(StatusCodes.OK).json({ auction });
}

export async function pauseAuction(req: Request, res: Response) {
  const { id } = req.params;
  const auction = await Auction.findByIdAndUpdate(
    id,
    { state: "paused" },
    { new: true }
  );
  if (!auction)
    return res
      .status(StatusCodes.NOT_FOUND)
      .json({ error: "Auction not found" });

  // Stop timer when paused
  stopAuctionTimer(id);

  return res.status(StatusCodes.OK).json({ auction });
}

export async function resumeAuction(req: Request, res: Response) {
  const { id } = req.params;
  const auction = await Auction.findByIdAndUpdate(
    id,
    { state: "active" },
    { new: true }
  );
  if (!auction)
    return res
      .status(StatusCodes.NOT_FOUND)
      .json({ error: "Auction not found" });

  // Resume timer if there's a current player, otherwise select next player
  if (auction.currentPlayerId) {
    await startAuctionTimer(id, auction.roomCode);
  } else {
    // If no current player, select next unsold player
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
      // Exclude players sold or unsold in THIS auction
      _id: { $nin: [...soldPlayerIds, ...(auction.unsoldPlayers || [])] },
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
        await auction.save();

        await startAuctionTimer(id, auction.roomCode);

        try {
          const io = getIO();
          io.to(auction.roomCode).emit("auction:player_changed", {
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
        } catch (err) {
          console.error("Error broadcasting player_changed:", err);
        }
      }
    }
  }

  return res.status(StatusCodes.OK).json({ auction });
}

const bidSchema = Joi.object({
  teamId: Joi.string().required(),
  amount: Joi.number().min(0).required(),
  playerId: Joi.string().optional(),
});

export async function placeBid(req: Request, res: Response) {
  try {
    const { id } = req.params; // auction id
    const { error, value } = bidSchema.validate(req.body);
    if (error)
      return res.status(StatusCodes.BAD_REQUEST).json({ error: error.message });

    // Optimize query - only fetch needed fields
    const auction = await Auction.findById(id).select(
      "state currentBid currentPlayerId roomCode skippedTeams teams bidHistory"
    );
    if (!auction)
      return res
        .status(StatusCodes.NOT_FOUND)
        .json({ error: "Auction not found" });
    if (auction.state !== "active")
      return res
        .status(StatusCodes.CONFLICT)
        .json({ error: "Auction is not active" });

    // Optimize queries - only fetch wallet for budget check
    const team = await Team.findById(value.teamId).select("wallet name _id");
    if (!team)
      return res
        .status(StatusCodes.BAD_REQUEST)
        .json({ error: "Invalid team" });
    if (value.playerId) {
      const player = await Player.findById(value.playerId).select("_id");
      if (!player)
        return res
          .status(StatusCodes.BAD_REQUEST)
          .json({ error: "Invalid player" });
    }
    // Enforce captains can only bid for their own team
    const user = (req as any).user as
      | { id: string; role: "admin" | "captain" | "player" }
      | undefined;
    if (user?.role === "captain") {
      // Only fetch teamId field for captain check
      const dbUser = await User.findById(user.id).select("teamId");
      const captainTeamId = dbUser?.teamId;
      // Use team.id (virtual property) or team._id.toString() for comparison
      if (!captainTeamId || team.id !== captainTeamId) {
        return res
          .status(StatusCodes.FORBIDDEN)
          .json({ error: "Captains can only bid for their team" });
      }
    }
    // Minimum bid and increment over current
    const minBid = 1000;
    if (value.amount < minBid)
      return res
        .status(StatusCodes.BAD_REQUEST)
        .json({ error: `Minimum bid is ${minBid}` });
    if (auction.currentBid && value.amount <= auction.currentBid.amount) {
      return res
        .status(StatusCodes.BAD_REQUEST)
        .json({ error: "Bid must be higher than current highest bid" });
    }
    // Budget enforcement
    if (team.wallet < value.amount)
      return res
        .status(StatusCodes.BAD_REQUEST)
        .json({ error: "Insufficient team budget" });
    // If enforcing player-based round, ensure bidding on the current player
    if (
      auction.currentPlayerId &&
      value.playerId &&
      auction.currentPlayerId !== value.playerId
    ) {
      return res
        .status(StatusCodes.BAD_REQUEST)
        .json({ error: "Not the current player being auctioned" });
    }

    const bid = {
      teamId: value.teamId,
      amount: value.amount,
      playerId: value.playerId,
      at: new Date(),
    };
    auction.currentBid = bid;
    // Ensure bidHistory is initialized
    if (!auction.bidHistory) {
      auction.bidHistory = [];
    }
    auction.bidHistory.push(bid);
    // Clear skipped teams when new bid comes in
    auction.skippedTeams = [];
    await auction.save();

    // Reset timer when new bid comes in
    await resetAuctionTimer(id, auction.roomCode);

    try {
      const io = getIO();
      io.to(auction.roomCode).emit("auction:bid_update", {
        amount: bid.amount,
        teamId: bid.teamId,
        playerId: bid.playerId,
        at: bid.at.getTime(),
      });
    } catch {}

    return res.status(StatusCodes.OK).json({ auction });
  } catch (err: any) {
    console.error("Error in placeBid:", err);
    return res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ error: err.message || "Internal server error" });
  }
}

export async function undoBid(req: Request, res: Response) {
  const { id } = req.params; // auction id
  const user = (req as any).user as { id: string; role: string } | undefined;
  if (!user) {
    return res.status(StatusCodes.UNAUTHORIZED).json({ error: "Unauthorized" });
  }

  // Optimize query - only fetch needed fields
  const auction = await Auction.findById(id).select(
    "state currentBid bidHistory roomCode"
  );
  if (!auction) {
    return res
      .status(StatusCodes.NOT_FOUND)
      .json({ error: "Auction not found" });
  }

  if (auction.state !== "active") {
    return res
      .status(StatusCodes.BAD_REQUEST)
      .json({ error: "Auction is not active" });
  }

  if (!auction.currentBid) {
    return res
      .status(StatusCodes.BAD_REQUEST)
      .json({ error: "No bid to undo" });
  }

  // Get captain's team - only fetch teamId
  const dbUser = await User.findById(user.id).select("teamId").lean();
  if (!dbUser || !dbUser.teamId) {
    return res
      .status(StatusCodes.BAD_REQUEST)
      .json({ error: "You must be assigned to a team" });
  }

  const teamId = dbUser.teamId;

  // Check if the current bid is from this team
  if (auction.currentBid.teamId !== teamId) {
    return res
      .status(StatusCodes.FORBIDDEN)
      .json({ error: "You can only undo your own bid" });
  }

  // Check if this is the latest bid (by checking if there are any bids after it in bidHistory)
  const lastBidIndex = auction.bidHistory.length - 1;
  const lastBid = auction.bidHistory[lastBidIndex];

  if (
    !lastBid ||
    lastBid.teamId !== teamId ||
    lastBid.amount !== auction.currentBid.amount
  ) {
    return res
      .status(StatusCodes.BAD_REQUEST)
      .json({ error: "Cannot undo: another team has bid after you" });
  }

  // Remove the last bid from history
  auction.bidHistory.pop();

  // Find the previous bid (if any) to set as current bid
  if (auction.bidHistory.length > 0) {
    const previousBid = auction.bidHistory[auction.bidHistory.length - 1];
    auction.currentBid = previousBid;
  } else {
    // No previous bids, clear current bid
    auction.currentBid = undefined;
  }

  await auction.save();

  // Get team name for broadcast
  const team = await Team.findById(teamId);
  const teamName = team?.name || `Team ${teamId.substring(0, 6)}`;

  try {
    const io = getIO();
    io.to(auction.roomCode).emit("auction:bid_undo", {
      teamId: teamId,
      teamName: teamName,
      currentBid: auction.currentBid,
    });

    // Reset timer after undo
    if (auction.currentBid) {
      await resetAuctionTimer(id, auction.roomCode);
    }
  } catch {}

  return res.status(StatusCodes.OK).json({ auction });
}

export async function closeAuction(req: Request, res: Response) {
  const { id } = req.params;
  const auction = await Auction.findById(id);
  if (!auction)
    return res
      .status(StatusCodes.NOT_FOUND)
      .json({ error: "Auction not found" });

  // Stop the timer
  stopAuctionTimer(id);

  // Update auction state
  auction.state = "completed";
  await auction.save();

  // Broadcast auction ended event to all connected clients
  try {
    const io = getIO();
    io.to(auction.roomCode).emit("auction:ended", {
      message: "Auction has been ended by admin",
      auctionId: auction.id,
    });
  } catch {}

  return res.status(StatusCodes.OK).json({ auction });
}

export async function setCurrentPlayer(req: Request, res: Response) {
  const schema = Joi.object({ playerId: Joi.string().required() });
  const { error, value } = schema.validate(req.body);
  if (error)
    return res.status(StatusCodes.BAD_REQUEST).json({ error: error.message });
  const { id } = req.params;
  const auction = await Auction.findByIdAndUpdate(
    id,
    { currentPlayerId: value.playerId, currentBid: undefined },
    { new: true }
  );
  if (!auction)
    return res
      .status(StatusCodes.NOT_FOUND)
      .json({ error: "Auction not found" });

  // Load player details for broadcast
  const player = await Player.findById(value.playerId);
  if (player) {
    try {
      const io = getIO();
      io.to(auction.roomCode).emit("auction:player_changed", {
        playerId: player.id,
        player: {
          id: player.id,
          name: player.name,
          photo: player.photo,
          age: player.age,
          role: player.role,
          bowlerType: player.bowlerType,
          basePrice: player.basePrice,
        },
      });
    } catch {}
  }

  return res.status(StatusCodes.OK).json({ auction });
}

export async function sellCurrent(req: Request, res: Response) {
  const { id } = req.params; // auction id
  const auction = await Auction.findById(id);
  if (!auction)
    return res
      .status(StatusCodes.NOT_FOUND)
      .json({ error: "Auction not found" });

  // Prevent selling if auction is not active
  if (auction.state !== "active") {
    return res
      .status(StatusCodes.BAD_REQUEST)
      .json({ error: "Auction is not active" });
  }

  if (!auction.currentPlayerId)
    return res
      .status(StatusCodes.BAD_REQUEST)
      .json({ error: "No current player set" });
  if (!auction.currentBid) {
    // If no bid, just move to next player without selling
    const nextUnsoldPlayer = await Player.findOne({
      $or: [{ teamId: { $exists: false } }, { teamId: null }],
    })
      .select("_id name photo age role bowlerType basePrice")
      .sort({ _id: 1 })
      .lean();
    if (nextUnsoldPlayer) {
      auction.currentPlayerId = (nextUnsoldPlayer as any)._id.toString();
      auction.currentBid = undefined;
      await auction.save();

      try {
        const io = getIO();
        io.to(auction.roomCode).emit("auction:player_changed", {
          playerId: (nextUnsoldPlayer as any)._id.toString(),
          player: {
            id: (nextUnsoldPlayer as any)._id.toString(),
            name: nextUnsoldPlayer.name,
            photo: nextUnsoldPlayer.photo,
            age: nextUnsoldPlayer.age,
            role: nextUnsoldPlayer.role,
            bowlerType: nextUnsoldPlayer.bowlerType,
            basePrice: nextUnsoldPlayer.basePrice,
          },
        });
      } catch {}
    } else {
      auction.state = "completed";
      auction.currentPlayerId = undefined;
      await auction.save();

      try {
        const io = getIO();
        io.to(auction.roomCode).emit("auction:completed", {
          message: "All players have been sold!",
        });
      } catch {}
    }
    return res.status(StatusCodes.OK).json({ auction });
  }

  const team = await Team.findById(auction.currentBid.teamId);
  if (!team)
    return res
      .status(StatusCodes.BAD_REQUEST)
      .json({ error: "Winning team not found" });
  if (team.wallet < auction.currentBid.amount)
    return res
      .status(StatusCodes.BAD_REQUEST)
      .json({ error: "Insufficient team budget to settle" });

  const player = await Player.findById(auction.currentPlayerId);
  if (!player)
    return res
      .status(StatusCodes.BAD_REQUEST)
      .json({ error: "Player not found" });

  // Deduct and assign
  const salePrice = auction.currentBid.amount;
  team.wallet = team.wallet - salePrice;
  await team.save();

  player.teamId = team.id; // Use id property (Mongoose provides this)
  await player.save();

  // Verify the save worked
  const savedPlayer = await Player.findById(player.id);
  const savedTeam = await Team.findById(team.id);

  if (!savedPlayer || savedPlayer.teamId !== team.id) {
    console.error("ERROR: Player assignment failed", {
      playerId: player.id,
      teamId: team.id,
    });
  }
  if (!savedTeam || savedTeam.wallet !== team.wallet) {
    console.error("ERROR: Team wallet deduction failed", {
      teamId: team.id,
      expected: team.wallet,
      actual: savedTeam?.wallet,
    });
  }

  // Update auction with sale and clear current bid
  auction.sales.push({
    playerId: player.id,
    teamId: team.id,
    price: salePrice,
    at: new Date(),
  });
  auction.currentBid = undefined;
  await auction.save(); // Save auction after sale

  // Automatically select next unsold player - optimize query
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
    // Exclude players sold or unsold in THIS auction
    _id: { $nin: [...soldPlayerIds, ...(auction.unsoldPlayers || [])] },
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
      await auction.save();

      // Broadcast sale and next player
      try {
        const io = getIO();
        io.to(auction.roomCode).emit("auction:sale", {
          playerId: player.id || (player as any)._id.toString(),
          playerName: player.name,
          teamId: team.id || (team as any)._id.toString(),
          teamName: team.name,
          price: salePrice,
        });
        io.to(auction.roomCode).emit("auction:player_changed", {
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
      } catch (err) {
        console.error("Error broadcasting sale and player_changed:", err);
      }
    }
  } else {
    // No more unsold players - mark auction as completed
    auction.state = "completed";
    auction.currentPlayerId = undefined;
    await auction.save();

    // Broadcast sale and completion
    try {
      const io = getIO();
      io.to(auction.roomCode).emit("auction:sale", {
        playerId: player.id,
        playerName: player.name,
        teamId: team.id,
        teamName: team.name,
        price: salePrice,
      });
      io.to(auction.roomCode).emit("auction:completed", {
        message: "All players have been sold!",
      });
    } catch {}
  }

  return res.status(StatusCodes.OK).json({ auction, player, team });
}

export async function skipPlayer(req: Request, res: Response) {
  const { id } = req.params; // auction id
  const user = (req as any).user as { id: string; role: string } | undefined;
  if (!user) {
    return res.status(StatusCodes.UNAUTHORIZED).json({ error: "Unauthorized" });
  }

  // Optimize query - only fetch needed fields
  const auction = await Auction.findById(id).select(
    "state currentPlayerId skippedTeams teams roomCode currentBid"
  );
  if (!auction) {
    return res
      .status(StatusCodes.NOT_FOUND)
      .json({ error: "Auction not found" });
  }

  if (auction.state !== "active") {
    return res
      .status(StatusCodes.BAD_REQUEST)
      .json({ error: "Auction is not active" });
  }

  if (!auction.currentPlayerId) {
    return res
      .status(StatusCodes.BAD_REQUEST)
      .json({ error: "No current player set" });
  }

  // Get captain's team - only fetch teamId
  const dbUser = await User.findById(user.id).select("teamId");
  if (!dbUser || !dbUser.teamId) {
    return res
      .status(StatusCodes.BAD_REQUEST)
      .json({ error: "You must be assigned to a team" });
  }

  const teamId = dbUser.teamId;

  // Check if team already skipped
  if (auction.skippedTeams?.includes(teamId)) {
    return res
      .status(StatusCodes.BAD_REQUEST)
      .json({ error: "You have already skipped this player" });
  }

  // Add team to skipped teams
  if (!auction.skippedTeams) {
    auction.skippedTeams = [];
  }
  auction.skippedTeams.push(teamId);
  await auction.save();

  // Get team name for broadcast
  const team = await Team.findById(teamId);
  const teamName = team?.name || `Team ${teamId.substring(0, 6)}`;

  try {
    const io = getIO();
    io.to(auction.roomCode).emit("auction:skip", {
      teamId: teamId,
      teamName: teamName,
      playerId: auction.currentPlayerId,
    });

    // Check if all captain teams have skipped - optimize query
    const teams = await Team.find({ _id: { $in: auction.teams } })
      .select("captainId _id")
      .lean();
    const captainTeams = teams
      .filter((t: any) => t.captainId)
      .map((t: any) => (t._id || t.id)?.toString());
    const allSkipped =
      captainTeams.length > 0 &&
      captainTeams.every((tid) => auction.skippedTeams?.includes(tid));

    // Check if current bidder has also skipped
    const currentBidderSkipped =
      auction.currentBid &&
      auction.skippedTeams?.includes(auction.currentBid.teamId);

    // If all teams skipped OR bidder skipped, mark as unsold (even if there was a bid)
    // This ensures that if someone bid then skipped, and everyone else skipped, player goes unsold
    if (allSkipped || currentBidderSkipped) {
      const { markPlayerUnsold, stopAuctionTimer } = await import(
        "../utils/timer.js"
      );
      stopAuctionTimer(id);
      await markPlayerUnsold(id, auction.roomCode);
      return res
        .status(StatusCodes.OK)
        .json({ message: "Player marked as unsold" });
    }

    // Check if only one captain hasn't skipped and that captain has the current bid
    // If so, immediately sell the player to that captain without waiting for timer
    const remainingCaptains = captainTeams.filter(
      (tid) => !auction.skippedTeams?.includes(tid)
    );

    if (
      remainingCaptains.length === 1 &&
      auction.currentBid &&
      auction.currentBid.teamId === remainingCaptains[0]
    ) {
      // Only one captain left, and they have the bid - sell immediately
      const { sellCurrentPlayer, stopAuctionTimer } = await import(
        "../utils/timer.js"
      );
      stopAuctionTimer(id);
      await sellCurrentPlayer(id, auction.roomCode);
      return res
        .status(StatusCodes.OK)
        .json({ message: "Player sold immediately" });
    }
  } catch {}

  return res.status(StatusCodes.OK).json({ auction });
}
