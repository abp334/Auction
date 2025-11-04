import { StatusCodes } from "http-status-codes";
import type { Request, Response } from "express";
import Joi from "joi";
import { nanoid } from "nanoid";
import { Auction } from "../models/Auction.js";
import { Player } from "../models/Player.js";
import { Team } from "../models/Team.js";
import { getIO } from "../sockets/io.js";
import { User } from "../models/User.js";

const createSchema = Joi.object({
  name: Joi.string().min(2).required(),
  players: Joi.array().items(Joi.string()).default([]),
  teams: Joi.array().items(Joi.string()).default([]),
});

export async function listAuctions(req: Request, res: Response) {
  const { roomCode } = req.query as { roomCode?: string };
  const filter = roomCode ? { roomCode } : {};
  const auctions = await Auction.find(filter).sort({ createdAt: -1 });
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
    { state: "active" },
    { new: true }
  );
  if (!auction)
    return res
      .status(StatusCodes.NOT_FOUND)
      .json({ error: "Auction not found" });

  // Automatically select first unsold player
  const firstUnsoldPlayer = await Player.findOne({
    teamId: { $exists: false },
  }).sort({ _id: 1 });
  if (firstUnsoldPlayer) {
    auction.currentPlayerId = firstUnsoldPlayer.id;
    auction.currentBid = undefined;
    await auction.save();

    // Broadcast to all clients
    try {
      const io = getIO();
      io.to(auction.roomCode).emit("auction:player_changed", {
        playerId: firstUnsoldPlayer.id,
        player: {
          id: firstUnsoldPlayer.id,
          name: firstUnsoldPlayer.name,
          photo: firstUnsoldPlayer.photo,
          age: firstUnsoldPlayer.age,
          role: firstUnsoldPlayer.role,
          bowlerType: firstUnsoldPlayer.bowlerType,
          basePrice: firstUnsoldPlayer.basePrice,
        },
      });
    } catch {}
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
  return res.status(StatusCodes.OK).json({ auction });
}

const bidSchema = Joi.object({
  teamId: Joi.string().required(),
  amount: Joi.number().min(0).required(),
  playerId: Joi.string().optional(),
});

export async function placeBid(req: Request, res: Response) {
  const { id } = req.params; // auction id
  const { error, value } = bidSchema.validate(req.body);
  if (error)
    return res.status(StatusCodes.BAD_REQUEST).json({ error: error.message });

  const auction = await Auction.findById(id);
  if (!auction)
    return res
      .status(StatusCodes.NOT_FOUND)
      .json({ error: "Auction not found" });
  if (auction.state !== "active")
    return res
      .status(StatusCodes.CONFLICT)
      .json({ error: "Auction is not active" });

  // Optionally validate team and player existence
  const team = await Team.findById(value.teamId);
  if (!team)
    return res.status(StatusCodes.BAD_REQUEST).json({ error: "Invalid team" });
  if (value.playerId) {
    const player = await Player.findById(value.playerId);
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
    const dbUser = await User.findById(user.id);
    const captainTeamId = dbUser?.teamId;
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
  auction.bidHistory.push(bid);
  await auction.save();

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
}

export async function closeAuction(req: Request, res: Response) {
  const { id } = req.params;
  const auction = await Auction.findByIdAndUpdate(
    id,
    { state: "completed" },
    { new: true }
  );
  if (!auction)
    return res
      .status(StatusCodes.NOT_FOUND)
      .json({ error: "Auction not found" });
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
      teamId: { $exists: false },
    }).sort({ _id: 1 });
    if (nextUnsoldPlayer) {
      auction.currentPlayerId = nextUnsoldPlayer.id;
      auction.currentBid = undefined;
      await auction.save();

      try {
        const io = getIO();
        io.to(auction.roomCode).emit("auction:player_changed", {
          playerId: nextUnsoldPlayer.id,
          player: {
            id: nextUnsoldPlayer.id,
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

  // Automatically select next unsold player
  const nextUnsoldPlayer = await Player.findOne({
    teamId: { $exists: false },
  }).sort({ _id: 1 });
  if (nextUnsoldPlayer) {
    auction.currentPlayerId = nextUnsoldPlayer.id;
    await auction.save();

    // Broadcast sale and next player
    try {
      const io = getIO();
      io.to(auction.roomCode).emit("auction:sale", {
        playerId: player.id,
        playerName: player.name,
        teamId: team.id,
        teamName: team.name,
        price: salePrice,
      });
      io.to(auction.roomCode).emit("auction:player_changed", {
        playerId: nextUnsoldPlayer.id,
        player: {
          id: nextUnsoldPlayer.id,
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
