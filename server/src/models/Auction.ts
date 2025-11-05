import { Schema, model, type Document, Types } from "mongoose";

export type AuctionState = "draft" | "active" | "paused" | "completed";

export interface BidRecord {
  teamId: string;
  amount: number;
  playerId?: string;
  at: Date;
}

export interface AuctionDocument extends Document {
  name: string;
  roomCode: string; // for Socket.IO room
  state: AuctionState;
  players: string[]; // player ids participating
  teams: string[]; // team ids participating
  currentPlayerId?: string;
  currentBid?: BidRecord;
  bidHistory: BidRecord[];
  sales: { playerId: string; teamId: string; price: number; at: Date }[];
  unsoldPlayers?: string[]; // player IDs that went unsold in THIS auction
  skippedTeams?: string[]; // team IDs that skipped current player
  timerStart?: Date; // when timer started for current player
  timerDuration?: number; // timer duration in seconds (default 30)
  createdBy: string; // admin or captain id
  createdAt: Date;
  updatedAt: Date;
}

const bidRecordSchema = new Schema<BidRecord>(
  {
    teamId: { type: String, required: true },
    amount: { type: Number, required: true },
    playerId: { type: String },
    at: { type: Date, required: true, default: () => new Date() },
  },
  { _id: false }
);

const auctionSchema = new Schema<AuctionDocument>(
  {
    name: { type: String, required: true },
    roomCode: { type: String, required: true, unique: true, index: true },
    state: {
      type: String,
      enum: ["draft", "active", "paused", "completed"],
      default: "draft",
      index: true, // Index for filtering active auctions
    },
    players: [{ type: String, ref: "Player" }],
    teams: [{ type: String, ref: "Team" }],
    currentPlayerId: { type: String, index: true }, // Index for current player lookups
    currentBid: { type: bidRecordSchema },
    bidHistory: { type: [bidRecordSchema], default: [] },
    sales: {
      type: [{ playerId: String, teamId: String, price: Number, at: Date }],
      default: [],
    },
    unsoldPlayers: { type: [String], default: [] }, // player IDs that went unsold in THIS auction
    skippedTeams: { type: [String], default: [] }, // team IDs that skipped current player
    timerStart: { type: Date }, // when timer started for current player
    timerDuration: { type: Number, default: 30 }, // timer duration in seconds
    createdBy: { type: String, required: true },
  },
  { timestamps: true }
);

// Compound index for common queries
auctionSchema.index({ state: 1, roomCode: 1 });
auctionSchema.index({ state: 1, currentPlayerId: 1 });

export const Auction = model<AuctionDocument>("Auction", auctionSchema);
