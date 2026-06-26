import type { Server, Socket } from "socket.io";
import prisma from "../utils/db.js";
import { resetAuctionTimer } from "../utils/timer.js";
import { logger } from "../utils/logger.js";
import { getRedis } from "../utils/redis.js";

const BID_INCREMENT = 1000;

function getMinimumBid(currentPrice: number, hasCurrentBid: boolean) {
  return hasCurrentBid ? currentPrice + BID_INCREMENT : currentPrice;
}

function rejectBid(socket: Socket, reason: string) {
  socket.emit("auction:bid_rejected", { reason });
}

export function registerAuctionSocketHandlers(
  io: Server,
  socket: Socket
): void {
  socket.on("auction:join", async (roomCode: string) => {
    const socketUser = (socket.data as any)?.user as
      | { id: string; role: string }
      | undefined;

    // Captains and players may only join the auction they were added to.
    if (
      socketUser &&
      (socketUser.role === "captain" || socketUser.role === "player")
    ) {
      try {
        const [dbUser, auction] = await Promise.all([
          prisma.user.findUnique({
            where: { id: socketUser.id },
            select: { auctionId: true },
          }),
          prisma.auction.findUnique({
            where: { roomCode },
            select: { id: true },
          }),
        ]);
        if (!auction || !dbUser?.auctionId || dbUser.auctionId !== auction.id) {
          socket.emit("error", {
            message: "You are not part of this auction.",
          });
          return;
        }
      } catch {
        return;
      }
    }

    socket.join(roomCode);
    const teamId = (socket.data as any)?.teamId;
    io.to(roomCode).emit("auction:presence", {
      userId: socket.id,
      joined: true,
      role: socketUser?.role || "spectator",
      teamId: teamId || null,
    });
  });

  socket.on("auction:leave", (roomCode: string) => {
    socket.leave(roomCode);
    const socketUser = (socket.data as any)?.user as
      | { id: string; role: string }
      | undefined;

    if (!socketUser) {
      socket.emit("error", {
        message: "Unauthorized: You must be logged in.",
      });
      return;
    }
    const teamId = (socket.data as any)?.teamId;
    io.to(roomCode).emit("auction:presence", {
      userId: socket.id,
      joined: false,
      role: socketUser?.role || "spectator",
      teamId: teamId || null,
    });
  });

  socket.on(
    "auction:bid",
    async (payload: {
      auctionId: string;
      roomCode: string;
      amount: number;
      teamId: string;
      playerId?: string;
    }) => {
      try {
        const { auctionId, roomCode, amount, teamId, playerId } = payload;
        if (!auctionId || !roomCode || !teamId || !amount) {
          rejectBid(socket, "Invalid bid payload.");
          return;
        }

        const socketUser = (socket.data as any)?.user as
          | { id: string; role: string }
          | undefined;
        if (!socketUser) {
          rejectBid(socket, "You must be logged in to bid.");
          return;
        }

        if (socketUser.role === "captain") {
          let captainTeamId = (socket.data as any)?.teamId;
          if (!captainTeamId) {
            const dbUser = await prisma.user.findUnique({
              where: { id: socketUser.id },
              select: { teamId: true },
            });
            captainTeamId = dbUser?.teamId;
            (socket.data as any).teamId = captainTeamId;
          }
          if (!captainTeamId || captainTeamId !== teamId) {
            rejectBid(socket, "Captains may only bid for their own team.");
            return;
          }
        }

        // Redis-based deduplication (300ms window)
        const dedupeKey = `sockbid:${auctionId}:${teamId}`;
        try {
          const redis = getRedis();
          const set = await redis.set(dedupeKey, "1", "PX", 300, "NX");
          if (!set) return;
        } catch {
          // If Redis unavailable, skip dedupe
        }

        const [auction, team] = await Promise.all([
          prisma.auction.findUnique({ where: { id: auctionId } }),
          prisma.team.findUnique({ where: { id: teamId } }),
        ]);
        if (!auction || auction.state !== "active") {
          rejectBid(socket, "Auction is not active.");
          return;
        }
        if (!team) {
          rejectBid(socket, "Team not found.");
          return;
        }

        // Squad size check (was missing in socket path before)
        const currentSquadSize = await prisma.player.count({
          where: { teamId: team.id },
        });
        if (currentSquadSize >= (auction.maxSquadSize || 25)) {
          rejectBid(socket, `Squad full (Max ${auction.maxSquadSize || 25} players).`);
          return;
        }

        let currentPrice = 0;
        if (auction.currentBidAmount) {
          currentPrice = auction.currentBidAmount;
        } else if (auction.currentPlayerId) {
          const player = await prisma.player.findUnique({
            where: { id: auction.currentPlayerId },
            select: { basePrice: true },
          });
          if (!player) {
            rejectBid(socket, "No active player.");
            return;
          }
          currentPrice = player.basePrice || 0;
        }

        const increment = auction.bidIncrement || BID_INCREMENT;
        const minBid = auction.currentBidAmount
          ? currentPrice + increment
          : currentPrice;
        if (amount < minBid) {
          rejectBid(
            socket,
            `Bid too low. Minimum required: ₹${minBid.toLocaleString("en-IN")}.`
          );
          return;
        }

        if (team.wallet < amount) {
          rejectBid(socket, "Insufficient budget.");
          return;
        }

        if (
          auction.currentPlayerId &&
          playerId &&
          auction.currentPlayerId !== playerId
        )
          return;

        const bidPlayerId = playerId || auction.currentPlayerId!;
        const now = new Date();

        const updated = await prisma.$transaction(async (tx) => {
          const locked = await tx.$queryRawUnsafe<any[]>(
            `SELECT * FROM auctions WHERE id = $1 FOR UPDATE`,
            auctionId
          );
          const current = locked[0];
          if (!current) return null;
          if (
            current.currentBidAmount !== null &&
            current.currentBidAmount >= amount
          )
            return null;

          await tx.bid.create({
            data: {
              auctionId,
              teamId,
              playerId: bidPlayerId,
              amount,
            },
          });

          await tx.skippedTeam.deleteMany({ where: { auctionId } });

          return tx.auction.update({
            where: { id: auctionId },
            data: {
              currentBidAmount: amount,
              currentBidTeamId: teamId,
              currentBidAt: now,
            },
          });
        });

        if (!updated) {
          rejectBid(socket, "Another team placed a higher bid.");
          return;
        }

        resetAuctionTimer(auctionId, updated.roomCode).catch((err) =>
          logger.error({ err }, "Socket bid timer reset failed")
        );

        io.to(updated.roomCode).emit("auction:bid_update", {
          amount,
          teamId,
          playerId: bidPlayerId,
          at: now.getTime(),
        });
      } catch (err) {
        logger.error({ err }, "Socket bid error");
        rejectBid(socket, "Bid failed due to a server error.");
      }
    }
  );
}
