import { Schema, model, type Document, Types } from 'mongoose';

export type AuctionState = 'draft' | 'active' | 'paused' | 'completed';

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
    state: { type: String, enum: ['draft', 'active', 'paused', 'completed'], default: 'draft' },
    players: [{ type: String, ref: 'Player' }],
    teams: [{ type: String, ref: 'Team' }],
    currentPlayerId: { type: String },
    currentBid: { type: bidRecordSchema },
    bidHistory: { type: [bidRecordSchema], default: [] },
    sales: { type: [{ playerId: String, teamId: String, price: Number, at: Date }], default: [] },
    createdBy: { type: String, required: true },
  },
  { timestamps: true }
);

export const Auction = model<AuctionDocument>('Auction', auctionSchema);


