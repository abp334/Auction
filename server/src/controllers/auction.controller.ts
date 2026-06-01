import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import Joi from "joi";
import prisma from "../utils/db.js";
import { getIO } from "../sockets/io.js";
import { hashPassword } from "../utils/auth.js";
import { logger } from "../utils/logger.js";
import {
  startAuctionTimer,
  stopAuctionTimer,
  resetAuctionTimer,
  initAuctionQueue,
  moveToNextPlayer,
  auctionPlayerQueues,
} from "../utils/timer.js";

const BID_INCREMENT = 1000;

function getMinimumBid(currentPrice: number, hasCurrentBid: boolean) {
  return hasCurrentBid ? currentPrice + BID_INCREMENT : currentPrice;
}

function buildCaptainPassword(teamName: string) {
  return teamName.replace(/\s+/g, "");
}

function generateRoomCode(): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
  }
  return code;
}

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
  amount: Joi.number().integer().min(0).required(),
  playerId: Joi.string().optional(),
});

const currentPlayerSchema = Joi.object({
  playerId: Joi.string().required(),
});

const pendingBids = new Map<string, Promise<any>>();

export async function listAuctions(req: Request, res: Response) {
  const { roomCode } = req.query as { roomCode?: string };
  const where = roomCode ? { roomCode } : {};

  const auctions = await prisma.auction.findMany({
    where,
    select: {
      id: true,
      name: true,
      roomCode: true,
      state: true,
      currentPlayerId: true,
      currentBidAmount: true,
      currentBidTeamId: true,
      currentBidAt: true,
      timerEndsAt: true,
      timerDuration: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const mapped = auctions.map((a) => ({
    ...a,
    currentBid: a.currentBidAmount
      ? {
          amount: a.currentBidAmount,
          teamId: a.currentBidTeamId,
          at: a.currentBidAt,
        }
      : undefined,
  }));

  return res.status(StatusCodes.OK).json({ auctions: mapped });
}

export async function getAuction(req: Request, res: Response) {
  const { id } = req.params;
  const auction = await prisma.auction.findUnique({
    where: { id },
    include: {
      teams: { include: { team: true } },
      players: { include: { player: true }, orderBy: { sortOrder: "asc" } },
      sales: { include: { player: true, team: true } },
      unsoldPlayers: true,
      skippedTeams: true,
      bids: {
        where: { playerId: undefined },
        orderBy: { createdAt: "desc" },
        take: 50,
      },
    },
  });

  if (!auction)
    return res
      .status(StatusCodes.NOT_FOUND)
      .json({ error: "Auction not found" });

  const result = {
    ...auction,
    currentBid: auction.currentBidAmount
      ? {
          amount: auction.currentBidAmount,
          teamId: auction.currentBidTeamId,
          at: auction.currentBidAt,
        }
      : undefined,
    bidHistory: auction.bids,
  };

  return res.status(StatusCodes.OK).json({ auction: result });
}

export async function createAuction(
  req: Request & { user?: { id: string } },
  res: Response
) {
  const { error, value } = importSchema.validate(req.body);
  if (error)
    return res.status(StatusCodes.BAD_REQUEST).json({ error: error.message });

  try {
    let roomCode = generateRoomCode();
    for (let attempt = 0; attempt < 5; attempt++) {
      const exists = await prisma.auction.findUnique({
        where: { roomCode },
      });
      if (!exists) break;
      roomCode = generateRoomCode();
    }

    const result = await prisma.$transaction(async (tx) => {
      const createdTeams = await Promise.all(
        value.teams.map((t: any) =>
          tx.team.create({
            data: {
              name: t.name,
              wallet: t.wallet || 1000000,
              logo: t.logo || null,
              owner: t.owner || null,
              mobile: t.code ? String(t.code) : null,
              captain: t.captain || null,
            },
          })
        )
      );

      let linkedCaptains = 0;
      for (let i = 0; i < value.teams.length; i++) {
        const inputTeam = value.teams[i];
        const newTeam = createdTeams[i];

        if (inputTeam.captainEmail) {
          let user = await tx.user.findUnique({
            where: { email: inputTeam.captainEmail },
          });

          if (!user) {
            const passwordHash = await hashPassword(
              buildCaptainPassword(inputTeam.name)
            );
            user = await tx.user.create({
              data: {
                name: inputTeam.captain || "Captain",
                email: inputTeam.captainEmail,
                passwordHash,
                role: "captain",
                teamId: newTeam.id,
                emailVerified: true,
              },
            });
          } else {
            user = await tx.user.update({
              where: { id: user.id },
              data: { teamId: newTeam.id, role: "captain" },
            });
          }

          await tx.team.update({
            where: { id: newTeam.id },
            data: { captainId: user.id, captain: user.name },
          });
          linkedCaptains++;
        }
      }

      const createdPlayers = await Promise.all(
        value.players.map((p: any) =>
          tx.player.create({
            data: {
              name: p.name,
              role: p.role,
              basePrice: p.basePrice,
              photo: p.photo || null,
              age: p.age || null,
              batsmanType: p.batsmanType || null,
              bowlerType: p.bowlerType || null,
              mobile: p.mobile ? String(p.mobile) : null,
              email: p.email || null,
              teamId: null,
            },
          })
        )
      );

      const auction = await tx.auction.create({
        data: {
          name: value.name,
          roomCode,
          state: "draft",
          createdById: req.user?.id || null,
        },
      });

      await Promise.all(
        createdTeams.map((t) =>
          tx.auctionTeam.create({
            data: { auctionId: auction.id, teamId: t.id },
          })
        )
      );

      await Promise.all(
        createdPlayers.map((p, idx) =>
          tx.auctionPlayer.create({
            data: { auctionId: auction.id, playerId: p.id, sortOrder: idx },
          })
        )
      );

      return {
        auction,
        teamCount: createdTeams.length,
        playerCount: createdPlayers.length,
        linkedCaptains,
      };
    });

    return res.status(StatusCodes.CREATED).json({
      auction: result.auction,
      message: `Imported ${result.teamCount} teams (${result.linkedCaptains} captains linked) and ${result.playerCount} players.`,
    });
  } catch (err: any) {
    logger.error({ err }, "Import failed");
    return res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ error: "Failed to import: " + err.message });
  }
}

export async function startAuction(req: Request, res: Response) {
  const { id } = req.params;

  const auction = await prisma.auction.findUnique({ where: { id } });
  if (!auction)
    return res
      .status(StatusCodes.NOT_FOUND)
      .json({ error: "Auction not found" });
  if (auction.state !== "draft" && auction.state !== "paused")
    return res
      .status(StatusCodes.CONFLICT)
      .json({ error: "Auction cannot be started from current state" });

  await prisma.auction.update({
    where: { id },
    data: { state: "active" },
  });

  await prisma.unsoldPlayer.deleteMany({ where: { auctionId: id } });

  await initAuctionQueue(id);
  const queue = auctionPlayerQueues.get(id) || [];
  const nextPlayerId = queue.shift();
  auctionPlayerQueues.set(id, queue);

  if (nextPlayerId) {
    const updated = await prisma.auction.update({
      where: { id },
      data: {
        currentPlayerId: nextPlayerId,
        currentBidAmount: null,
        currentBidTeamId: null,
        currentBidAt: null,
      },
    });

    await prisma.skippedTeam.deleteMany({ where: { auctionId: id } });
    await startAuctionTimer(id, auction.roomCode);

    const player = await prisma.player.findUnique({
      where: { id: nextPlayerId },
    });

    getIO()
      .to(auction.roomCode)
      .emit("auction:player_changed", {
        playerId: nextPlayerId,
        player: player
          ? {
              id: player.id,
              name: player.name,
              photo: player.photo || "",
              age: player.age || 25,
              role: player.role || "",
              bowlerType: player.bowlerType || "",
              basePrice: player.basePrice || 1000,
            }
          : null,
      });

    return res.status(StatusCodes.OK).json({ auction: updated });
  }

  return res.status(StatusCodes.OK).json({ auction });
}

export async function pauseAuction(req: Request, res: Response) {
  const { id } = req.params;
  const auction = await prisma.auction.update({
    where: { id },
    data: { state: "paused" },
  });
  stopAuctionTimer(id);
  return res.status(StatusCodes.OK).json({ auction });
}

export async function resumeAuction(req: Request, res: Response) {
  const { id } = req.params;
  const auction = await prisma.auction.update({
    where: { id },
    data: { state: "active" },
  });

  if (auction.currentPlayerId) {
    await startAuctionTimer(id, auction.roomCode);
  } else {
    await moveToNextPlayer(id, auction.roomCode);
  }

  return res.status(StatusCodes.OK).json({ auction });
}

export async function placeBid(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { error, value } = bidSchema.validate(req.body);
    if (error)
      return res
        .status(StatusCodes.BAD_REQUEST)
        .json({ error: error.message });

    const dedupeKey = `bid:${id}:${value.teamId}`;
    if (pendingBids.has(dedupeKey)) return pendingBids.get(dedupeKey);

    const bidPromise = (async () => {
      try {
        const [auction, team] = await Promise.all([
          prisma.auction.findUnique({
            where: { id },
            include: { skippedTeams: true },
          }),
          prisma.team.findUnique({ where: { id: value.teamId } }),
        ]);

        if (!auction || !team)
          return res
            .status(StatusCodes.NOT_FOUND)
            .json({ error: "Not found" });
        if (auction.state !== "active")
          return res
            .status(StatusCodes.CONFLICT)
            .json({ error: "Auction not active" });

        const user = (req as any).user;
        if (user?.role === "captain") {
          const dbUser = await prisma.user.findUnique({
            where: { id: user.id },
            select: { teamId: true },
          });
          if (!dbUser?.teamId || dbUser.teamId !== value.teamId) {
            return res
              .status(StatusCodes.FORBIDDEN)
              .json({ error: "Captains only bid for their team" });
          }
        }

        const currentSquadSize = await prisma.player.count({
          where: { teamId: team.id },
        });
        if (currentSquadSize >= (auction.maxSquadSize || 25)) {
          return res
            .status(StatusCodes.BAD_REQUEST)
            .json({ error: `Squad full (Max ${auction.maxSquadSize || 25} players)` });
        }

        let currentPrice = 0;
        if (auction.currentBidAmount) {
          currentPrice = auction.currentBidAmount;
        } else if (auction.currentPlayerId) {
          const player = await prisma.player.findUnique({
            where: { id: auction.currentPlayerId },
            select: { basePrice: true },
          });
          if (!player)
            return res.status(400).json({ error: "No active player" });
          currentPrice = player.basePrice;
        }

        const increment = auction.bidIncrement || BID_INCREMENT;
        const minBid = auction.currentBidAmount
          ? currentPrice + increment
          : currentPrice;

        if (value.amount < minBid) {
          return res.status(StatusCodes.BAD_REQUEST).json({
            error: `Bid too low. Minimum required: Rs. ${minBid.toLocaleString("en-IN")}`,
          });
        }

        if (team.wallet < value.amount)
          return res
            .status(StatusCodes.BAD_REQUEST)
            .json({ error: "Insufficient budget" });

        if (
          auction.currentPlayerId &&
          value.playerId &&
          auction.currentPlayerId !== value.playerId
        )
          return res
            .status(StatusCodes.BAD_REQUEST)
            .json({ error: "Wrong player" });

        const playerId = value.playerId || auction.currentPlayerId!;
        const now = new Date();

        const updated = await prisma.$transaction(async (tx) => {
          const locked = await tx.$queryRawUnsafe<any[]>(
            `SELECT * FROM auctions WHERE id = $1 FOR UPDATE`,
            id
          );
          const current = locked[0];
          if (!current) return null;
          if (
            current.currentBidAmount !== null &&
            current.currentBidAmount >= value.amount
          ) {
            return null;
          }

          await tx.bid.create({
            data: {
              auctionId: id,
              teamId: value.teamId,
              playerId,
              amount: value.amount,
            },
          });

          await tx.skippedTeam.deleteMany({ where: { auctionId: id } });

          return tx.auction.update({
            where: { id },
            data: {
              currentBidAmount: value.amount,
              currentBidTeamId: value.teamId,
              currentBidAt: now,
            },
          });
        });

        if (!updated)
          return res
            .status(StatusCodes.CONFLICT)
            .json({ error: "Higher bid exists" });

        resetAuctionTimer(id, updated.roomCode).catch(logger.error);
        getIO().to(updated.roomCode).emit("auction:bid_update", {
          amount: value.amount,
          teamId: value.teamId,
          playerId,
          at: now.getTime(),
        });

        return res.status(StatusCodes.OK).json({
          auction: {
            ...updated,
            currentBid: {
              amount: updated.currentBidAmount,
              teamId: updated.currentBidTeamId,
              at: updated.currentBidAt,
            },
          },
        });
      } finally {
        setTimeout(() => pendingBids.delete(dedupeKey), 500);
      }
    })();

    pendingBids.set(dedupeKey, bidPromise);
    return bidPromise;
  } catch (err: any) {
    logger.error({ err }, "placeBid error");
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

  const auction = await prisma.auction.findUnique({ where: { id } });
  if (!auction)
    return res
      .status(StatusCodes.NOT_FOUND)
      .json({ error: "Auction not found" });
  if (auction.state !== "active")
    return res.status(StatusCodes.BAD_REQUEST).json({ error: "Not active" });
  if (!auction.currentBidAmount)
    return res
      .status(StatusCodes.BAD_REQUEST)
      .json({ error: "No bid to undo" });

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { teamId: true },
  });
  if (!dbUser?.teamId || auction.currentBidTeamId !== dbUser.teamId) {
    return res.status(StatusCodes.FORBIDDEN).json({ error: "Not your bid" });
  }

  const lastBid = await prisma.bid.findFirst({
    where: { auctionId: id, playerId: auction.currentPlayerId! },
    orderBy: { createdAt: "desc" },
  });

  if (!lastBid || lastBid.teamId !== dbUser.teamId) {
    return res
      .status(StatusCodes.BAD_REQUEST)
      .json({ error: "Another bid exists after yours" });
  }

  const result = await prisma.$transaction(async (tx) => {
    await tx.bid.delete({ where: { id: lastBid.id } });

    const previousBid = await tx.bid.findFirst({
      where: { auctionId: id, playerId: auction.currentPlayerId! },
      orderBy: { createdAt: "desc" },
    });

    return tx.auction.update({
      where: { id },
      data: {
        currentBidAmount: previousBid?.amount || null,
        currentBidTeamId: previousBid?.teamId || null,
        currentBidAt: previousBid?.createdAt || null,
      },
    });
  });

  const team = await prisma.team.findUnique({ where: { id: dbUser.teamId } });
  getIO().to(auction.roomCode).emit("auction:bid_undo", {
    teamId: dbUser.teamId,
    teamName: team?.name,
    currentBid: result.currentBidAmount
      ? {
          amount: result.currentBidAmount,
          teamId: result.currentBidTeamId,
          at: result.currentBidAt,
        }
      : null,
  });

  if (result.currentBidAmount) {
    resetAuctionTimer(id, auction.roomCode);
  }

  return res.status(StatusCodes.OK).json({
    auction: {
      ...result,
      currentBid: result.currentBidAmount
        ? {
            amount: result.currentBidAmount,
            teamId: result.currentBidTeamId,
          }
        : null,
    },
  });
}

