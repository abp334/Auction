import { Schema, model, type Document } from "mongoose";

export interface PlayerDocument extends Document {
  name: string;
  role: string; // e.g., Batsman, Bowler, All-Rounder, WK
  basePrice: number;
  teamId?: string; // assigned after auction, or "UNSOLD" if not sold
  photo?: string;
  mobile?: string;
  email?: string;
  age?: number;
  batsmanType?: string;
  bowlerType?: string;
  stats?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const playerSchema = new Schema<PlayerDocument>(
  {
    name: { type: String, required: true },
    role: { type: String, required: true },
    basePrice: { type: Number, required: true, default: 0 },
    teamId: { type: String, index: true }, // Index for filtering unsold players
    photo: { type: String },
    mobile: { type: String },
    email: { type: String },
    age: { type: Number },
    batsmanType: { type: String },
    bowlerType: { type: String },
    stats: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

// Compound index for common queries (unsold players)
playerSchema.index({ teamId: 1, _id: 1 });

export const Player = model<PlayerDocument>("Player", playerSchema);
