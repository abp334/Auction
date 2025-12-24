import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import Joi from "joi";
import { Auction } from "../models/Auction.js";
import { Player } from "../models/Player.js";
import { Team } from "../models/Team.js";
import { getIO } from "../sockets/io.js";
import { User } from "../models/User.js";
import { hashPassword } from "../utils/auth.js";
import {
  startAuctionTimer,
  stopAuctionTimer,
  resetAuctionTimer,
  initAuctionQueue,
} from "../utils/timer.js";

// --- VALIDATION SCHEMAS ---

const importSchema = Joi.object({
  name: Joi.string().min(2).required(),
  teams: Joi.array()
    .items(
      Joi.object({
        name: Joi.string().required(),
        wallet: Joi.number().required(),
        logo: Joi.string().optional().allow(null, ""),
        owner: Joi.string().optional().allow(null, ""),
        code: Joi.alternatives()
          .try(Joi.string(), Joi.number())
          .optional()
          .allow(null, ""),
        captain: Joi.string().optional().allow(null, ""),
        captainEmail: Joi.string().email().optional().allow(null, ""),
      })
    )
    .min(2)
    .required(),
  players: Joi.array()
    .items(
      Joi.object({
        name: Joi.string().required(),
        role: Joi.string().required(),
        basePrice: Joi.number().required(),
        photo: Joi.string().optional().allow(null, ""),
        age: Joi.number().optional().allow(null),
        batsmanType: Joi.string().optional().allow(null, ""),
        bowlerType: Joi.string().optional().allow(null, ""),
        mobile: Joi.alternatives()
          .try(Joi.string(), Joi.number())
          .optional()
          .allow(null, ""),
        email: Joi.string().optional().allow(null, ""),
      })
    )
    .min(1)
    .required(),
});

const bidSchema = Joi.object({
  teamId: Joi.string().required(),
  amount: Joi.number().min(0).required(),
  playerId: Joi.string().optional(),
});

const currentPlayerSchema = Joi.object({
  playerId: Joi.string().required(),
});

const pendingBids = new Map<string, Promise<any>>();

// --- CONTROLLERS ---

export async function listAuctions(req: Request, res: Response) {
  const { roomCode } = req.query as { roomCode?: string };
  const filter = roomCode ? { roomCode } : {};
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
  const { error, value } = importSchema.validate(req.body);
  if (error)
    return res.status(StatusCodes.BAD_REQUEST).json({ error: error.message });

  try {
    // --- STEP 0: CLEAR EXISTING DATA (Fix for Duplicate Key Error) ---
    // This ensures a fresh start every time you upload a CSV
    await Team.deleteMany({});
    await Player.deleteMany({});
    // Optional: Reset existing captains to players so they can be re-linked cleanly
    await User.updateMany(
      { role: "captain" },
      { $set: { role: "player" }, $unset: { teamId: 1 } }
    );

    // --- STEP 1: CREATE TEAMS ---
    const teamsToInsert = value.teams.map((t: any) => ({
      ...t,
      code: t.code ? String(t.code) : undefined,
      wallet: t.wallet || 1000000,
    }));

    const createdTeams = await Team.insertMany(teamsToInsert);
    const teamIds = createdTeams.map((t) => t._id);

    // --- STEP 2: LINK OR CREATE CAPTAINS ---
    let linkedCaptains = 0;
    for (let i = 0; i < value.teams.length; i++) {
      const inputTeam = value.teams[i];
      const newTeam = createdTeams[i];

      if (inputTeam.captainEmail) {
        // Check if user exists
        let user = await User.findOne({ email: inputTeam.captainEmail });

        if (!user) {
          // -> User doesn't exist: Create new Account
          // Password becomes the Team Name
          const passwordHash = await hashPassword(inputTeam.name);

          user = await User.create({
            name: inputTeam.captain || "Captain",
            email: inputTeam.captainEmail,
            passwordHash: passwordHash,
            role: "captain",
            teamId: (newTeam as any)._id.toString(),
            emailVerified: true,
          });
        } else {
          // -> User exists: Link them to this team
          user.teamId = (newTeam as any)._id.toString();
          user.role = "captain";
          await user.save();
        }

        // Link User to Team
        newTeam.captainId = (user as any)._id.toString();
        newTeam.captain = user.name;
        await newTeam.save();
        linkedCaptains++;
      }
    }

    // --- STEP 3: CREATE PLAYERS ---
    const playersToInsert = value.players.map((p: any) => ({
      ...p,
      mobile: p.mobile ? String(p.mobile) : undefined,
      teamId: "UNSOLD",
    }));
    const createdPlayers = await Player.insertMany(playersToInsert);
    const playerIds = createdPlayers.map((p) => p._id);

    // --- STEP 4: CREATE AUCTION SESSION ---
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let roomCode = "";
    for (let i = 0; i < 6; i++) {
      roomCode += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
    }

    const auction = await Auction.create({
      name: value.name,
      players: playerIds,
      teams: teamIds,
      roomCode,
      createdBy: req.user?.id || "system",
      state: "draft",
    });

    return res.status(StatusCodes.CREATED).json({
      auction,
      message: `Imported ${createdTeams.length} teams (${linkedCaptains} captains linked) and ${createdPlayers.length} players.`,
    });
  } catch (err: any) {
    console.error("Import failed:", err);
    return res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ error: "Failed to import: " + err.message });
  }
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

    const p = await Player.findById(nextPlayerId).lean();
    getIO()
      .to(auction.roomCode)
      .emit("auction:player_changed", {
        playerId: nextPlayerId,
        player: { ...p, id: p?._id },
      });
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
    }).sort({ _id: 1 });

    if (nextUnsoldPlayer) {
      const playerId = (nextUnsoldPlayer as any)._id.toString();
      auction.currentPlayerId = playerId;
      auction.currentBid = undefined;
      auction.skippedTeams = [];
      await auction.save();
      await startAuctionTimer(id, auction.roomCode);

      const io = getIO();
      io.to(auction.roomCode).emit("auction:player_changed", {
        playerId: playerId,
        player: { ...nextUnsoldPlayer.toObject(), id: playerId },
      });
    }
  }
  return res.status(StatusCodes.OK).json({ auction });
}

