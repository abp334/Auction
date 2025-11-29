import type { Server, Socket } from "socket.io";
import { Auction } from "../models/Auction.js";
import { Team } from "../models/Team.js";
import { User } from "../models/User.js";
import { resetAuctionTimer } from "../utils/timer.js";

// Simple in-memory dedupe map for socket bids: auctionId:teamId -> timestamp
const pendingSocketBids = new Map<string, number>();

export function registerAuctionSocketHandlers(
  io: Server,
  socket: Socket
): void {
  socket.on("auction:join", (roomCode: string) => {
    // console.log(`Socket ${socket.id} joining room ${roomCode}`);
    socket.join(roomCode);
    const socketUser = (socket.data as any)?.user as
      | { id: string; role: string }
      | undefined;
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
    const teamId = (socket.data as any)?.teamId;
    io.to(roomCode).emit("auction:presence", {
      userId: socket.id,
      joined: false,
      role: socketUser?.role || "spectator",
      teamId: teamId || null,
    });
  });

  // Accept bids over socket for lower latency; we still persist to DB atomically.
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
        if (!auctionId || !roomCode || !teamId || !amount) return;

        // Authorization: require authenticated user for bids.
        const socketUser = (socket.data as any)?.user as
          | { id: string; role: string }
          | undefined;
        if (!socketUser) {
          return;
        }

        // If user is captain, ensure they belong to the team they're bidding for.
        if (socketUser.role === "captain") {
          const socketTeamId = (socket.data as any)?.teamId;
          let captainTeamId = socketTeamId;
          if (!captainTeamId) {
            const dbUser = await User.findById(socketUser.id)
              .select("teamId")
              .lean();
            captainTeamId = dbUser?.teamId;
            (socket.data as any).teamId = captainTeamId;
          }
          if (!captainTeamId || captainTeamId !== teamId) {
            return;
          }
        }

        const dedupeKey = `sockbid:${auctionId}:${teamId}`;
        const now = Date.now();
        const last = pendingSocketBids.get(dedupeKey) || 0;
        if (now - last < 300) return;
        pendingSocketBids.set(dedupeKey, now);

        // Validate auction and team exist
        const [auction, team] = await Promise.all([
          Auction.findById(auctionId).select(
            "state currentBid currentPlayerId roomCode skippedTeams bidHistory"
          ),
          Team.findById(teamId).select("wallet name _id"),
        ]);
        if (!auction || auction.state !== "active") return;
        if (!team) return;

        const minBid = 1000;
        if (amount < minBid) return;

        // Check current bid locally (fast fail)
        if (auction.currentBid && amount <= auction.currentBid.amount) return;

        // Budget enforcement
        if (team.wallet < amount) return;

        if (
          auction.currentPlayerId &&
          playerId &&
          auction.currentPlayerId !== playerId
        )
          return;

        const bid = {
          teamId,
          amount,
          playerId,
          at: new Date(),
        };

        // Atomic update
        const updated = await Auction.findOneAndUpdate(
          {
            _id: auctionId,
            $or: [
              { currentBid: { $exists: false } },
              { "currentBid.amount": { $lt: amount } },
            ],
          },
          {
            $set: { currentBid: bid, skippedTeams: [] },
            $push: { bidHistory: bid },
          },
          { new: true }
        );

        if (!updated) return;

        // Reset timer (non-blocking)
        resetAuctionTimer(auctionId, updated.roomCode).catch(console.error);

        // BROADCAST FIX: Use the roomCode from the DB (updated.roomCode), not the client payload
        io.to(updated.roomCode).emit("auction:bid_update", {
          amount: bid.amount,
          teamId: bid.teamId,
          playerId: bid.playerId,
          at: bid.at.getTime(),
        });
      } catch (err) {
        console.error("Socket bid error:", err);
      } finally {
        setTimeout(() => {
          pendingSocketBids.delete(
            `sockbid:${payload.auctionId}:${payload.teamId}`
          );
        }, 500);
      }
    }
  );
}
