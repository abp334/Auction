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
    socket.join(roomCode);
    io.to(roomCode).emit("auction:presence", {
      userId: socket.id,
      joined: true,
    });
  });

  socket.on("auction:leave", (roomCode: string) => {
    socket.leave(roomCode);
    io.to(roomCode).emit("auction:presence", {
      userId: socket.id,
      joined: false,
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
          // reject unauthenticated bidders
          return;
        }

        // If user is captain, ensure they belong to the team they're bidding for.
        if (socketUser.role === "captain") {
          const socketTeamId = (socket.data as any)?.teamId;
          // If teamId wasn't loaded on connect, fetch it now
          let captainTeamId = socketTeamId;
          if (!captainTeamId) {
            const dbUser = await User.findById(socketUser.id)
              .select("teamId")
              .lean();
            captainTeamId = dbUser?.teamId;
            (socket.data as any).teamId = captainTeamId;
          }
          if (!captainTeamId || captainTeamId !== teamId) {
            // Captains can only bid for their own team
            return;
          }
        }

        const dedupeKey = `sockbid:${auctionId}:${teamId}`;
        const now = Date.now();
        const last = pendingSocketBids.get(dedupeKey) || 0;
        // simple 300ms throttle per team
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

        // Minimum bid
        const minBid = 1000;
        if (amount < minBid) return;

        // Check current bid and ensure incoming bid is higher
        if (auction.currentBid && amount <= auction.currentBid.amount) return;

        // Budget enforcement
        if (team.wallet < amount) return;

        // If playerId provided, ensure it matches current
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
        const updated = await Auction.findByIdAndUpdate(
          auctionId,
          {
            $set: { currentBid: bid, skippedTeams: [] },
            $push: { bidHistory: bid },
          },
          { new: true }
        );
        if (!updated) return;

        // Reset timer (non-blocking)
        resetAuctionTimer(auctionId, updated.roomCode).catch(console.error);

        // Broadcast bid update
        io.to(roomCode).emit("auction:bid_update", {
          amount: bid.amount,
          teamId: bid.teamId,
          playerId: bid.playerId,
          at: bid.at.getTime(),
        });
      } catch (err) {
        console.error("Socket bid error:", err);
      } finally {
        // cleanup dedupe after short window
        setTimeout(() => {
          pendingSocketBids.delete(
            `sockbid:${payload.auctionId}:${payload.teamId}`
          );
        }, 500);
      }
    }
  );
}