export async function placeBid(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { error, value } = bidSchema.validate(req.body);
    if (error)
      return res.status(StatusCodes.BAD_REQUEST).json({ error: error.message });

    const dedupeKey = `bid:${id}:${value.teamId}`;
    if (pendingBids.has(dedupeKey)) return pendingBids.get(dedupeKey);

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

        // --- VALIDATION CHECKS ---
        if (!auction || !team)
          return res.status(StatusCodes.NOT_FOUND).json({ error: "Not found" });
        if (auction.state !== "active")
          return res
            .status(StatusCodes.CONFLICT)
            .json({ error: "Auction not active" });

        // Captain Check
        if ((req as any).user?.role === "captain" && user?.teamId !== team.id) {
          return res
            .status(StatusCodes.FORBIDDEN)
            .json({ error: "Captains only bid for their team" });
        }

        // --- NEW: SQUAD SIZE CHECK ---
        const currentSquadSize = await Player.countDocuments({
          teamId: team.id,
        });
        if (currentSquadSize >= 25) {
          return res
            .status(StatusCodes.BAD_REQUEST)
            .json({ error: "Squad full (Max 25 players)" });
        }

        // --- NEW: DYNAMIC INCREMENT CHECK ---
        // 1. Get the current "Target Price" (Last Bid OR Base Price)
        let currentPrice = 0;
        if (auction.currentBid?.amount) {
          currentPrice = auction.currentBid.amount;
        } else {
          const player = await Player.findById(auction.currentPlayerId).select(
            "basePrice"
          );
          if (!player)
            return res.status(400).json({ error: "No active player" });
          currentPrice = player.basePrice;
        }

        // 2. Calculate Required Increment based on price bracket
        let minIncrement = 0;
        if (currentPrice < 1000000) minIncrement = 50000; // Under 10L: +50k
        else if (currentPrice < 5000000)
          minIncrement = 200000; // Under 50L: +2L
        else minIncrement = 500000; // Above 50L: +5L

        // 3. Determine Minimum Valid Bid
        // If it's the first bid, it just needs to match Base Price.
        // If it's a counter-bid, it must be Current + Increment.
        let minValidBid = 0;
        if (!auction.currentBid) {
          minValidBid = currentPrice; // First bid can match base price
        } else {
          minValidBid = currentPrice + minIncrement;
        }

        if (value.amount < minValidBid) {
          return res.status(StatusCodes.BAD_REQUEST).json({
            error: `Bid too low. Minimum required: ₹${minValidBid.toLocaleString()}`,
          });
        }

        // --- WALLET CHECK ---
        if (team.wallet < value.amount)
          return res
            .status(StatusCodes.BAD_REQUEST)
            .json({ error: "Insufficient budget" });

        if (
          auction.currentPlayerId &&
          value.playerId &&
          auction.currentPlayerId !== value.playerId
        ) {
          return res
            .status(StatusCodes.BAD_REQUEST)
            .json({ error: "Wrong player" });
        }

        // --- EXECUTE BID ---
        const bid = {
          teamId: value.teamId,
          amount: value.amount,
          playerId: value.playerId,
          at: new Date(),
        };

        const updated = await Auction.findOneAndUpdate(
          {
            _id: id,
            $or: [
              { currentBid: { $exists: false } },
              { "currentBid.amount": { $lt: value.amount } },
            ],
          },
          {
            $set: { currentBid: bid, skippedTeams: [] },
            $push: { bidHistory: bid },
          },
          { new: true }
        );

        if (!updated)
          return res
            .status(StatusCodes.CONFLICT)
            .json({ error: "Higher bid exists" });

        resetAuctionTimer(id, updated.roomCode).catch(console.error);
        getIO().to(updated.roomCode).emit("auction:bid_update", {
          amount: bid.amount,
          teamId: bid.teamId,
          playerId: bid.playerId,
          at: bid.at.getTime(),
        });

        return res.status(StatusCodes.OK).json({ auction: updated });
      } finally {
        setTimeout(() => pendingBids.delete(dedupeKey), 500);
      }
    })();

    pendingBids.set(dedupeKey, bidPromise);
    return bidPromise;
  } catch (err: any) {
    return res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ error: err.message });
  }
}
export async function undoBid(req: Request, res: Response) {
  const { id } = req.params;
  const user = (req as any).user as { id: string; role: string } | undefined;
  if (!user)
    return res.status(StatusCodes.UNAUTHORIZED).json({ error: "Unauthorized" });

  const auction = await Auction.findById(id);
  if (!auction)
    return res
      .status(StatusCodes.NOT_FOUND)
      .json({ error: "Auction not found" });
  if (auction.state !== "active")
    return res.status(StatusCodes.BAD_REQUEST).json({ error: "Not active" });
  if (!auction.currentBid)
    return res
      .status(StatusCodes.BAD_REQUEST)
      .json({ error: "No bid to undo" });

  const dbUser = await User.findById(user.id).select("teamId");
  if (!dbUser?.teamId || auction.currentBid.teamId !== dbUser.teamId) {
    return res.status(StatusCodes.FORBIDDEN).json({ error: "Not your bid" });
  }

  const lastBid = auction.bidHistory[auction.bidHistory.length - 1];
  if (!lastBid || lastBid.teamId !== dbUser.teamId) {
    return res
      .status(StatusCodes.BAD_REQUEST)
      .json({ error: "Another bid exists" });
  }

  auction.bidHistory.pop();
  auction.currentBid =
    auction.bidHistory.length > 0
      ? auction.bidHistory[auction.bidHistory.length - 1]
      : undefined;
  await auction.save();

  const team = await Team.findById(dbUser.teamId);
  getIO().to(auction.roomCode).emit("auction:bid_undo", {
    teamId: dbUser.teamId,
    teamName: team?.name,
    currentBid: auction.currentBid,
  });
  if (auction.currentBid) resetAuctionTimer(id, auction.roomCode);

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

  let finalData = {};

  try {
    const teams = await Team.find({ _id: { $in: auction.teams } }).lean();
    const players = await Player.find({ _id: { $in: auction.players } }).lean();

    const report = teams.map((team) => {
      const teamPlayers = players.filter(
        (p) => String(p.teamId) === String(team._id)
      );
      const spent = teamPlayers.reduce((sum, p) => {
        const sale = auction.sales.find(
          (s) => String(s.playerId) === String(p._id)
        );
        return sum + (sale?.price || 0);
      }, 0);

      return {
        TeamName: team.name,
        Captain: team.captain || "None",
        PlayersCount: teamPlayers.length,
        TotalSpent: spent,
        RemainingPurse: team.wallet,
        Roster: teamPlayers.map((p) => {
          const sale = auction.sales.find(
            (s) => String(s.playerId) === String(p._id)
          );
          return {
            Name: p.name,
            Role: p.role,
            Mobile: p.mobile,
            Email: p.email,
            Price: sale?.price || 0,
          };
        }),
      };
    });

    const unsoldList = players
      .filter((p) => !p.teamId || p.teamId === "UNSOLD")
      .map((p) => ({
        Name: p.name,
        Role: p.role,
        Mobile: p.mobile,
        Email: p.email,
        BasePrice: p.basePrice,
      }));

    finalData = {
      auctionName: auction.name,
      date: new Date(),
      teams: report,
      unsold: unsoldList,
    };
  } catch (err) {
    console.error("Report generation error:", err);
  }

  try {
    await Player.deleteMany({ _id: { $in: auction.players } });
    await Team.deleteMany({ _id: { $in: auction.teams } });

    auction.state = "completed";
    auction.players = [];
    auction.teams = [];
    await auction.save();

    getIO().to(auction.roomCode).emit("auction:ended", {
      message: "Auction completed and data cleared.",
      auctionId: auction.id,
    });

    return res
      .status(StatusCodes.OK)
      .json({ message: "Closed", report: finalData });
  } catch (err: any) {
    return res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ error: "Failed to wipe data" });
  }
}

