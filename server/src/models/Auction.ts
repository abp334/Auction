import { Schema, model, type Document } from "mongoose";

export type AuctionState = "draft" | "active" | "paused" | "completed";

export interface BidRecord {
  teamId: string;
  amount: number;
  playerId?: string;
  at: Date;
}

export interface AuctionDocument extends Document {
  name: string;
  roomCode: string;
  state: AuctionState;
  players: string[];
  teams: string[];
  currentPlayerId?: string;
  currentBid?: BidRecord;
  bidHistory: BidRecord[];
  sales: { playerId: string; teamId: string; price: number; at: Date }[];
  unsoldPlayers?: string[];
  skippedTeams?: string[];
  timerStart?: Date;
  timerDuration?: number;
  timerEndsAt?: Date; // <--- ADDED THIS FIELD
  createdBy: string;
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
      index: true,
    },
    players: [{ type: String, ref: "Player" }],
    teams: [{ type: String, ref: "Team" }],
    currentPlayerId: { type: String, index: true },
    currentBid: { type: bidRecordSchema },
    bidHistory: { type: [bidRecordSchema], default: [] },
    sales: {
      type: [{ playerId: String, teamId: String, price: Number, at: Date }],
      default: [],
    },
    unsoldPlayers: { type: [String], default: [] },
    skippedTeams: { type: [String], default: [] },
    timerStart: { type: Date },
    timerDuration: { type: Number, default: 30 },
    timerEndsAt: { type: Date }, // <--- ADDED TO SCHEMA
    createdBy: { type: String, required: true },
  },
  { timestamps: true }
);

auctionSchema.index({ state: 1, roomCode: 1 });
auctionSchema.index({ state: 1, currentPlayerId: 1 });

export const Auction = model<AuctionDocument>("Auction", auctionSchema);