export async function closeAuction(req: Request, res: Response) {
  const { id } = req.params;
  const auction = await prisma.auction.findUnique({
    where: { id },
    include: {
      teams: { include: { team: true } },
      players: { include: { player: true } },
      sales: { include: { player: true, team: true } },
    },
  });

  if (!auction)
    return res
      .status(StatusCodes.NOT_FOUND)
      .json({ error: "Auction not found" });

  stopAuctionTimer(id);

  const report = auction.teams.map((at) => {
    const teamPlayers = auction.players
      .map((ap) => ap.player)
      .filter((p) => p.teamId === at.teamId);
    const teamSales = auction.sales.filter((s) => s.teamId === at.teamId);
    const spent = teamSales.reduce((sum, s) => sum + s.price, 0);

    return {
      TeamName: at.team.name,
      Captain: at.team.captain || "None",
      PlayersCount: teamPlayers.length,
      TotalSpent: spent,
      RemainingPurse: at.team.wallet,
      Roster: teamPlayers.map((p) => {
        const sale = teamSales.find((s) => s.playerId === p.id);
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

  const unsoldList = auction.players
    .map((ap) => ap.player)
    .filter((p) => !p.teamId)
    .map((p) => ({
      Name: p.name,
      Role: p.role,
      Mobile: p.mobile,
      Email: p.email,
      BasePrice: p.basePrice,
    }));

  await prisma.auction.update({
    where: { id },
    data: {
      state: "completed",
      currentPlayerId: null,
      currentBidAmount: null,
      currentBidTeamId: null,
    },
  });

  getIO().to(auction.roomCode).emit("auction:ended", {
    message: "Auction completed.",
    auctionId: auction.id,
  });

  return res.status(StatusCodes.OK).json({
    message: "Closed",
    report: {
      auctionName: auction.name,
      date: new Date(),
      teams: report,
      unsold: unsoldList,
    },
  });
}

export async function setCurrentPlayer(req: Request, res: Response) {
  const { error, value } = currentPlayerSchema.validate(req.body);
  if (error)
    return res.status(StatusCodes.BAD_REQUEST).json({ error: error.message });

  const { id } = req.params;
  const auction = await prisma.auction.update({
    where: { id },
    data: {
      currentPlayerId: value.playerId,
      currentBidAmount: null,
      currentBidTeamId: null,
      currentBidAt: null,
    },
  });

  const player = await prisma.player.findUnique({
    where: { id: value.playerId },
  });
  if (player) {
    getIO()
      .to(auction.roomCode)
      .emit("auction:player_changed", {
        playerId: player.id,
        player: {
          id: player.id,
          name: player.name,
          photo: player.photo || "",
          age: player.age || 25,
          role: player.role,
          bowlerType: player.bowlerType || "",
          basePrice: player.basePrice,
        },
      });
  }

  return res.status(StatusCodes.OK).json({ auction });
}

export async function sellCurrent(req: Request, res: Response) {
  const { id } = req.params;
  const auction = await prisma.auction.findUnique({
    where: { id },
    include: { skippedTeams: true },
  });

  if (!auction || auction.state !== "active")
    return res
      .status(StatusCodes.BAD_REQUEST)
      .json({ error: "Invalid auction" });
  if (!auction.currentPlayerId)
    return res.status(StatusCodes.BAD_REQUEST).json({ error: "No player" });

  if (!auction.currentBidAmount || !auction.currentBidTeamId) {
    await moveToNextPlayer(id, auction.roomCode);
    return res.status(StatusCodes.OK).json({ auction });
  }

  const result = await prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRawUnsafe<any[]>(
      `SELECT * FROM auctions WHERE id = $1 FOR UPDATE`,
      id
    );
    const current = locked[0];
    if (!current || !current.currentBidAmount) return null;

    const team = await tx.team.findUnique({
      where: { id: current.currentBidTeamId },
    });
    const player = await tx.player.findUnique({
      where: { id: current.currentPlayerId },
    });
    if (!team || !player) return null;

    if (team.wallet < current.currentBidAmount) return null;

    const existingSale = await tx.sale.findUnique({
      where: {
        auctionId_playerId: { auctionId: id, playerId: player.id },
      },
    });
    if (existingSale) return null;

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
        auctionId: id,
        playerId: player.id,
        teamId: team.id,
        price: current.currentBidAmount,
      },
    });

    await tx.auction.update({
      where: { id },
      data: {
        currentBidAmount: null,
        currentBidTeamId: null,
        currentBidAt: null,
      },
    });

    await tx.skippedTeam.deleteMany({ where: { auctionId: id } });

    return { player, team, price: current.currentBidAmount };
  });

  if (!result) {
    return res
      .status(StatusCodes.CONFLICT)
      .json({ error: "Sale could not be completed" });
  }

  getIO().to(auction.roomCode).emit("auction:sale", {
    playerId: result.player.id,
    playerName: result.player.name,
    teamId: result.team.id,
    teamName: result.team.name,
    price: result.price,
    saleType: "sold",
  });

  await moveToNextPlayer(id, auction.roomCode);
  return res.status(StatusCodes.OK).json({ auction });
}

export async function skipPlayer(req: Request, res: Response) {
  const { id } = req.params;
  const user = (req as any).user;

  const auction = await prisma.auction.findUnique({
    where: { id },
    include: { skippedTeams: true },
  });
  if (!auction || auction.state !== "active")
    return res
      .status(StatusCodes.BAD_REQUEST)
      .json({ error: "Invalid auction" });

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { teamId: true },
  });
  if (!dbUser?.teamId)
    return res.status(StatusCodes.BAD_REQUEST).json({ error: "No team" });

  const alreadySkipped = auction.skippedTeams.some(
    (st) => st.teamId === dbUser.teamId
  );
  if (alreadySkipped)
    return res
      .status(StatusCodes.BAD_REQUEST)
      .json({ error: "Already skipped" });

  await prisma.skippedTeam.create({
    data: { auctionId: id, teamId: dbUser.teamId },
  });

  getIO().to(auction.roomCode).emit("auction:skip", {
    teamId: dbUser.teamId,
    teamName: "Team",
    playerId: auction.currentPlayerId,
  });

  return res.status(StatusCodes.OK).json({ auction });
}