export async function setCurrentPlayer(req: Request, res: Response) {
  const { error, value } = currentPlayerSchema.validate(req.body);
  if (error)
    return res.status(StatusCodes.BAD_REQUEST).json({ error: error.message });

  const { id } = req.params;
  const auction = await Auction.findByIdAndUpdate(
    id,
    { currentPlayerId: value.playerId, currentBid: undefined },
    { new: true }
  );
  if (!auction)
    return res.status(StatusCodes.NOT_FOUND).json({ error: "Not found" });

  const player = await Player.findById(value.playerId);
  if (player) {
    getIO()
      .to(auction.roomCode)
      .emit("auction:player_changed", {
        playerId: player.id,
        player: { ...player.toObject(), id: player.id },
      });
  }
  return res.status(StatusCodes.OK).json({ auction });
}

export async function sellCurrent(req: Request, res: Response) {
  const { id } = req.params;
  const auction = await Auction.findById(id);
  if (!auction || auction.state !== "active")
    return res
      .status(StatusCodes.BAD_REQUEST)
      .json({ error: "Invalid auction" });
  if (!auction.currentPlayerId)
    return res.status(StatusCodes.BAD_REQUEST).json({ error: "No player" });

  if (!auction.currentBid) {
    const nextP = await Player.findOne({
      $or: [{ teamId: { $exists: false } }, { teamId: null }],
    }).sort({ _id: 1 });
    if (nextP) {
      auction.currentPlayerId = (nextP as any)._id.toString();
      await auction.save();
      getIO()
        .to(auction.roomCode)
        .emit("auction:player_changed", {
          playerId: nextP.id,
          player: { ...nextP.toObject(), id: nextP.id },
        });
    } else {
      auction.state = "completed";
      auction.currentPlayerId = undefined;
      await auction.save();
      getIO()
        .to(auction.roomCode)
        .emit("auction:completed", { message: "Done" });
    }
    return res.status(StatusCodes.OK).json({ auction });
  }

  const team = await Team.findById(auction.currentBid.teamId);
  const player = await Player.findById(auction.currentPlayerId);
  if (!team || !player)
    return res.status(StatusCodes.BAD_REQUEST).json({ error: "Data error" });

  if (team.wallet < auction.currentBid.amount)
    return res.status(StatusCodes.BAD_REQUEST).json({ error: "No funds" });

  const salePrice = auction.currentBid.amount;

  team.wallet -= salePrice;
  await team.save();

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

  getIO().to(auction.roomCode).emit("auction:sale", {
    playerId: player.id,
    playerName: player.name,
    teamId: team.id,
    teamName: team.name,
    price: salePrice,
  });

  return res.status(StatusCodes.OK).json({ auction });
}

export async function skipPlayer(req: Request, res: Response) {
  const { id } = req.params;
  const user = (req as any).user;
  const auction = await Auction.findById(id);
  if (!auction || auction.state !== "active")
    return res
      .status(StatusCodes.BAD_REQUEST)
      .json({ error: "Invalid auction" });

  const dbUser = await User.findById(user.id);
  if (!dbUser?.teamId)
    return res.status(StatusCodes.BAD_REQUEST).json({ error: "No team" });

  if (!auction.skippedTeams) auction.skippedTeams = [];
  if (auction.skippedTeams.includes(dbUser.teamId))
    return res
      .status(StatusCodes.BAD_REQUEST)
      .json({ error: "Already skipped" });

  auction.skippedTeams.push(dbUser.teamId);
  await auction.save();

  getIO().to(auction.roomCode).emit("auction:skip", {
    teamId: dbUser.teamId,
    teamName: "Team",
    playerId: auction.currentPlayerId,
  });

  return res.status(StatusCodes.OK).json({ auction });
}
