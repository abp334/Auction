import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import Joi from "joi";
import mongoose from "mongoose";
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
  initAuctionQueue,
} from "../utils/timer.js";

const createSchema = Joi.object({
  name: Joi.string().min(2).required(),
  players: Joi.array().items(Joi.string()).default([]),
  teams: Joi.array().items(Joi.string()).default([]),
});

export async function listAuctions(req: Request, res: Response) {
  const { roomCode } = req.query as { roomCode?: string };
  const filter = roomCode ? { roomCode } : {};
  // OPTIMIZATION: Fetch timer fields so client clock starts immediately
  const auctions = await Auction.find(filter)
    .select(
      "name roomCode state currentPlayerId currentBid createdAt timerEndsAt timerDuration"
    )
    .sort({ createdAt: -1 })
    .lean();
  return res.status(StatusCodes.OK).json({ auctions });
}

export async function createAuction(
  req: Request & { user?: { id: string } },
  res: Response
) {
  const { error, value } = createSchema.validate(req.body);
  if (error)
    return res.status(StatusCodes.BAD_REQUEST).json({ error: error.message });

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
    { state: "active", unsoldPlayers: [] },
    { new: true }
  );
  if (!auction)
    return res
      .status(StatusCodes.NOT_FOUND)
      .json({ error: "Auction not found" });

  try {
    await initAuctionQueue(id);
    const queue =
      (await import("../utils/timer.js")).auctionPlayerQueues.get(id) || [];
    const nextPlayerId = queue.shift();
    (await import("../utils/timer.js")).auctionPlayerQueues.set(id, queue);

    if (nextPlayerId) {
      auction.currentPlayerId = nextPlayerId;
      auction.currentBid = undefined;
      auction.skippedTeams = [];
      await auction.save();

      await startAuctionTimer(id, auction.roomCode);

      try {
        const p = await Player.findById(nextPlayerId).select(
          "_id name photo age role bowlerType basePrice"
        );
        const io = getIO();
        io.to(auction.roomCode).emit("auction:player_changed", {
          playerId: nextPlayerId,
          player: {
            id: nextPlayerId,
            name: p?.name || "Player",
            photo: p?.photo || "",
            age: p?.age || 25,
            role: p?.role || "",
            bowlerType: p?.bowlerType || "",
            basePrice: p?.basePrice || 1000,
          },
        });
      } catch (err) {
        console.error("Error broadcasting player_changed:", err);
      }
    }
  } catch (err) {
    console.error("Failed to initialize auction queue:", err);
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

  if (auction.currentPlayerId) {
    await startAuctionTimer(id, auction.roomCode);
  } else {
    const soldPlayerIds = (auction.sales || []).map((s: any) => s.playerId);
    const nextUnsoldPlayer = await Player.findOne({
      $or: [
        { teamId: { $exists: false } },
        { teamId: null },
        { teamId: "" },
        { teamId: "UNSOLD" },
      ],
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

const pendingBids = new Map<string, Promise<any>>();

export async function placeBid(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { error, value } = bidSchema.validate(req.body);
    if (error)
      return res.status(StatusCodes.BAD_REQUEST).json({ error: error.message });

    const dedupeKey = `bid:${id}:${value.teamId}`;
    const existing = pendingBids.get(dedupeKey);
    if (existing) {
      return existing;
    }

    const bidPromise = (async () => {
      try {
        const [auction, team, user] = await Promise.all([
          Auction.findById(id).select(
            "state currentBid currentPlayerId roomCode skippedTeams teams bidHistory"
          ),
          Team.findById(value.teamId).select("wallet name _id"),
          (req as any).user
            ? User.findById((req as any).user.id).select("teamId")
            : null,
        ]);

        if (!auction)
          return res
            .status(StatusCodes.NOT_FOUND)
            .json({ error: "Auction not found" });
        if (auction.state !== "active")
          return res
            .status(StatusCodes.CONFLICT)
            .json({ error: "Auction is not active" });
        if (!team)
          return res
            .status(StatusCodes.BAD_REQUEST)
            .json({ error: "Invalid team" });

        const currentUser = (req as any).user as
          | { id: string; role: "admin" | "captain" | "player" }
          | undefined;
        if (currentUser?.role === "captain") {
          const captainTeamId = user?.teamId;
          if (!captainTeamId || team.id !== captainTeamId) {
            return res
              .status(StatusCodes.FORBIDDEN)
              .json({ error: "Captains can only bid for their team" });
          }
        }

        const minBid = 1000;
        if (value.amount < minBid)
          return res
            .status(StatusCodes.BAD_REQUEST)
            .json({ error: `Minimum bid is ${minBid}` });

        if (team.wallet < value.amount)
          return res
            .status(StatusCodes.BAD_REQUEST)
            .json({ error: "Insufficient team budget" });

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

        // FIX: Use Atomic Update with Condition to prevent Race Conditions
        // We only update if the incoming bid is greater than the current bid stored in DB.
        // Or if there is no current bid.
        const query = {
          _id: id,
          $or: [
            { currentBid: { $exists: false } },
            { "currentBid.amount": { $lt: value.amount } },
          ],
        };

        const updatedAuction = await Auction.findOneAndUpdate(
          query,
          {
            $set: { currentBid: bid, skippedTeams: [] },
            $push: { bidHistory: bid },
          },
          { new: true }
        );

        if (!updatedAuction) {
          // If update failed, it means someone else bid higher in the meantime
          return res
            .status(StatusCodes.CONFLICT) // 409 Conflict
            .json({ error: "Bid rejected: A higher bid was just placed." });
        }

        resetAuctionTimer(id, updatedAuction.roomCode).catch(console.error);

        try {
          const io = getIO();
          io.to(updatedAuction.roomCode).emit("auction:bid_update", {
            amount: bid.amount,
            teamId: bid.teamId,
            playerId: bid.playerId,
            at: bid.at.getTime(),
          });
        } catch {}

        return res.status(StatusCodes.OK).json({ auction: updatedAuction });
      } finally {
        setTimeout(() => {
          pendingBids.delete(dedupeKey);
        }, 500);
      }
    })();

    pendingBids.set(dedupeKey, bidPromise);
    return bidPromise;
  } catch (err: any) {
    console.error("Error in placeBid:", err);
    return res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ error: err.message || "Internal server error" });
  }
}

export async function undoBid(req: Request, res: Response) {
  const { id } = req.params;
  const user = (req as any).user as { id: string; role: string } | undefined;
  if (!user) {
    return res.status(StatusCodes.UNAUTHORIZED).json({ error: "Unauthorized" });
  }

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

  const dbUser = await User.findById(user.id).select("teamId").lean();
  if (!dbUser || !dbUser.teamId) {
    return res
      .status(StatusCodes.BAD_REQUEST)
      .json({ error: "You must be assigned to a team" });
  }

  const teamId = dbUser.teamId;

  if (auction.currentBid.teamId !== teamId) {
    return res
      .status(StatusCodes.FORBIDDEN)
      .json({ error: "You can only undo your own bid" });
  }

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

  auction.bidHistory.pop();

  if (auction.bidHistory.length > 0) {
    const previousBid = auction.bidHistory[auction.bidHistory.length - 1];
    auction.currentBid = previousBid;
  } else {
    auction.currentBid = undefined;
  }

  await auction.save();

  const team = await Team.findById(teamId);
  const teamName = team?.name || `Team ${teamId.substring(0, 6)}`;

  try {
    const io = getIO();
    io.to(auction.roomCode).emit("auction:bid_undo", {
      teamId: teamId,
      teamName: teamName,
      currentBid: auction.currentBid,
    });

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

  stopAuctionTimer(id);

  auction.state = "completed";
  await auction.save();

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
  const { id } = req.params;
  const auction = await Auction.findById(id);
  if (!auction)
    return res
      .status(StatusCodes.NOT_FOUND)
      .json({ error: "Auction not found" });

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

  const alreadySold = auction.sales.some(
    (sale: any) => sale.playerId === auction.currentPlayerId
  );
  if (alreadySold) {
    return res
      .status(StatusCodes.BAD_REQUEST)
      .json({ error: "Player already sold" });
  }

  if (player.teamId && player.teamId !== "UNSOLD") {
    return res
      .status(StatusCodes.BAD_REQUEST)
      .json({ error: "Player already assigned to a team" });
  }

  const salePrice = auction.currentBid.amount;

  const updatedTeam = await Team.findByIdAndUpdate(
    team.id,
    { $inc: { wallet: -salePrice } },
    { new: true }
  );
  if (!updatedTeam || updatedTeam.wallet < 0) {
    return res
      .status(StatusCodes.BAD_REQUEST)
      .json({ error: "Insufficient team budget" });
  }

  player.teamId = team.id;
  await player.save();

  auction.sales.push({
    playerId: player.id,
    teamId: team.id,
    price: salePrice,
    at: new Date(),
  });
  auction.currentBid = undefined;
  await auction.save();

  const soldPlayerIds = (auction.sales || []).map((s: any) => s.playerId);
  const nextUnsoldPlayer = await Player.findOne({
    $or: [
      { teamId: { $exists: false } },
      { teamId: null },
      { teamId: "" },
      { teamId: "UNSOLD" },
    ],
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
    auction.state = "completed";
    auction.currentPlayerId = undefined;
    await auction.save();

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
  const { id } = req.params;
  const user = (req as any).user as { id: string; role: string } | undefined;
  if (!user) {
    return res.status(StatusCodes.UNAUTHORIZED).json({ error: "Unauthorized" });
  }

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

  const dbUser = await User.findById(user.id).select("teamId");
  if (!dbUser || !dbUser.teamId) {
    return res
      .status(StatusCodes.BAD_REQUEST)
      .json({ error: "You must be assigned to a team" });
  }

  const teamId = dbUser.teamId;

  if (auction.skippedTeams?.includes(teamId)) {
    return res
      .status(StatusCodes.BAD_REQUEST)
      .json({ error: "You have already skipped this player" });
  }

  if (!auction.skippedTeams) {
    auction.skippedTeams = [];
  }
  auction.skippedTeams.push(teamId);
  await auction.save();

  const team = await Team.findById(teamId);
  const teamName = team?.name || `Team ${teamId.substring(0, 6)}`;

  try {
    const io = getIO();
    io.to(auction.roomCode).emit("auction:skip", {
      teamId: teamId,
      teamName: teamName,
      playerId: auction.currentPlayerId,
    });

    const teams = await Team.find({ _id: { $in: auction.teams } })
      .select("captainId _id")
      .lean();
    const captainTeams = teams
      .filter((t: any) => t.captainId)
      .map((t: any) => (t._id || t.id)?.toString());
    const allSkipped =
      captainTeams.length > 0 &&
      captainTeams.every((tid) => auction.skippedTeams?.includes(tid));

    const currentBidderSkipped =
      auction.currentBid &&
      auction.skippedTeams?.includes(auction.currentBid.teamId);

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

    const remainingCaptains = captainTeams.filter(
      (tid) => !auction.skippedTeams?.includes(tid)
    );

    if (
      remainingCaptains.length === 1 &&
      auction.currentBid &&
      auction.currentBid.teamId === remainingCaptains[0]
    ) {
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
